package com.genisource.wms.common.web;

import org.springframework.http.HttpStatus;

/**
 * Business rule violation that maps to a stable {@code code} for the SPA.
 *
 * <p>Thrown by services; {@link GlobalExceptionHandler} turns it into the same
 * RFC 9457 shape as every other error so the client has one parser.
 */
public class WmsException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public WmsException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static WmsException notFound(String message) {
        return new WmsException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static WmsException conflict(String code, String message) {
        return new WmsException(HttpStatus.CONFLICT, code, message);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
