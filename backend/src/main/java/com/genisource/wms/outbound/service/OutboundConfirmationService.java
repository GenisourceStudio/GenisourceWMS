package com.genisource.wms.outbound.service;

import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.inventory.domain.Inventory;
import com.genisource.wms.inventory.repository.InventoryRepository;
import com.genisource.wms.inventory.service.InventoryService;
import com.genisource.wms.masterdata.domain.StorageLocation;
import com.genisource.wms.masterdata.repository.LocationRepository;
import com.genisource.wms.outbound.domain.OutboundLine;
import com.genisource.wms.outbound.domain.OutboundOrder;
import com.genisource.wms.outbound.repository.OutboundOrderRepository;
import com.genisource.wms.outbound.web.ConfirmOutboundLineRequest;
import com.genisource.wms.outbound.web.OutboundTaskResponse;
import com.genisource.wms.outbound.web.PickLocation;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboundConfirmationService {

    private final OutboundOrderRepository orderRepository;
    private final LocationRepository locationRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    public OutboundConfirmationService(
            OutboundOrderRepository orderRepository,
            LocationRepository locationRepository,
            InventoryRepository inventoryRepository,
            InventoryService inventoryService) {
        this.orderRepository = orderRepository;
        this.locationRepository = locationRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
    }

    /**
     * Pick suggestions are computed from live stock at read time, never stored
     * on the order — a previous order may have consumed the stock since then.
     */
    @Transactional(readOnly = true)
    public OutboundTaskResponse task(Long orderId) {
        OutboundOrder order = orderRepository
                .findById(orderId)
                .orElseThrow(() -> WmsException.notFound("出库单不存在：" + orderId));

        List<OutboundTaskResponse.Line> lines = order.getLines().stream().map(line -> {
            List<PickLocation> picks = pickLocations(line.getSku().getId(), line.getExpectedQty());
            return new OutboundTaskResponse.Line(
                    line.getId(),
                    line.getSku().getCode(),
                    line.getSku().getName(),
                    line.getExpectedQty(),
                    line.getStatus().name(),
                    picks);
        }).toList();

        return new OutboundTaskResponse(
                order.getId(), order.getOrderNo(), order.getPartner().getName(),
                order.getStatus().name(), lines);
    }

    /** Greedy allocation by location code, taking only as much as needed. */
    private List<PickLocation> pickLocations(Long skuId, int required) {
        List<Inventory> stock = inventoryRepository.findAll().stream()
                .filter(i -> i.getSkuId().equals(skuId) && i.getQty() > 0)
                .sorted(Comparator.comparing(Inventory::getLocationId))
                .toList();

        List<PickLocation> picks = new ArrayList<>();
        int remaining = required;
        for (Inventory inv : stock) {
            if (remaining <= 0) break;
            int take = Math.min(inv.getQty(), remaining);
            String code = locationRepository.findById(inv.getLocationId())
                    .map(StorageLocation::getCode).orElse("?");
            picks.add(new PickLocation(code, take));
            remaining -= take;
        }
        return picks;
    }

    @Transactional
    public com.genisource.wms.inbound.web.ConfirmLineResponse confirm(
            Long orderId, Long lineId, ConfirmOutboundLineRequest request,
            UserPrincipal principal, String ip) {

        OutboundOrder order = orderRepository
                .findById(orderId)
                .orElseThrow(() -> WmsException.notFound("出库单不存在：" + orderId));

        if (order.getStatus() == OutboundOrder.Status.COMPLETED) {
            throw WmsException.conflict("ORDER_COMPLETED", "出库单已完成");
        }

        OutboundLine line = order.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> WmsException.notFound("单据行不存在：" + lineId));

        if (line.isDone()) {
            if (request.clientToken() != null
                    && request.clientToken().equals(line.getConfirmToken())) {
                return new com.genisource.wms.inbound.web.ConfirmLineResponse(
                        lineId, "DONE", line.getConfirmedQty(), order.getStatus().name());
            }
            throw WmsException.conflict("DUPLICATE_SCAN", "该行已完成，请勿重复扫描");
        }

        if (!line.getSku().getCode().equalsIgnoreCase(request.skuCode().trim())) {
            throw WmsException.conflict("SKU_MISMATCH",
                    "SKU 不匹配，应扫 " + line.getSku().getCode());
        }

        StorageLocation location = locationRepository
                .findByCode(request.locationCode().trim())
                .orElseThrow(() -> WmsException.conflict("LOCATION_INVALID", "库位不存在"));
        if (!location.isActive()) {
            throw WmsException.conflict("LOCATION_INVALID", "库位已停用");
        }

        if (request.qty() != line.getExpectedQty()) {
            throw WmsException.conflict("QTY_MISMATCH", "数量不符，应为 " + line.getExpectedQty());
        }

        // The scanned location must be one of the live pick suggestions.
        boolean validPick = pickLocations(line.getSku().getId(), line.getExpectedQty()).stream()
                .anyMatch(p -> p.locationCode().equalsIgnoreCase(location.getCode()));
        if (!validPick) {
            throw WmsException.conflict("LOCATION_INVALID",
                    "库位不在拣货指引中，请刷新任务");
        }

        Long operatorId = principal == null ? null : principal.id();
        String operatorName = principal == null ? "system" : principal.displayName();
        if (!line.confirm(location, request.qty(), request.clientToken(), operatorId)) {
            throw WmsException.conflict("LINE_ALREADY_CONFIRMED", "该行已被其他作业确认");
        }

        // Negative delta triggers PESSIMISTIC_WRITE lock + sufficiency check
        // inside InventoryService. Any failure rolls back the whole transaction.
        int qtyAfter = inventoryService.recordStockChange(
                "OUTBOUND",
                line.getSku().getId(),
                location.getId(),
                -request.qty(),
                "OUTBOUND",
                order.getId(),
                order.getOrderNo(),
                line.getId(),
                operatorId,
                operatorName,
                ip,
                Map.of(
                        "scannedSku", request.skuCode(),
                        "scannedLocation", request.locationCode(),
                        "lineId", lineId,
                        "clientToken", String.valueOf(request.clientToken())));

        order.recomputeStatus();

        return new com.genisource.wms.inbound.web.ConfirmLineResponse(
                lineId, "DONE", qtyAfter, order.getStatus().name());
    }
}
