package com.genisource.wms.transfer.web;

import com.genisource.wms.transfer.domain.TransferLine;
import com.genisource.wms.transfer.domain.TransferOrder;
import java.time.OffsetDateTime;
import java.util.List;

public record TransferResponse(
        Long id,
        String orderNo,
        String status,
        String remark,
        Long createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt,
        List<LineResponse> lines) {

    public record LineResponse(
            Long id,
            Long skuId,
            String skuCode,
            Long fromLocationId,
            String fromLocationCode,
            Long toLocationId,
            String toLocationCode,
            int qty,
            String status) {
    }

    /** Must run inside the service transaction: the line associations are LAZY. */
    public static TransferResponse from(TransferOrder order) {
        List<LineResponse> lines = order.getLines().stream().map(TransferResponse::line).toList();
        return new TransferResponse(
                order.getId(),
                order.getOrderNo(),
                order.getStatus().name(),
                order.getRemark(),
                order.getCreatedBy(),
                order.getCreatedAt(),
                order.getCompletedAt(),
                lines);
    }

    private static LineResponse line(TransferLine line) {
        return new LineResponse(
                line.getId(),
                line.getSku().getId(),
                line.getSku().getCode(),
                line.getFromLocation().getId(),
                line.getFromLocation().getCode(),
                line.getToLocation().getId(),
                line.getToLocation().getCode(),
                line.getQty(),
                line.getStatus().name());
    }
}
