package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * C1: draft orders can be edited and deleted; orders that already produced
 * ledger rows (PARTIAL / COMPLETED) are immutable.
 */
@SpringBootTest
@Transactional
class OrderEditDeleteTest extends AbstractWebIntegrationTest {

    private String token;
    private String skuCode;
    private String locationCode;
    private long partnerId;
    private long skuId;

    @BeforeEach
    void setUp() throws Exception {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        skuCode = "ED-SKU-" + unique;
        locationCode = "ED-LOC-" + unique;
        token = adminToken();
        skuId = createSku(token, skuCode);
        createLocation(token, locationCode);
        partnerId = createSupplier(token, "ED-SUP-" + unique);
    }

    private MvcResult createDraft(int qty) throws Exception {
        String payload = "{\"partnerId\":" + partnerId + ",\"remark\":\"draft\",\"lines\":["
                + "{\"skuId\":" + skuId + ",\"expectedQty\":" + qty + "}]}";
        return mvc.perform(post("/api/v1/inbound-orders")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
    }

    @Test
    void draftOrderCanBeEditedAndDeleted() throws Exception {
        String created = body(createDraft(4));
        long orderId = ((Number) JsonPath.read(created, "$.id")).longValue();
        String orderNo = (String) JsonPath.read(created, "$.orderNo");

        String editPayload = "{\"partnerId\":" + partnerId + ",\"remark\":\"edited\",\"lines\":["
                + "{\"skuId\":" + skuId + ",\"expectedQty\":11}]}";
        MvcResult edited = mvc.perform(put("/api/v1/inbound-orders/{id}", orderId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(editPayload))
                .andExpect(status().isOk())
                .andReturn();
        String json = body(edited);
        assertThat((String) JsonPath.read(json, "$.remark")).isEqualTo("edited");
        assertThat((Integer) JsonPath.read(json, "$.lines[0].expectedQty")).isEqualTo(11);
        assertThat((String) JsonPath.read(json, "$.orderNo")).isEqualTo(orderNo);
        assertThat((String) JsonPath.read(json, "$.status")).isEqualTo("DRAFT");

        mvc.perform(delete("/api/v1/inbound-orders/{id}", orderId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/inbound-orders/{id}", orderId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isNotFound());
    }

    @Test
    void completedOrderCannotBeEditedOrDeleted() throws Exception {
        String created = body(createDraft(3));
        long orderId = ((Number) JsonPath.read(created, "$.id")).longValue();
        long lineId = ((Number) JsonPath.read(created, "$.lines[0].id")).longValue();

        confirm(token, orderId, lineId, skuCode, locationCode, 3, "edit-1", 200);

        String editPayload = "{\"partnerId\":" + partnerId + ",\"remark\":\"hack\",\"lines\":["
                + "{\"skuId\":" + skuId + ",\"expectedQty\":99}]}";
        MvcResult edit = mvc.perform(put("/api/v1/inbound-orders/{id}", orderId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(editPayload))
                .andExpect(status().isConflict())
                .andReturn();
        assertThat((String) JsonPath.read(body(edit), "$.code")).isEqualTo("ORDER_NOT_EDITABLE");

        MvcResult del = mvc.perform(delete("/api/v1/inbound-orders/{id}", orderId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isConflict())
                .andReturn();
        assertThat((String) JsonPath.read(body(del), "$.code")).isEqualTo("ORDER_NOT_DELETABLE");
    }
}
