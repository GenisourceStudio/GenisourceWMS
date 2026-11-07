package com.genisource.wms.identity.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Returns RFC 9457 problem details for unauthenticated requests.
 *
 * <p>The default {@code HttpStatusEntryPoint} answers with an empty 401 body.
 * The SPA needs {@code code=UNAUTHORIZED} to tell "session expired, show the
 * login screen" apart from a generic failure, and the same error shape as every
 * other endpoint (ARCHITECTURE.md §硬约束 8).
 *
 * <p>Spring Boot 4 configures Jackson 3 ({@code tools.jackson}), so the mapper
 * is injected by its Jackson-3 type — the {@code com.fasterxml.jackson}
 * ObjectMapper from 2.x is not a bean here.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final JsonMapper jsonMapper;

    public RestAuthenticationEntryPoint(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
        problem.setTitle("需要登录");
        problem.setDetail("请先登录后再执行该操作");
        problem.setProperty("code", "UNAUTHORIZED");
        write(response, problem);
    }

    void write(HttpServletResponse response, ProblemDetail problem) throws IOException {
        response.setStatus(problem.getStatus());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getOutputStream(), problem);
    }
}
