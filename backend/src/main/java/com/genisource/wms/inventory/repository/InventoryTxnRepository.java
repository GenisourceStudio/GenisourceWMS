package com.genisource.wms.inventory.repository;

import com.genisource.wms.inventory.domain.InventoryTxn;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryTxnRepository extends JpaRepository<InventoryTxn, Long> {

    /** Replay support: the qty_after recorded for a confirmed line. */
    @Query("select t.qtyAfter from InventoryTxn t where t.lineId = :lineId and t.orderType = :orderType")
    Optional<Integer> findQtyAfterByLine(@Param("lineId") Long lineId, @Param("orderType") String orderType);
}
