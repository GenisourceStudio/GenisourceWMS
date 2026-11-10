package com.genisource.wms;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Shared HTTP-level helpers for the Spring Boot integration tests. Kept free of
 * any {@code @SpringBootTest} annotations on purpose: each concrete test class
 * declares its own annotations so the test-managed {@code @Transactional}
 * rollback is unambiguous.
 *
 * <p>Spring Boot 4.1 no longer ships {@code @AutoConfigureMockMvc} inside
 * {@code spring-boot-starter-test} (it moved to a separate webmvc-test module
 * that is not on this project's classpath). Rather than add an unplanned
 * dependency, MockMvc is built directly from the real WebApplicationContext and
 * the application's real Spring Security filter chain — the requests still go
 * through the genuine DispatcherServlet, controller advice and JWT filters.
 *
 * <p>Response bodies are parsed with Jayway JsonPath (shipped with
 * spring-boot-starter-test) rather than a Jackson 2 {@code ObjectMapper}:
 * Spring Boot 4 exposes Jackson 3 ({@code tools.jackson}) only.
 */
abstract class AbstractWebIntegrationTest {

    @Autowired
    protected WebApplicationContext webApplicationContext;

    protected MockMvc mvc;

    /** Superclass {@code @BeforeEach} runs before any subclass setup. */
    @BeforeEach
    void setUpMockMvc() {
        Filter securityFilterChain =
                webApplicationContext.getBean("springSecurityFilterChain", Filter.class);
        mvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(securityFilterChain)
                .build();
    }

    protected static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }

    protected static String bearer(String token) {
        return "Bearer " + token;
    }

    /** Logs in with the built-in admin and returns the real signed access token. */
    protected String adminToken() throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(body(result), "$.accessToken");
    }

    protected long createSku(String token, String code) throws Exception {
        String payload = "{\"code\":\"" + code + "\",\"name\":\"Test SKU\",\"spec\":\"spec\",\"unit\":\"PCS\"}";
        MvcResult result = mvc.perform(post("/api/v1/skus")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    protected long createLocation(String token, String code) throws Exception {
        String payload = "{\"code\":\"" + code + "\",\"area\":\"ZONE-A\",\"remark\":\"test\"}";
        MvcResult result = mvc.perform(post("/api/v1/locations")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    protected long createSupplier(String token, String code) throws Exception {
        String payload = "{\"code\":\"" + code + "\",\"name\":\"Test Supplier\",\"type\":\"SUPPLIER\"}";
        MvcResult result = mvc.perform(post("/api/v1/partners")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(body(result), "$.id")).longValue();
    }

    /**
     * Creates a two-line inbound order and returns both line ids. A two-line
     * order stays PARTIAL after the first confirmation, which is required to
     * exercise the idempotent replay / duplicate-scan paths (a single-line order
     * becomes COMPLETED immediately and short-circuits them — see the report).
     */
    protected CreatedOrder createInboundOrder(String token, long partnerId,
                                              long skuId1, int qty1,
                                              long skuId2, int qty2) throws Exception {
        String payload = "{\"partnerId\":" + partnerId + ",\"remark\":\"test\",\"lines\":["
                + "{\"skuId\":" + skuId1 + ",\"expectedQty\":" + qty1 + "},"
                + "{\"skuId\":" + skuId2 + ",\"expectedQty\":" + qty2 + "}]}";
        MvcResult result = mvc.perform(post("/api/v1/inbound-orders")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andReturn();
        String json = body(result);
        long orderId = ((Number) JsonPath.read(json, "$.id")).longValue();
        String orderNo = JsonPath.read(json, "$.orderNo");

        @SuppressWarnings("unchecked")
        java.util.List<java.util.Map<String, Object>> lines = JsonPath.read(json, "$.lines");
        long lineId1 = -1L;
        long lineId2 = -1L;
        for (java.util.Map<String, Object> line : lines) {
            long sid = ((Number) line.get("skuId")).longValue();
            long lid = ((Number) line.get("id")).longValue();
            if (sid == skuId1) {
                lineId1 = lid;
            } else if (sid == skuId2) {
                lineId2 = lid;
            }
        }
        if (lineId1 < 0 || lineId2 < 0) {
            throw new IllegalStateException("inbound order lines not found in: " + json);
        }
        return new CreatedOrder(orderId, orderNo, lineId1, lineId2);
    }

    protected MvcResult confirm(String token, long orderId, long lineId,
                                String skuCode, String locationCode, int qty,
                                String clientToken, int expectedStatus) throws Exception {
        String payload = "{\"skuCode\":\"" + skuCode + "\",\"locationCode\":\"" + locationCode
                + "\",\"qty\":" + qty + ",\"clientToken\":\"" + clientToken + "\"}";
        return mvc.perform(post("/api/v1/inbound-orders/{id}/lines/{lineId}/confirm", orderId, lineId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().is(expectedStatus))
                .andReturn();
    }

    protected record CreatedOrder(long orderId, String orderNo, long lineId1, long lineId2) {
    }
}
