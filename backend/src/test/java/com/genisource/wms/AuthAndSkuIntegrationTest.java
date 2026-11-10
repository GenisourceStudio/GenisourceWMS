package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.genisource.wms.masterdata.repository.SkuRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * Full-stack (MockMvc + real PostgreSQL + real JWT) tests for authentication,
 * authorization and SKU master-data rules.
 *
 * <p>{@code @Transactional} on the test class means every request joins the
 * test-managed transaction (MockMvc dispatches on the same thread), so all
 * writes are rolled back at the end and the shared dev database stays clean.
 */
@SpringBootTest
@Transactional
class AuthAndSkuIntegrationTest extends AbstractWebIntegrationTest {

    // The MVP's six permissions plus MANAGE_USER added by V3 (C2 user admin).
    // Asserting "contains all" instead of an exact size keeps this test valid as
    // later migrations grant the admin role more capabilities.
    private static final String[] REQUIRED_ADMIN_PERMISSIONS = {
        "VIEW_DASHBOARD", "MANAGE_MASTER", "MANAGE_ORDER",
        "VIEW_INVENTORY", "VIEW_AUDIT", "EXECUTE_TASK", "MANAGE_USER"
    };

    @Autowired
    private SkuRepository skuRepository;

    @Test
    void loginReturnsTokensAndAdminWithAllPermissions() throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.username").value("admin"))
                .andReturn();

        List<String> permissions = JsonPath.read(body(result), "$.user.permissions");
        assertThat(permissions).contains(REQUIRED_ADMIN_PERMISSIONS);
    }

    @Test
    void wrongPasswordReturns401WithUnauthorizedCode() throws Exception {
        mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"definitely-wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void protectedEndpointWithoutTokenReturns401WithUnauthorizedCode() throws Exception {
        mvc.perform(get("/api/v1/skus"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void meWithBearerTokenReturnsAdminAndSixPermissions() throws Exception {
        String token = adminToken();
        MvcResult result = mvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andReturn();

        List<String> permissions = JsonPath.read(body(result), "$.permissions");
        assertThat(permissions).contains(REQUIRED_ADMIN_PERMISSIONS);
    }

    @Test
    void skuCreateDuplicateCodeConflictAndCodeUniqueness() throws Exception {
        String token = adminToken();
        // Unique code so a collision with existing dev data can never happen.
        String code = "IT-SKU-" + UUID.randomUUID().toString().substring(0, 8);

        MvcResult created = mvc.perform(post("/api/v1/skus")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\",\"name\":\"Test SKU\",\"spec\":\"s\",\"unit\":\"PCS\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.isActive").value(true))
                .andReturn();
        long skuId = ((Number) JsonPath.read(body(created), "$.id")).longValue();
        assertThat(skuId).isPositive();

        // A second create with the same code is a 409 with a stable business code.
        mvc.perform(post("/api/v1/skus")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\",\"name\":\"Duplicate\",\"unit\":\"PCS\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_SKU_CODE"));

        // code is a unique key: exactly one row carries it.
        assertThat(skuRepository.findByCode(code)).isPresent();
        long rowsWithCode = skuRepository.findAll().stream()
                .filter(sku -> code.equals(sku.getCode()))
                .count();
        assertThat(rowsWithCode).isEqualTo(1L);

        // ...and it is visible through the paged list endpoint.
        mvc.perform(get("/api/v1/skus").param("keyword", code)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].code").value(code));
    }
}
