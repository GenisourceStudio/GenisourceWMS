package com.genisource.wms.outbound.service;

import com.genisource.wms.batch.service.BatchService;
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
    private final BatchService batchService;

    public OutboundConfirmationService(
            OutboundOrderRepository orderRepository,
            LocationRepository locationRepository,
            InventoryRepository inventoryRepository,
            InventoryService inventoryService,
            BatchService batchService) {
        this.orderRepository = orderRepository;
        this.locationRepository = locationRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
        this.batchService = batchService;
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

    /**
     * FEFO pick suggestions from live batch stock. Falls back to the legacy
     * aggregate allocation for SKUs that have never been batch-tracked.
     */
    private List<PickLocation> pickLocations(Long skuId, int required) {
        List<BatchService.BatchPick> batchPicks = batchService.pick(skuId, required);
        if (!batchPicks.isEmpty()) {
            return batchPicks.stream()
                    .map(p -> new PickLocation(
                            p.locationCode(), p.qty(), p.batchId(), p.batchNo(), p.expiryDate()))
                    .toList();
        }

        // Legacy aggregate-only path (no batches registered for this SKU).
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

        // After the idempotent replay branch — see InboundConfirmationService.
        if (order.getStatus() == OutboundOrder.Status.COMPLETED) {
            throw WmsException.conflict("ORDER_COMPLETED", "出库单已完成");
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

        // The scanned location must be one of the live pick suggestions. When
        // batch tracking is active, FEFO may suggest several batches at this
        // location; each is decremented in the same transaction.
        List<PickLocation> picks = pickLocations(line.getSku().getId(), line.getExpectedQty());
        List<PickLocation> matched = picks.stream()
                .filter(p -> p.locationCode().equalsIgnoreCase(location.getCode()))
                .filter(p -> request.batchNo() == null || request.batchNo().isBlank()
                        || p.batchNo() == null
                        || p.batchNo().equalsIgnoreCase(request.batchNo().trim()))
                .toList();
        if (matched.isEmpty()) {
            throw WmsException.conflict("LOCATION_INVALID",
                    "库位或批次不在拣货指引中，请刷新任务");
        }

        Long operatorId = principal == null ? null : principal.id();
        String operatorName = principal == null ? "system" : principal.displayName();
        if (!line.confirm(location, request.qty(), request.clientToken(), operatorId)) {
            throw WmsException.conflict("LINE_ALREADY_CONFIRMED", "该行已被其他作业确认");
        }

        // One ledger row per batch taken (FEFO order), all inside this single
        // transaction. Any failure rolls back every decrement and the line state.
        int remaining = request.qty();
        int qtyAfter = 0;
        for (PickLocation pick : matched) {
            if (remaining <= 0) break;
            int take = Math.min(pick.available(), remaining);
            qtyAfter = inventoryService.recordStockChange(
                    "OUTBOUND",
                    line.getSku().getId(),
                    location.getId(),
                    -take,
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
                            "batchNo", String.valueOf(pick.batchNo()),
                            "take", take,
                            "lineId", lineId,
                            "clientToken", String.valueOf(request.clientToken())),
                    pick.batchId());
            remaining -= take;
        }
        if (remaining > 0) {
            throw WmsException.conflict("INSUFFICIENT_BATCH_STOCK",
                    "该库位批次库存不足，请刷新任务");
        }

        order.recomputeStatus();

        return new com.genisource.wms.inbound.web.ConfirmLineResponse(
                lineId, "DONE", qtyAfter, order.getStatus().name());
    }
}
