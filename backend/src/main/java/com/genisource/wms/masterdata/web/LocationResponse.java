package com.genisource.wms.masterdata.web;

import com.genisource.wms.masterdata.domain.StorageLocation;

public record LocationResponse(Long id, String code, String area, String remark, boolean isActive) {

    public static LocationResponse from(StorageLocation location) {
        return new LocationResponse(
                location.getId(),
                location.getCode(),
                location.getArea(),
                location.getRemark(),
                location.isActive());
    }
}
