package com.genisource.wms.inbound.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.inbound.domain.InboundLine;
import com.genisource.wms.inbound.domain.InboundOrder;
import com.genisource.wms.inbound.repository.InboundOrderRepository;
import com.genisource.wms.inbound.web.CreateInboundOrderRequest;
import com.genisource.wms.inbound.web.InboundOrderResponse;
import com.genisource.wms.masterdata.domain.Partner;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.repository.PartnerRepository;
import com.genisource.wms.masterdata.repository.SkuRepository;
import java.util.ArrayList;
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
public class InboundOrderService {

    private final InboundOrderRepository orderRepository;
    private final PartnerRepository partnerRepository;
    private final SkuRepository skuRepository;

    public InboundOrderService(
            InboundOrderRepository orderRepository,
            PartnerRepository partnerRepository,
            SkuRepository skuRepository) {
        this.orderRepository = orderRepository;
        this.partnerRepository = partnerRepository;
        this.skuRepository = skuRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<InboundOrderResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());

        Page<InboundOrder> result;
        if (status == null || status.isBlank()) {
            result = orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            InboundOrder.Status parsed;
            try {
                parsed = InboundOrder.Status.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw WmsException.conflict("INVALID_STATUS", "未知的单据状态：" + status);
            }
            result = orderRepository.findByStatus(parsed, pageable);
        }
        return PageResponse.of(result, InboundOrderResponse::from);
    }

    @Transactional(readOnly = true)
    public InboundOrderResponse get(Long id) {
        return orderRepository
                .findById(id)
                .map(InboundOrderResponse::from)
                .orElseThrow(() -> WmsException.notFound("入库单不存在：" + id));
    }

    @Transactional
    public InboundOrderResponse create(CreateInboundOrderRequest request, Long operatorId) {
        Partner partner = partnerRepository
                .findById(request.partnerId())
                .orElseThrow(() -> WmsException.notFound("供应商不存在：" + request.partnerId()));

        if (partner.getType() != Partner.Type.SUPPLIER) {
            throw WmsException.conflict("PARTNER_TYPE_MISMATCH", "入库单必须关联供应商");
        }
        if (!partner.isActive()) {
            throw WmsException.conflict("MASTER_DATA_INACTIVE", "供应商已停用");
        }

        // A draft number only lives inside this transaction; flush assigns the id
        // that becomes the sequence suffix (SDD §5.5). Must fit VARCHAR(32).
        InboundOrder order = new InboundOrder(
                "D" + UUID.randomUUID().toString().replace("-", "").substring(0, 30), partner, request.remark(), operatorId);

        Set<Long> seenSkus = new HashSet<>();
        List<CreateInboundOrderRequest.Line> lines = new ArrayList<>(request.lines());
        for (CreateInboundOrderRequest.Line line : lines) {
            if (!seenSkus.add(line.skuId())) {
                throw WmsException.conflict("DUPLICATE_LINE_SKU", "同一 SKU 不能在单据中出现多次");
            }
            Sku sku = skuRepository
                    .findById(line.skuId())
                    .orElseThrow(() -> WmsException.notFound("SKU 不存在：" + line.skuId()));
            if (!sku.isActive()) {
                throw WmsException.conflict("MASTER_DATA_INACTIVE", "SKU 已停用：" + sku.getCode());
            }
            order.addLine(new InboundLine(sku, line.expectedQty()));
        }

        orderRepository.saveAndFlush(order);
        order.assignOrderNo("RK");
        return InboundOrderResponse.from(order);
    }
}
