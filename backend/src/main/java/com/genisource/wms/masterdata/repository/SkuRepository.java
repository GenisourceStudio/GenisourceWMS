package com.genisource.wms.masterdata.repository;

import com.genisource.wms.masterdata.domain.Sku;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkuRepository extends JpaRepository<Sku, Long> {

    Optional<Sku> findByCode(String code);

    boolean existsByCode(String code);

    Page<Sku> findByCodeContainingIgnoreCaseOrNameContainingIgnoreCase(
            String code, String name, Pageable pageable);
}
