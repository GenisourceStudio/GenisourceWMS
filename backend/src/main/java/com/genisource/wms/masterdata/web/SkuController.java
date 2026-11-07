package com.genisource.wms.masterdata.web;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.masterdata.service.SkuService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/v1/skus")
@PreAuthorize("hasAuthority('MANAGE_MASTER')")
public class SkuController {

    private final SkuService skuService;

    public SkuController(SkuService skuService) {
        this.skuService = skuService;
    }

    @GetMapping
    public PageResponse<SkuResponse> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return skuService.list(keyword, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SkuResponse create(@Valid @RequestBody CreateSkuRequest request) {
        return skuService.create(request);
    }

    @PutMapping("/{id}")
    public SkuResponse update(@PathVariable Long id, @Valid @RequestBody UpdateSkuRequest request) {
        return skuService.update(id, request);
    }
}
