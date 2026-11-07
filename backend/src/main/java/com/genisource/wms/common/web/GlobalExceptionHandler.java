package com.genisource.wms.common.web;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Translates exceptions into RFC 9457 problem details so every client — the PC
 * console, the mobile scanner, a future ERP integration — sees one error shape.
 *
 * <p>Besides the standard fields, each problem carries a {@code code} extension
 * property. The SPA switches on it to show an inline, localised message next to
 * the field or scan box (docs/design-system.md §6) instead of a global toast.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    public GlobalExceptionHandler(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        ProblemDetail problem = problem(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "error.validation");
        problem.setProperty("errors", fieldErrors);
        return problem;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegalArgument(IllegalArgumentException ex) {
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "error.bad-request");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ProblemDetail handleBadCredentials(BadCredentialsException ex) {
        return problem(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "error.login-failed");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        return problem(HttpStatus.FORBIDDEN, "FORBIDDEN", "error.forbidden");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNotFound(NoResourceFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "NOT_FOUND", "error.not-found");
    }

    private ProblemDetail problem(HttpStatus status, String code, String messageKey) {
        String message = messageSource.getMessage(messageKey, null, LocaleContextHolder.getLocale());
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(message);
        problem.setDetail(message);
        problem.setProperty("code", code);
        return problem;
    }
}
