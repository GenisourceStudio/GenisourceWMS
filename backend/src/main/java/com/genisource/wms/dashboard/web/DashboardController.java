package com.genisource.wms.dashboard.web;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The four KPI tiles in the dashboard Hero (design-system.md §5.2). */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    public record Summary(
            long pendingOrders,
            long todayInbound,
            long todayOutbound,
            long stockTotal) {
    }

    private final EntityManager entityManager;

    public DashboardController(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('VIEW_DASHBOARD')")
    public Summary summary() {
        Tuple row = (Tuple) entityManager.createNativeQuery("""
                select
                  (select count(*) from inbound_order where status <> 'COMPLETED')
                  + (select count(*) from outbound_order where status <> 'COMPLETED'),
                  (select coalesce(sum(qty_delta), 0) from inventory_txn
                     where type = 'INBOUND' and occurred_at >= current_date),
                  (select coalesce(-sum(qty_delta), 0) from inventory_txn
                     where type = 'OUTBOUND' and occurred_at >= current_date),
                  (select coalesce(sum(qty), 0) from inventory)
                """, Tuple.class).getSingleResult();

        return new Summary(
                number(row.get(0)),
                number(row.get(1)),
                number(row.get(2)),
                number(row.get(3)));
    }

    private static long number(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }
}
