package com.genisource.wms.inbound.web;

import com.genisource.wms.inbound.domain.InboundLine;
import com.genisource.wms.inbound.domain.InboundOrder;
import java.time.OffsetDateTime;
import java.util.List;

public record InboundOrderResponse(
        Long id,
        String orderNo,
        Long partnerId,
        String partnerName,
        String status,
        String remark,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt,
        List<LineResponse> lines) {

    public record LineResponse(
            Long id,
            Long skuId,
            String skuCode,
            String skuName,
            int expectedQty,
            int confirmedQty,
            Long locationId,
            String locationCode,
            String status) {
    }

    public static InboundOrderResponse from(InboundOrder order) {
        List<LineResponse> lines = order.getLines().stream().map(InboundOrderResponse::line).toList();
        return new InboundOrderResponse(
                order.getId(),
                order.getOrderNo(),
                order.getPartner().getId(),
                order.getPartner().getName(),
                order.getStatus().name(),
                order.getRemark(),
                order.getCreatedAt(),
                order.getCompletedAt(),
                lines);
    }

    private static LineResponse line(InboundLine line) {
        return new LineResponse(
                line.getId(),
                line.getSku().getId(),
                line.getSku().getCode(),
                line.getSku().getName(),
                line.getExpectedQty(),
                line.getConfirmedQty(),
                line.getLocation() == null ? null : line.getLocation().getId(),
                line.getLocation() == null ? null : line.getLocation().getCode(),
                line.getStatus().name());
    }
}
