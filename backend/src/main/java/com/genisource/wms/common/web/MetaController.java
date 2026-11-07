package com.genisource.wms.common.web;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public build metadata. Lets the SPA show the running backend version without
 * requiring a login — the same shape as the MES MetaController.
 */
@RestController
@RequestMapping("/api/v1")
public class MetaController {

    private final String version;

    public MetaController(@Value("${wms.version}") String version) {
        this.version = version;
    }

    @GetMapping("/meta")
    public MetaResponse meta() {
        return new MetaResponse(version, "Asia/Shanghai", List.of("zh-CN", "en-US"));
    }

    public record MetaResponse(String version, String timeZone, List<String> locales) {
    }
}
