package com.genisource.wms.inbound.repository;

import com.genisource.wms.inbound.domain.InboundOrder;
import com.genisource.wms.inbound.domain.InboundOrder.Status;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InboundOrderRepository extends JpaRepository<InboundOrder, Long> {

    Optional<InboundOrder> findByOrderNo(String orderNo);

    Page<InboundOrder> findByStatus(Status status, Pageable pageable);

    Page<InboundOrder> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
