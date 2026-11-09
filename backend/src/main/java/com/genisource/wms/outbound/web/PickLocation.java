package com.genisource.wms.outbound.web;

/** A live pick suggestion: where to take stock from, and how much is there. */
public record PickLocation(String locationCode, int available) {
}
