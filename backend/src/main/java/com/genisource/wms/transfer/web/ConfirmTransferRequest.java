package com.genisource.wms.transfer.web;

public record ConfirmTransferRequest(
        /** Generated once per row by the client; replays with the same token are idempotent. */
        String clientToken) {
}
