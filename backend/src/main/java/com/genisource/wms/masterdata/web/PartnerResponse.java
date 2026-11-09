package com.genisource.wms.masterdata.web;

import com.genisource.wms.masterdata.domain.Partner;

public record PartnerResponse(
        Long id, String code, String name, Partner.Type type, String contact, boolean isActive) {

    public static PartnerResponse from(Partner partner) {
        return new PartnerResponse(
                partner.getId(),
                partner.getCode(),
                partner.getName(),
                partner.getType(),
                partner.getContact(),
                partner.isActive());
    }
}
