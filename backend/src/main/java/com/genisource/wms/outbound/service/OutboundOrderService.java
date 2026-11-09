package com.genisource.wms.outbound.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.inventory.repository.InventoryRepository;
import com.genisource.wms.masterdata.domain.Partner;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.repository.PartnerRepository;
import com.genisource.wms.masterdata.repository.SkuRepository;
import com.genisource.wms.outbound.domain.OutboundLine;
import com.genisource.wms.outbound.domain.OutboundOrder;
import com.genisource.wms.outbound.repository.OutboundOrderRepository;
import com.genisource.wms.outbound.web.CreateOutboundOrderRequest;
import com.genisource.wms.outbound.web.OutboundOrderResponse;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboundOrderService {

    private final OutboundOrderRepository orderRepository;
    private final PartnerRepository partnerRepository;
    private final SkuRepository skuRepository;
    private final InventoryRepository inventoryRepository;

    public OutboundOrderService(
            OutboundOrderRepository orderRepository,
            PartnerRepository partnerRepository,
            SkuRepository skuRepository,
            InventoryRepository inventoryRepository) {
        this.orderRepository = orderRepository;
        this.partnerRepository = partnerRepository;
        this.skuRepository = skuRepository;
        this.inventoryRepository = inventoryRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<OutboundOrderResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());

        Page<OutboundOrder> result;
        if (status == null || status.isBlank()) {
            result = orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            OutboundOrder.Status parsed;
            try {
                parsed = OutboundOrder.Status.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw WmsException.conflict("INVALID_STATUS", "未知的单据状态：" + status);
            }
            result = orderRepository.findByStatus(parsed, pageable);
        }
        return PageResponse.of(result, OutboundOrderResponse::from);
    }

    @Transactional(readOnly = true)
    public OutboundOrderResponse get(Long id) {
        return orderRepository
                .findById(id)
                .map(OutboundOrderResponse::from)
                .orElseThrow(() -> WmsException.notFound("出库单不存在：" + id));
    }

    @Transactional
    public OutboundOrderResponse create(CreateOutboundOrderRequest request, Long operatorId) {
        Partner partner = partnerRepository
                .findById(request.partnerId())
                .orElseThrow(() -> WmsException.notFound("客户不存在：" + request.partnerId()));

        if (partner.getType() != Partner.Type.CUSTOMER) {
            throw WmsException.conflict("PARTNER_TYPE_MISMATCH", "出库单必须关联客户");
        }
        if (!partner.isActive()) {
            throw WmsException.conflict("MASTER_DATA_INACTIVE", "客户已停用");
        }

        OutboundOrder order = new OutboundOrder(
                "D" + UUID.randomUUID().toString().replace("-", "").substring(0, 30),
                partner, request.remark(), operatorId);

        Set<Long> seenSkus = new HashSet<>();
        for (CreateOutboundOrderRequest.Line line : request.lines()) {
            if (!seenSkus.add(line.skuId())) {
                throw WmsException.conflict("DUPLICATE_LINE_SKU", "同一 SKU 不能在单据中出现多次");
            }
            Sku sku = skuRepository
                    .findById(line.skuId())
                    .orElseThrow(() -> WmsException.notFound("SKU 不存在：" + line.skuId()));
            if (!sku.isActive()) {
                throw WmsException.conflict("MASTER_DATA_INACTIVE", "SKU 已停用：" + sku.getCode());
            }

            // Availability pre-check only — no reservation. The authoritative
            // check happens at confirmation under a row lock (SDD §5.3).
            int available = inventoryRepository.findAll().stream()
                    .filter(i -> i.getSkuId().equals(sku.getId()))
                    .mapToInt(i -> i.getQty())
                    .sum();
            if (available < line.expectedQty()) {
                throw WmsException.conflict("INSUFFICIENT_STOCK",
                        sku.getCode() + " 库存不足：可用 " + available + "，需要 " + line.expectedQty());
            }

            order.addLine(new OutboundLine(sku, line.expectedQty()));
        }

        orderRepository.saveAndFlush(order);
        order.assignOrderNo();
        return OutboundOrderResponse.from(order);
    }
}
