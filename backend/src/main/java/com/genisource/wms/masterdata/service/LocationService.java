package com.genisource.wms.masterdata.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.masterdata.domain.StorageLocation;
import com.genisource.wms.masterdata.repository.LocationRepository;
import com.genisource.wms.masterdata.web.CreateLocationRequest;
import com.genisource.wms.masterdata.web.LocationResponse;
import com.genisource.wms.masterdata.web.UpdateLocationRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LocationService {

    private final LocationRepository locationRepository;

    public LocationService(LocationRepository locationRepository) {
        this.locationRepository = locationRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<LocationResponse> list(String keyword, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("code").ascending());

        Page<StorageLocation> result = (keyword == null || keyword.isBlank())
                ? locationRepository.findAll(pageable)
                : locationRepository.findByCodeContainingIgnoreCaseOrAreaContainingIgnoreCase(
                        keyword.trim(), keyword.trim(), pageable);

        return PageResponse.of(result, LocationResponse::from);
    }

    @Transactional
    public LocationResponse create(CreateLocationRequest request) {
        String code = request.code().trim();
        if (locationRepository.existsByCode(code)) {
            throw WmsException.conflict("DUPLICATE_LOCATION_CODE", "库位编码已存在：" + code);
        }
        StorageLocation location = new StorageLocation(code, request.area(), request.remark());
        return LocationResponse.from(locationRepository.save(location));
    }

    @Transactional
    public LocationResponse update(Long id, UpdateLocationRequest request) {
        StorageLocation location = locationRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("库位不存在：" + id));

        location.update(request.area(), request.remark(), request.isActive());
        return LocationResponse.from(location);
    }
}
