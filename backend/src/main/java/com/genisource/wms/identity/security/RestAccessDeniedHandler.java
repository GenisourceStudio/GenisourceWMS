package com.genisource.wms.identity.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/** RFC 9457 body for authenticated-but-forbidden requests (same shape as 401). */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final RestAuthenticationEntryPoint problemWriter;

    public RestAccessDeniedHandler(RestAuthenticationEntryPoint problemWriter) {
        this.problemWriter = problemWriter;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.FORBIDDEN);
        problem.setTitle("没有权限执行该操作");
        problem.setDetail("当前账号缺少所需权限");
        problem.setProperty("code", "FORBIDDEN");
        problemWriter.write(response, problem);
    }
}
