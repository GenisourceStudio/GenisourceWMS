package com.genisource.wms.batch.repository;

import com.genisource.wms.batch.domain.InventoryBatch;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryBatchRepository extends JpaRepository<InventoryBatch, Long> {

    Optional<InventoryBatch> findBySkuIdAndLocationIdAndBatchId(
            Long skuId, Long locationId, Long batchId);

    List<InventoryBatch> findBySkuId(Long skuId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from InventoryBatch b where b.skuId = :skuId and b.locationId = :locationId and b.batchId = :batchId")
    Optional<InventoryBatch> lockOne(
            @Param("skuId") Long skuId,
            @Param("locationId") Long locationId,
            @Param("batchId") Long batchId);
}
