package com.genisource.wms.masterdata.repository;

import com.genisource.wms.masterdata.domain.StorageLocation;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocationRepository extends JpaRepository<StorageLocation, Long> {

    Optional<StorageLocation> findByCode(String code);

    boolean existsByCode(String code);

    Page<StorageLocation> findByCodeContainingIgnoreCaseOrAreaContainingIgnoreCase(
            String code, String area, Pageable pageable);
}
