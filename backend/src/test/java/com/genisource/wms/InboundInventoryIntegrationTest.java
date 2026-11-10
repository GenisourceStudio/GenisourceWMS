package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.genisource.wms.common.audit.OperationLog;
import com.genisource.wms.common.audit.OperationLogRepository;
import com.genisource.wms.inventory.domain.InventoryTxn;
import com.genisource.wms.inventory.repository.InventoryRepository;
import com.genisource.wms.inventory.repository.InventoryTxnRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * The core accounting invariant, exercised end-to-end: create master data and
 * an inbound order, confirm a line by scan, and verify that one transaction
 * writes exactly one ledger row, one audit row and the correct inventory.qty —
 * and that replays / mis-scans never double-count or write on rejection.
 *
 * <p>A two-line order is used so the order stays PARTIAL after the first line
 * is confirmed — required to reach the idempotent-replay and duplicate-scan
 * branches of {@code InboundConfirmationService.confirm} (a one-line order is
 * marked COMPLETED immediately, which short-circuits those branches; that is a
 * business-code bug reported separately, not something these tests change).
 *
 * <p>All writes happen inside the test-managed {@code @Transactional} and are
 * rolled back at the end, so the append-only ledger and operation_log stay
 * untouched in the dev database.
 */
@SpringBootTest
@Transactional
class InboundInventoryIntegrationTest extends AbstractWebIntegrationTest {

    private static final int QTY1 = 20;
    private static final int QTY2 = 7;

    @Autowired private InventoryRepository inventoryRepository;
    @Autowired private InventoryTxnRepository txnRepository;
    @Autowired private OperationLogRepository operationLogRepository;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private String token;
    private String skuCode1;
    private String skuCode2;
    private String locationCode;
    private long skuId1;
    private long skuId2;
    private long locationId;
    private CreatedOrder order;

    @BeforeEach
    void setUp() throws Exception {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        skuCode1 = "IT-SKU-" + unique + "-A";
        skuCode2 = "IT-SKU-" + unique + "-B";
        locationCode = "IT-LOC-" + unique;
        String partnerCode = "IT-SUP-" + unique;

        token = adminToken();
        skuId1 = createSku(token, skuCode1);
        skuId2 = createSku(token, skuCode2);
        locationId = createLocation(token, locationCode);
        long partnerId = createSupplier(token, partnerCode);
        order = createInboundOrder(token, partnerId, skuId1, QTY1, skuId2, QTY2);
    }

    /** Returns the EntityManager bound to the active test transaction. */
    private EntityManager em() {
        EntityManager em = EntityManagerFactoryUtils.getTransactionalEntityManager(entityManagerFactory);
        assertThat(em).as("a transactional EntityManager must be bound").isNotNull();
        return em;
    }

    private long txnCountForLine(long lineId) {
        em().flush();
        return em().createQuery(
                        "select count(t) from " + InventoryTxn.class.getName() + " t where t.lineId = :lid",
                        Long.class)
                .setParameter("lid", lineId)
                .getSingleResult();
    }

    private long opLogCountForInventory(long inventoryId) {
        em().flush();
        return em().createQuery(
                        "select count(l) from " + OperationLog.class.getName() + " l where l.targetId = :tid",
                        Long.class)
                .setParameter("tid", inventoryId)
                .getSingleResult();
    }

