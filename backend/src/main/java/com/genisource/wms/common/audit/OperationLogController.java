package com.genisource.wms.common.audit;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import java.time.OffsetDateTime;
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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        String sql = """
                select id, occurred_at, actor_name, action, target_type, target_id,
                       cast(detail_json as text), ip
                from operation_log
                """ + (action == null || action.isBlank() ? "" : " where action = ?1 ")
                + " order by occurred_at desc, id desc";

        var query = entityManager.createNativeQuery(sql, Tuple.class);
        if (action != null && !action.isBlank()) {
            query.setParameter(1, action.trim());
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
        int from = Math.min(Math.max(page, 0) * s, items.size());
        int to = Math.min(from + s, items.size());
        var paged = new PageImpl<>(items.subList(from, to), PageRequest.of(Math.max(page, 0), s), items.size());
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
