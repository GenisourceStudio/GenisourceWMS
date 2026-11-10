package com.genisource.wms.transfer.repository;

import com.genisource.wms.transfer.domain.TransferOrder;
import com.genisource.wms.transfer.domain.TransferOrder.Status;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransferOrderRepository extends JpaRepository<TransferOrder, Long> {

    Optional<TransferOrder> findByOrderNo(String orderNo);

    Page<TransferOrder> findByStatus(Status status, Pageable pageable);

    Page<TransferOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
