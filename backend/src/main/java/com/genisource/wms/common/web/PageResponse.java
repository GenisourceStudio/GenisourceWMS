package com.genisource.wms.common.web;

import java.util.List;
import org.springframework.data.domain.Page;

/** Envelope for paged lists — the same shape for every resource. */
public record PageResponse<T>(List<T> items, long total, int page, int size) {

    public static <E, T> PageResponse<T> of(Page<E> page, java.util.function.Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getTotalElements(),
                page.getNumber(),
                page.getSize());
    }
}
