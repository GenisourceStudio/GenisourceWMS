package com.genisource.wms.identity.service;

import com.genisource.wms.identity.domain.AppUser;
import com.genisource.wms.identity.domain.Role;
import com.genisource.wms.identity.repository.RoleRepository;
import com.genisource.wms.identity.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates the built-in administrator on first startup.
 *
 * <p>Credentials come from the environment so no password is ever committed.
 * An existing account is left untouched — rotating the password through the
 * environment variable would be a surprise on every restart.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;

    public AdminBootstrap(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            @Value("${wms.security.admin-username}") String username,
            @Value("${wms.security.admin-password}") String password) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.findByUsername(username).isPresent()) {
            log.info("Administrator '{}' already exists; leaving it untouched", username);
            return;
        }

        Role adminRole = roleRepository
                .findByCode("ADMIN")
                .orElseThrow(() -> new IllegalStateException("ADMIN role missing — did V2 seed run?"));

        AppUser admin = new AppUser(username, passwordEncoder.encode(password), "管理员");
        admin.getRoles().add(adminRole);
        userRepository.save(admin);

        log.warn("Created built-in administrator '{}'. Change WMS_ADMIN_PASSWORD before exposing this instance.",
                username);
    }
}
