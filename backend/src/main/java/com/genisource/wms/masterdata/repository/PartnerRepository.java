package com.genisource.wms.masterdata.repository;

import com.genisource.wms.masterdata.domain.Partner;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerRepository extends JpaRepository<Partner, Long> {

    Optional<Partner> findByIdAndType(Long id, Partner.Type type);

    boolean existsByCode(String code);

    Page<Partner> findByTypeAndNameContainingIgnoreCase(Partner.Type type, String name, Pageable pageable);

    Page<Partner> findByType(Partner.Type type, Pageable pageable);
}
