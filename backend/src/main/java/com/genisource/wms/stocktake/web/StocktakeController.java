package com.genisource.wms.stocktake.web;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.stocktake.service.StocktakeService;
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
@RequestMapping("/api/v1/stocktakes")
public class StocktakeController {

    private final StocktakeService stocktakeService;

    public StocktakeController(StocktakeService stocktakeService) {
        this.stocktakeService = stocktakeService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER', 'VIEW_INVENTORY', 'EXECUTE_TASK')")
    public PageResponse<StocktakeResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return stocktakeService.list(status, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('MANAGE_ORDER', 'VIEW_INVENTORY', 'EXECUTE_TASK')")
    public StocktakeResponse get(@PathVariable Long id) {
        return stocktakeService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public StocktakeResponse create(
            @Valid @RequestBody CreateStocktakeRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return stocktakeService.create(
                request.locationId(), request.remark(), principal == null ? null : principal.id());
    }

    @PostMapping("/{id}/lines/{lineId}/confirm")
    @PreAuthorize("hasAuthority('EXECUTE_TASK')")
    public ConfirmStocktakeResponse confirmLine(
            @PathVariable Long id,
            @PathVariable Long lineId,
            @Valid @RequestBody ConfirmStocktakeRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest) {
        return stocktakeService.confirmLine(
                id, lineId, request.actualQty(), principal, httpRequest.getRemoteAddr());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('MANAGE_ORDER')")
    public void delete(@PathVariable Long id) {
        stocktakeService.delete(id);
    }
}
