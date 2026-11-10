package com.genisource.wms.batch.repository;

import com.genisource.wms.batch.domain.SkuBatch;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkuBatchRepository extends JpaRepository<SkuBatch, Long> {

    Optional<SkuBatch> findBySkuIdAndBatchNo(Long skuId, String batchNo);
}
