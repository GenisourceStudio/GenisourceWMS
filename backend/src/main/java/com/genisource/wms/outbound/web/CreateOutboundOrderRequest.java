package com.genisource.wms.outbound.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateOutboundOrderRequest(
        @NotNull Long partnerId,
        String remark,
        @NotEmpty @Valid List<Line> lines) {

    public record Line(
            @NotNull Long skuId,
            @Min(1) Integer expectedQty) {
    }
}
