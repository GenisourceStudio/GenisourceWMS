package com.genisource.wms.outbound.web;

import com.genisource.wms.outbound.domain.OutboundLine;
import com.genisource.wms.outbound.domain.OutboundOrder;
import java.time.OffsetDateTime;
import java.util.List;

public record OutboundOrderResponse(
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

    public static OutboundOrderResponse from(OutboundOrder order) {
        return new OutboundOrderResponse(
                order.getId(),
                order.getOrderNo(),
                order.getPartner().getId(),
                order.getPartner().getName(),
                order.getStatus().name(),
                order.getRemark(),
                order.getCreatedAt(),
                order.getCompletedAt(),
                order.getLines().stream().map(OutboundOrderResponse::line).toList());
    }

    private static LineResponse line(OutboundLine line) {
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
