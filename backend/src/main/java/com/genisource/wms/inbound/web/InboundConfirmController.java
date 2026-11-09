package com.genisource.wms.inbound.web;

import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.inbound.service.InboundConfirmationService;
import com.genisource.wms.inbound.service.InboundOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inbound-orders")
public class InboundConfirmController {

    private final InboundConfirmationService confirmationService;
    private final InboundOrderService orderService;

    public InboundConfirmController(
            InboundConfirmationService confirmationService, InboundOrderService orderService) {
        this.confirmationService = confirmationService;
        this.orderService = orderService;
    }

    /** The mobile job view: lines with SKU names, expected quantities and progress. */
    @org.springframework.web.bind.annotation.GetMapping("/{id}/task")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public InboundOrderResponse task(@PathVariable Long id) {
        return orderService.get(id);
    }

    /**
     * Confirms one line by scan. All stock writes go through
     * InboundConfirmationService in a single transaction (SDD §5.2).
     */
    @PostMapping("/{id}/lines/{lineId}/confirm")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public ConfirmLineResponse confirm(
            @PathVariable Long id,
            @PathVariable Long lineId,
            @Valid @RequestBody ConfirmLineRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest) {
        return confirmationService.confirm(id, lineId, request, principal, httpRequest.getRemoteAddr());
    }
}
