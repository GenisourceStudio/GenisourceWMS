package com.genisource.wms.stocktake.repository;

import com.genisource.wms.stocktake.domain.StocktakeOrder;
import com.genisource.wms.stocktake.domain.StocktakeOrder.Status;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StocktakeOrderRepository extends JpaRepository<StocktakeOrder, Long> {

    Optional<StocktakeOrder> findByOrderNo(String orderNo);

    Page<StocktakeOrder> findByStatus(Status status, Pageable pageable);

    Page<StocktakeOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
