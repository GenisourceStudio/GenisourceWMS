package com.genisource.wms.inventory.repository;

import com.genisource.wms.inventory.domain.Inventory;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findBySkuIdAndLocationId(Long skuId, Long locationId);

    /** Row-level lock for outbound deductions (SDD §5.3). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventory i where i.skuId = :skuId and i.locationId = :locationId")
    Optional<Inventory> lockBySkuAndLocation(
            @Param("skuId") Long skuId, @Param("locationId") Long locationId);
}
