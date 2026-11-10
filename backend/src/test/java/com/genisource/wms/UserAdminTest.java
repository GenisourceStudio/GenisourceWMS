package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/** C2: user administration endpoints and their guardrails. */
@SpringBootTest
@Transactional
class UserAdminTest extends AbstractWebIntegrationTest {

    @Test
    void adminCanCreateOperatorAndOperatorCannotManageUsers() throws Exception {
        String token = adminToken();
        String username = "UA-" + UUID.randomUUID().toString().substring(0, 8);

        MvcResult created = mvc.perform(post("/api/v1/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"worker123\","
                                + "\"displayName\":\"Test Operator\",\"roleCode\":\"OPERATOR\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        String json = body(created);
        assertThat((String) JsonPath.read(json, "$.username")).isEqualTo(username);
        assertThat(JsonPath.read(json, "$.roles[0]").toString()).isEqualTo("OPERATOR");

        // The new operator has no MANAGE_USER authority.
        MvcResult operatorLogin = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"worker123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String operatorToken = JsonPath.read(body(operatorLogin), "$.accessToken");

        mvc.perform(get("/api/v1/users")
                        .header("Authorization", bearer((String) operatorToken)))
                .andExpect(status().isForbidden());

        // Duplicate username is rejected.
        MvcResult duplicate = mvc.perform(post("/api/v1/users")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"worker123\","
                                + "\"displayName\":\"Dup\",\"roleCode\":\"OPERATOR\"}"))
                .andExpect(status().isConflict())
                .andReturn();
        assertThat((String) JsonPath.read(body(duplicate), "$.code")).isEqualTo("DUPLICATE_USERNAME");
    }

    @Test
    void cannotDisableOwnAdminAccount() throws Exception {
        String token = adminToken();
        MvcResult result = mvc.perform(put("/api/v1/users/1")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"管理员\",\"enabled\":false,\"roleCode\":\"ADMIN\"}"))
                .andExpect(status().isConflict())
                .andReturn();
        assertThat((String) JsonPath.read(body(result), "$.code")).isEqualTo("CANNOT_DISABLE_SELF");
    }
}
