package com.genisource.wms.transfer.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateTransferRequest(
        String remark,
        @NotEmpty @Valid List<Line> lines) {

    public record Line(
            @NotNull Long skuId,
            @NotNull Long fromLocationId,
            @NotNull Long toLocationId,
            @NotNull @Min(1) Integer qty) {
    }
}
