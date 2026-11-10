package com.genisource.wms.transfer.web;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.transfer.service.TransferService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transfers")
public class TransferController {

    private final TransferService transferService;

    public TransferController(TransferService transferService) {
        this.transferService = transferService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER','VIEW_INVENTORY','EXECUTE_TASK')")
    public PageResponse<TransferResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return transferService.list(status, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER','VIEW_INVENTORY','EXECUTE_TASK')")
    public TransferResponse get(@PathVariable Long id) {
        return transferService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public TransferResponse create(
            @Valid @RequestBody CreateTransferRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return transferService.create(request, principal == null ? null : principal.id());
    }

    @PostMapping("/{id}/lines/{lineId}/confirm")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public ConfirmTransferResponse confirm(
            @PathVariable Long id,
            @PathVariable Long lineId,
            @Valid @RequestBody(required = false) ConfirmTransferRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest) {
        String clientToken = request == null ? null : request.clientToken();
        return transferService.confirmLine(
                id, lineId, clientToken, principal, httpRequest.getRemoteAddr());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public void delete(@PathVariable Long id) {
        transferService.delete(id);
    }
}
