package com.genisource.wms.outbound.repository;

import com.genisource.wms.outbound.domain.OutboundOrder;
import com.genisource.wms.outbound.domain.OutboundOrder.Status;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutboundOrderRepository extends JpaRepository<OutboundOrder, Long> {

    Optional<OutboundOrder> findByOrderNo(String orderNo);

    Page<OutboundOrder> findByStatus(Status status, Pageable pageable);

    Page<OutboundOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
