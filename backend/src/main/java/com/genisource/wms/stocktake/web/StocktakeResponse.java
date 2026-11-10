package com.genisource.wms.stocktake.web;

import com.genisource.wms.stocktake.domain.StocktakeLine;
import com.genisource.wms.stocktake.domain.StocktakeOrder;
import java.time.OffsetDateTime;
import java.util.List;

public record StocktakeResponse(
        Long id,
        String orderNo,
        Long locationId,
        String locationCode,
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
            String skuName,
            int expectedQty,
            Integer actualQty,
            String status,
            OffsetDateTime confirmedAt) {
    }

    public static StocktakeResponse from(StocktakeOrder order) {
        List<LineResponse> lines = order.getLines().stream().map(StocktakeResponse::line).toList();
        return new StocktakeResponse(
                order.getId(),
                order.getOrderNo(),
                order.getLocation().getId(),
                order.getLocation().getCode(),
                order.getStatus().name(),
                order.getRemark(),
                order.getCreatedBy(),
                order.getCreatedAt(),
                order.getCompletedAt(),
                lines);
    }

    private static LineResponse line(StocktakeLine line) {
        return new LineResponse(
                line.getId(),
                line.getSku().getId(),
                line.getSku().getCode(),
                line.getSku().getName(),
                line.getExpectedQty(),
                line.getActualQty(),
                line.getStatus().name(),
                line.getConfirmedAt());
    }
}
