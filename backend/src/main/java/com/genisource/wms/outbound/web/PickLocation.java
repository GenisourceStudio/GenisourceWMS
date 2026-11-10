package com.genisource.wms.outbound.web;

import java.time.LocalDate;

/**
 * A live pick suggestion. {@code batchId/batchNo/expiryDate} are null when the
 * SKU has no tracked batches (legacy aggregate-only stock).
 */
public record PickLocation(
        String locationCode,
        int available,
        Long batchId,
        String batchNo,
        LocalDate expiryDate) {

    /** Legacy constructor for aggregate-only picks. */
    public PickLocation(String locationCode, int available) {
        this(locationCode, available, null, null, null);
    }
}
