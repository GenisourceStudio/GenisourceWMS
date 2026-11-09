package com.genisource.wms.inventory.web;

import com.genisource.wms.common.web.PageResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only views over inventory and the append-only ledger.
 *
 * <p>Native SQL is built dynamically instead of using ":param is null"
 * predicates: PostgreSQL cannot infer the type of a bare null parameter and
 * rejects the query with "could not determine data type of parameter $1".
 */
@RestController
@RequestMapping("/api/v1/inventory")
@PreAuthorize("hasAuthority('VIEW_INVENTORY')")
public class InventoryController {

    private final EntityManager entityManager;

    public InventoryController(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @GetMapping
    public PageResponse<InventoryItem> list(
            @RequestParam(required = false) Long skuId,
            @RequestParam(required = false) Long locationId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        StringBuilder sql = new StringBuilder("""
                select i.sku_id, s.code, s.name, i.location_id, l.code, i.qty, i.updated_at
                from inventory i
                join sku s on s.id = i.sku_id
                join location l on l.id = i.location_id
                where 1 = 1
                """);
        List<Object> params = new ArrayList<>();
        if (skuId != null) {
            sql.append(" and i.sku_id = ?").append(params.size() + 1);
            params.add(skuId);
        }
        if (locationId != null) {
            sql.append(" and i.location_id = ?").append(params.size() + 1);
            params.add(locationId);
        }
        sql.append(" order by s.code, l.code");

        List<InventoryItem> items = queryTuples(sql.toString(), params).stream()
                .map(t -> new InventoryItem(
                        number(t.get(0)).longValue(),
                        (String) t.get(1),
                        (String) t.get(2),
                        number(t.get(3)).longValue(),
                        (String) t.get(4),
                        number(t.get(5)).intValue(),
                        toOffsetDateTime(t.get(6))))
                .filter(i -> matchesKeyword(keyword, i.skuCode(), i.skuName(), i.locationCode()))
                .toList();

        return page(items, page, size, Function.identity());
    }

    @GetMapping("/transactions")
    public PageResponse<InventoryTxnItem> transactions(
            @RequestParam(required = false) String orderNo,
            @RequestParam(required = false) Long skuId,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        StringBuilder sql = new StringBuilder("""
                select t.id, t.occurred_at, t.type, s.code, l.code,
                       t.qty_delta, t.qty_after, t.order_no, t.line_id,
                       coalesce(u.display_name, '—')
                from inventory_txn t
                join sku s on s.id = t.sku_id
                join location l on l.id = t.location_id
                left join app_user u on u.id = t.operator_id
                where 1 = 1
                """);
        List<Object> params = new ArrayList<>();
        if (orderNo != null && !orderNo.isBlank()) {
            sql.append(" and t.order_no = ?").append(params.size() + 1);
            params.add(orderNo.trim());
        }
        if (skuId != null) {
            sql.append(" and t.sku_id = ?").append(params.size() + 1);
            params.add(skuId);
        }
        if (type != null && !type.isBlank()) {
            sql.append(" and t.type = ?").append(params.size() + 1);
            params.add(type.trim().toUpperCase());
        }
        sql.append(" order by t.occurred_at desc, t.id desc");

        List<InventoryTxnItem> items = queryTuples(sql.toString(), params).stream()
                .map(t -> new InventoryTxnItem(
                        number(t.get(0)).longValue(),
                        toOffsetDateTime(t.get(1)),
                        (String) t.get(2),
                        (String) t.get(3),
                        (String) t.get(4),
                        number(t.get(5)).intValue(),
                        number(t.get(6)).intValue(),
                        (String) t.get(7),
                        number(t.get(8)).longValue(),
                        (String) t.get(9)))
                .toList();

        return page(items, page, size, Function.identity());
    }

    @SuppressWarnings("unchecked")
    private List<Tuple> queryTuples(String sql, List<Object> params) {
        var query = entityManager.createNativeQuery(sql, Tuple.class);
        for (int i = 0; i < params.size(); i++) {
            query.setParameter(i + 1, params.get(i));
        }
        return query.getResultList();
    }

    private static Number number(Object value) {
        return (Number) value;
    }

    /** Hibernate may hand back OffsetDateTime or Timestamp depending on the driver path. */
    private static OffsetDateTime toOffsetDateTime(Object value) {
        if (value instanceof OffsetDateTime odt) {
            return odt;
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().atOffset(java.time.ZoneOffset.ofHours(8));
        }
        if (value instanceof java.time.Instant instant) {
            return instant.atOffset(java.time.ZoneOffset.ofHours(8));
        }
        throw new IllegalStateException("Unexpected timestamp type: " + value.getClass());
    }

    private static boolean matchesKeyword(String keyword, String... values) {
        if (keyword == null || keyword.isBlank()) {
            return true;
        }
        String needle = keyword.trim().toLowerCase();
        for (String value : values) {
            if (value != null && value.toLowerCase().contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static <T> PageResponse<T> page(List<T> items, int page, int size, Function<T, T> mapper) {
        int s = Math.min(Math.max(size, 1), 100);
        int from = Math.min(Math.max(page, 0) * s, items.size());
        int to = Math.min(from + s, items.size());
        var paged = new PageImpl<>(items.subList(from, to), PageRequest.of(Math.max(page, 0), s), items.size());
        return PageResponse.of(paged, mapper);
    }
}
