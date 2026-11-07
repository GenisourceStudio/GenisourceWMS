package com.genisource.wms.masterdata.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.repository.SkuRepository;
import com.genisource.wms.masterdata.web.CreateSkuRequest;
import com.genisource.wms.masterdata.web.SkuResponse;
import com.genisource.wms.masterdata.web.UpdateSkuRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkuService {

    private final SkuRepository skuRepository;

    public SkuService(SkuRepository skuRepository) {
        this.skuRepository = skuRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<SkuResponse> list(String keyword, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("code").ascending());

        Page<Sku> result = (keyword == null || keyword.isBlank())
                ? skuRepository.findAll(pageable)
                : skuRepository.findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(
                        keyword.trim(), keyword.trim(), pageable);

        return PageResponse.of(result, SkuResponse::from);
    }

    @Transactional
    public SkuResponse create(CreateSkuRequest request) {
        String code = request.code().trim();
        if (skuRepository.existsByCode(code)) {
            // Checked up front for a clean message; the unique constraint below
            // is still the real guarantee under concurrent creates.
            throw WmsException.conflict("DUPLICATE_SKU_CODE", "SKU 编码已存在：" + code);
        }
        Sku sku = new Sku(code, request.name().trim(), request.spec(), request.unit());
        return SkuResponse.from(skuRepository.save(sku));
    }

    @Transactional
    public SkuResponse update(Long id, UpdateSkuRequest request) {
        Sku sku = skuRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("SKU 不存在：" + id));

        sku.update(request.name().trim(), request.spec(), request.unit());
        sku.setActive(request.isActive());
        return SkuResponse.from(sku);
    }
}
