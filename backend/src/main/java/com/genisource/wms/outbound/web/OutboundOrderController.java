package com.genisource.wms.outbound.web;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.inbound.web.ConfirmLineResponse;
import com.genisource.wms.outbound.service.OutboundConfirmationService;
import com.genisource.wms.outbound.service.OutboundOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/outbound-orders")
public class OutboundOrderController {

    private final OutboundOrderService orderService;
    private final OutboundConfirmationService confirmationService;

    public OutboundOrderController(OutboundOrderService orderService, OutboundConfirmationService confirmationService) {
        this.orderService = orderService;
        this.confirmationService = confirmationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER', 'EXECUTE_TASK')")
    public PageResponse<OutboundOrderResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return orderService.list(status, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER', 'EXECUTE_TASK')")
    public OutboundOrderResponse get(@PathVariable Long id) {
        return orderService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public OutboundOrderResponse create(
            @Valid @RequestBody CreateOutboundOrderRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return orderService.create(request, principal == null ? null : principal.id());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public OutboundOrderResponse update(
            @PathVariable Long id, @Valid @RequestBody CreateOutboundOrderRequest request) {
        return orderService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public void delete(@PathVariable Long id) {
        orderService.delete(id);
    }

    @GetMapping("/{id}/task")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public OutboundTaskResponse task(@PathVariable Long id) {
        return confirmationService.task(id);
    }

    @PostMapping("/{id}/lines/{lineId}/confirm")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public ConfirmLineResponse confirm(
            @PathVariable Long id,
            @PathVariable Long lineId,
            @Valid @RequestBody ConfirmOutboundLineRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest) {
        return confirmationService.confirm(id, lineId, request, principal, httpRequest.getRemoteAddr());
    }
}
