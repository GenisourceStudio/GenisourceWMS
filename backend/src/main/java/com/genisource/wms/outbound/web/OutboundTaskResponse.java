package com.genisource.wms.outbound.web;

import java.util.List;

/** Task view: one entry per pending line with live pick suggestions. */
public record OutboundTaskResponse(
        Long id,
        String orderNo,
        String partnerName,
        String status,
        List<Line> lines) {

    public record Line(
            Long id,
            String skuCode,
            String skuName,
            int expectedQty,
            String status,
            List<PickLocation> pickLocations) {
    }
}