    @Test
    void wrongSkuScanReturnsConflictAndWritesNothing() throws Exception {
        long logsBefore = operationLogRepository.count();

        MvcResult result = confirm(token, order.orderId(), order.lineId1(),
                skuCode1 + "-WRONG", locationCode, QTY1, "tok-wrong", 409);
        assertThat((String) JsonPath.read(body(result), "$.code")).isEqualTo("SKU_MISMATCH");

        // A rejected scan must not touch inventory, the ledger or the audit trail.
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)).isEmpty();
        assertThat(txnRepository.findQtyAfterByLine(order.lineId1(), "INBOUND")).isEmpty();
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(0L);
        assertThat(operationLogRepository.count()).isEqualTo(logsBefore);
    }

    @Test
    void confirmIncrementsInventoryWritesExactlyOneLedgerAndAuditLog() throws Exception {
        MvcResult result = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, "tok-ok", 200);

        assertThat(((Number) JsonPath.read(body(result), "$.qtyAfter")).intValue()).isEqualTo(QTY1);
        assertThat((String) JsonPath.read(body(result), "$.lineStatus")).isEqualTo("DONE");
        // The second line is still pending, so the order is PARTIAL.
        assertThat((String) JsonPath.read(body(result), "$.orderStatus")).isEqualTo("PARTIAL");

        // inventory.qty increased by exactly the confirmed quantity.
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)).isPresent();
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)
                .orElseThrow().getQty()).isEqualTo(QTY1);
        long inventoryId = inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)
                .orElseThrow().getId();

        // exactly one ledger row and one audit row for this confirmation.
        assertThat(txnRepository.findQtyAfterByLine(order.lineId1(), "INBOUND")).isPresent();
        assertThat(txnRepository.findQtyAfterByLine(order.lineId1(), "INBOUND").orElseThrow())
                .isEqualTo(QTY1);
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(1L);
        assertThat(opLogCountForInventory(inventoryId)).isEqualTo(1L);
    }

    @Test
    void replayWithSameClientTokenDoesNotDoubleCount() throws Exception {
        String clientToken = "replay-" + UUID.randomUUID().toString().substring(0, 8);

        MvcResult first = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, clientToken, 200);
        assertThat(((Number) JsonPath.read(body(first), "$.qtyAfter")).intValue()).isEqualTo(QTY1);
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(1L);
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)
                .orElseThrow().getQty()).isEqualTo(QTY1);

        MvcResult replay = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, clientToken, 200);
        assertThat(((Number) JsonPath.read(body(replay), "$.qtyAfter")).intValue()).isEqualTo(QTY1);
        assertThat((String) JsonPath.read(body(replay), "$.lineStatus")).isEqualTo("DONE");

        // Idempotent replay: still exactly one ledger row, qty still QTY1.
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(1L);
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)
                .orElseThrow().getQty()).isEqualTo(QTY1);
    }

    @Test
    void duplicateScanWithDifferentTokenReturnsConflict() throws Exception {
        confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, "tok-first", 200);

        MvcResult duplicate = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, "tok-second", 409);
        assertThat((String) JsonPath.read(body(duplicate), "$.code")).isEqualTo("DUPLICATE_SCAN");

        // The rejected duplicate must not add a second ledger row.
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(1L);
    }

    @Test
    void confirmAllLinesCompletesTheOrder() throws Exception {
        MvcResult first = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, "tok-l1", 200);
        assertThat((String) JsonPath.read(body(first), "$.orderStatus")).isEqualTo("PARTIAL");

        MvcResult second = confirm(token, order.orderId(), order.lineId2(),
                skuCode2, locationCode, QTY2, "tok-l2", 200);
        assertThat(((Number) JsonPath.read(body(second), "$.qtyAfter")).intValue()).isEqualTo(QTY2);
        assertThat((String) JsonPath.read(body(second), "$.orderStatus")).isEqualTo("COMPLETED");

        // Both SKUs are on the books, one ledger row per line.
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId1, locationId)
                .orElseThrow().getQty()).isEqualTo(QTY1);
        assertThat(inventoryRepository.findBySkuIdAndLocationId(skuId2, locationId)
                .orElseThrow().getQty()).isEqualTo(QTY2);
        assertThat(txnCountForLine(order.lineId1())).isEqualTo(1L);
        assertThat(txnCountForLine(order.lineId2())).isEqualTo(1L);
    }

    @Test
    void inventoryReadEndpointsReflectConfirmedStock() throws Exception {
        MvcResult result = confirm(token, order.orderId(), order.lineId1(),
                skuCode1, locationCode, QTY1, "tok-read", 200);
        assertThat(((Number) JsonPath.read(body(result), "$.qtyAfter")).intValue()).isEqualTo(QTY1);

        // Inventory view shows the new balance.
        mvc.perform(get("/api/v1/inventory").param("skuId", Long.toString(skuId1))
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].qty").value(QTY1))
                .andExpect(jsonPath("$.items[0].locationCode").value(locationCode));

        // Ledger view shows exactly the one INBOUND transaction for this order.
        mvc.perform(get("/api/v1/inventory/transactions").param("orderNo", order.orderNo())
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].type").value("INBOUND"))
                .andExpect(jsonPath("$.items[0].qtyDelta").value(QTY1))
                .andExpect(jsonPath("$.items[0].orderNo").value(order.orderNo()));
    }
}
