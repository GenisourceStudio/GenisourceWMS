package com.genisource.wms.masterdata.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.masterdata.domain.Partner;
import com.genisource.wms.masterdata.repository.PartnerRepository;
import com.genisource.wms.masterdata.web.PartnerRequest;
import com.genisource.wms.masterdata.web.PartnerResponse;
import com.genisource.wms.masterdata.web.UpdatePartnerRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PartnerService {

    private final PartnerRepository partnerRepository;

    public PartnerService(PartnerRepository partnerRepository) {
        this.partnerRepository = partnerRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<PartnerResponse> list(Partner.Type type, String keyword, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("code").ascending());

        Page<Partner> result;
        if (type == null) {
            result = partnerRepository.findAll(pageable);
        } else if (keyword == null || keyword.isBlank()) {
            result = partnerRepository.findByType(type, pageable);
        } else {
            result = partnerRepository.findByTypeAndNameContainingIgnoreCase(type, keyword.trim(), pageable);
        }

        return PageResponse.of(result, PartnerResponse::from);
    }

    @Transactional
    public PartnerResponse create(PartnerRequest request) {
        String code = request.code().trim();
        if (partnerRepository.existsByCode(code)) {
            throw WmsException.conflict("DUPLICATE_PARTNER_CODE", "往来单位编码已存在：" + code);
        }
        Partner partner = new Partner(code, request.name().trim(), request.type(), request.contact());
        return PartnerResponse.from(partnerRepository.save(partner));
    }

    @Transactional
    public PartnerResponse update(Long id, UpdatePartnerRequest request) {
        Partner partner = partnerRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("往来单位不存在：" + id));

        partner.update(request.name().trim(), request.contact(), request.isActive());
        return PartnerResponse.from(partner);
    }
}
