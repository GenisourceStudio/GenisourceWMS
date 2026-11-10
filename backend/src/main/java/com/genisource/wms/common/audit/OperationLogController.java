package com.genisource.wms.common.audit;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.genisource.wms.common.web.PageResponse;

/** Read-only view of the append-only audit trail. */
@RestController
@RequestMapping("/api/v1/operation-logs")
@PreAuthorize("hasAuthority('VIEW_AUDIT')")
public class OperationLogController {

    public record LogItem(
            Long id,
            OffsetDateTime occurredAt,
            String actorName,
            String action,
            String targetType,
            Long targetId,
            String detailJson,
            String ip) {
    }

    private final EntityManager entityManager;

    public OperationLogController(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @GetMapping
    @SuppressWarnings("unchecked")
    public PageResponse<LogItem> list(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        StringBuilder sql = new StringBuilder("""
                select id, occurred_at, actor_name, action, target_type, target_id,
                       cast(detail_json as text), ip
                from operation_log
                where 1 = 1
                """);
        List<Object> params = new ArrayList<>();
        if (action != null && !action.isBlank()) {
            sql.append(" and action = ?").append(params.size() + 1);
            params.add(action.trim());
        }
        if (actor != null && !actor.isBlank()) {
            sql.append(" and actor_name = ?").append(params.size() + 1);
            params.add(actor.trim());
        }
        // CAST instead of `::date`: Hibernate's native-query parser reads the
        // PostgreSQL shorthand as a named parameter.
        if (from != null && !from.isBlank()) {
            sql.append(" and cast(occurred_at as date) >= cast(?").append(params.size() + 1).append(" as date)");
            params.add(from.trim());
        }
        if (to != null && !to.isBlank()) {
            sql.append(" and cast(occurred_at as date) <= cast(?").append(params.size() + 1).append(" as date)");
            params.add(to.trim());
        }
        sql.append(" order by occurred_at desc, id desc");

        var query = entityManager.createNativeQuery(sql.toString(), Tuple.class);
        for (int i = 0; i < params.size(); i++) {
            query.setParameter(i + 1, params.get(i));
        }

        List<Tuple> rows = query.getResultList();
        List<LogItem> items = rows.stream()
                .map(t -> new LogItem(
                        ((Number) t.get(0)).longValue(),
                        toOffsetDateTime(t.get(1)),
                        (String) t.get(2),
                        (String) t.get(3),
                        (String) t.get(4),
                        t.get(5) == null ? null : ((Number) t.get(5)).longValue(),
                        (String) t.get(6),
                        (String) t.get(7)))
                .toList();

        int s = Math.min(Math.max(size, 1), 100);
        int offset = Math.min(Math.max(page, 0) * s, items.size());
        int end = Math.min(offset + s, items.size());
        var paged = new PageImpl<>(items.subList(offset, end), PageRequest.of(Math.max(page, 0), s), items.size());
        return PageResponse.of(paged, java.util.function.Function.identity());
    }

    private static OffsetDateTime toOffsetDateTime(Object value) {
        if (value instanceof OffsetDateTime odt) return odt;
        if (value instanceof java.time.Instant instant) {
            return instant.atOffset(java.time.ZoneOffset.ofHours(8));
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant().atOffset(java.time.ZoneOffset.ofHours(8));
        }
        throw new IllegalStateException("Unexpected timestamp type: " + value.getClass());
    }
}
