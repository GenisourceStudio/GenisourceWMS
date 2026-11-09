package com.genisource.wms.inbound.service;

import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.inbound.domain.InboundLine;
import com.genisource.wms.inbound.domain.InboundOrder;
import com.genisource.wms.inbound.repository.InboundOrderRepository;
import com.genisource.wms.inbound.web.ConfirmLineRequest;
import com.genisource.wms.inbound.web.ConfirmLineResponse;
import com.genisource.wms.inventory.repository.InventoryTxnRepository;
import com.genisource.wms.inventory.service.InventoryService;
import com.genisource.wms.masterdata.domain.StorageLocation;
import com.genisource.wms.masterdata.repository.LocationRepository;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordinates a single line confirmation: validation → status transition →
 * stock increase → ledger → audit → order status. All of it in ONE transaction
 * (SDD §5.2). A failure anywhere rolls all of it back.
 */
@Service
public class InboundConfirmationService {

    private final InboundOrderRepository orderRepository;
    private final LocationRepository locationRepository;
    private final InventoryService inventoryService;
    private final InventoryTxnRepository txnRepository;

    public InboundConfirmationService(
            InboundOrderRepository orderRepository,
            LocationRepository locationRepository,
            InventoryService inventoryService,
            InventoryTxnRepository txnRepository) {
        this.orderRepository = orderRepository;
        this.locationRepository = locationRepository;
        this.inventoryService = inventoryService;
        this.txnRepository = txnRepository;
    }

    @Transactional
    public ConfirmLineResponse confirm(
            Long orderId, Long lineId, ConfirmLineRequest request,
            UserPrincipal principal, String ip) {

        InboundOrder order = orderRepository
                .findById(orderId)
                .orElseThrow(() -> WmsException.notFound("入库单不存在：" + orderId));

        if (order.getStatus() == InboundOrder.Status.COMPLETED) {
            throw WmsException.conflict("ORDER_COMPLETED", "入库单已完成");
        }

        InboundLine line = order.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> WmsException.notFound("单据行不存在：" + lineId));

        // --- Idempotent replay: same token on an already-done row returns the first result.
        if (line.isDone()) {
            if (request.clientToken() != null
                    && request.clientToken().equals(line.getConfirmToken())) {
                int qtyAfter = txnRepository
                        .findQtyAfterByLine(lineId, "INBOUND")
                        .orElse(line.getConfirmedQty());
                return new ConfirmLineResponse(lineId, "DONE", qtyAfter, order.getStatus().name());
            }
            throw WmsException.conflict("DUPLICATE_SCAN", "该行已完成，请勿重复扫描");
        }

        // --- Scan validation (all of it before any write).
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
            throw WmsException.conflict("QTY_MISMATCH",
                    "数量不符，应为 " + line.getExpectedQty());
        }

        // --- Status transition (the entity method guards against double-confirm).
        Long operatorId = principal == null ? null : principal.id();
        String operatorName = principal == null ? "system" : principal.displayName();
        if (!line.confirm(location, request.qty(), request.clientToken(), operatorId)) {
            throw WmsException.conflict("LINE_ALREADY_CONFIRMED", "该行已被其他作业确认");
        }

        // --- The only stock write. Same transaction as everything else.
        int qtyAfter = inventoryService.recordStockChange(
                "INBOUND",
                line.getSku().getId(),
                location.getId(),
                request.qty(),
                "INBOUND",
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

        // --- Status is derived from line progress, never set by hand.
        order.recomputeStatus();

        return new ConfirmLineResponse(lineId, "DONE", qtyAfter, order.getStatus().name());
    }
}
