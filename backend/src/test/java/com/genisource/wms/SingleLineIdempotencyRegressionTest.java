package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.genisource.wms.inventory.domain.InventoryTxn;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regression test for the single-line order bug found by the first test run.
 *
 * <p>A one-line order becomes COMPLETED on its first confirmation. The old
 * ORDER_COMPLETED guard sat before the idempotent-replay branch, so a phone
 * retrying after a lost response got 409 instead of the original 200 result.
 * These tests pin the corrected order of checks.
 *
 * <p>All writes roll back with the test-managed transaction.
 */
@SpringBootTest
@Transactional
class SingleLineIdempotencyRegressionTest extends AbstractWebIntegrationTest {

    private static final int QTY = 9;

    @Autowired private EntityManagerFactory entityManagerFactory;

    private String token;
    private String skuCode;
    private String locationCode;
    private long orderId;
    private long lineId;

    @BeforeEach
    void setUp() throws Exception {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        skuCode = "SL-SKU-" + unique;
        locationCode = "SL-LOC-" + unique;

        token = adminToken();
        long skuId = createSku(token, skuCode);
        createLocation(token, locationCode);
        long partnerId = createSupplier(token, "SL-SUP-" + unique);

        String payload = "{\"partnerId\":" + partnerId + ",\"lines\":["
                + "{\"skuId\":" + skuId + ",\"expectedQty\":" + QTY + "}]}";
        MvcResult result = mvc.perform(post("/api/v1/inbound-orders")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
        String json = body(result);
        orderId = ((Number) JsonPath.read(json, "$.id")).longValue();
        lineId = ((Number) JsonPath.read(json, "$.lines[0].id")).longValue();
        assertThat((String) JsonPath.read(json, "$.status")).isEqualTo("DRAFT");
    }

    private long txnCountForLine() {
        EntityManager em = EntityManagerFactoryUtils.getTransactionalEntityManager(entityManagerFactory);
        assertThat(em).isNotNull();
        em.flush();
        return em.createQuery(
                        "select count(t) from " + InventoryTxn.class.getName() + " t where t.lineId = :lid",
                        Long.class)
                .setParameter("lid", lineId)
                .getSingleResult();
    }

    @Test
    void singleLineOrderReplaysIdempotentlyAfterCompletion() throws Exception {
        MvcResult first = confirm(token, orderId, lineId, skuCode, locationCode, QTY, "single-1", 200);
        String firstJson = body(first);
        assertThat((String) JsonPath.read(firstJson, "$.orderStatus")).isEqualTo("COMPLETED");
        int qtyAfter = (Integer) JsonPath.read(firstJson, "$.qtyAfter");
        assertThat(qtyAfter).isEqualTo(QTY);
        assertThat(txnCountForLine()).isEqualTo(1L);

        // The order is now COMPLETED — a retry with the same token must still
        // replay the first result, not be rejected as ORDER_COMPLETED.
        MvcResult replay = confirm(token, orderId, lineId, skuCode, locationCode, QTY, "single-1", 200);
        String replayJson = body(replay);
        assertThat((Integer) JsonPath.read(replayJson, "$.qtyAfter")).isEqualTo(qtyAfter);
        assertThat((String) JsonPath.read(replayJson, "$.orderStatus")).isEqualTo("COMPLETED");
        assertThat(txnCountForLine()).as("replay must not write a second ledger row").isEqualTo(1L);
    }

    @Test
    void singleLineOrderDuplicateScanReportsDuplicateScanNotOrderCompleted() throws Exception {
        confirm(token, orderId, lineId, skuCode, locationCode, QTY, "single-2", 200);

        MvcResult duplicate = confirm(token, orderId, lineId, skuCode, locationCode, QTY, "single-3", 409);
        assertThat((String) JsonPath.read(body(duplicate), "$.code")).isEqualTo("DUPLICATE_SCAN");
        assertThat(txnCountForLine()).isEqualTo(1L);
    }
}
