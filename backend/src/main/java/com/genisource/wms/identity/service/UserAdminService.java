package com.genisource.wms.identity.service;

import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.identity.domain.AppUser;
import com.genisource.wms.identity.domain.Role;
import com.genisource.wms.identity.repository.RoleRepository;
import com.genisource.wms.identity.repository.UserRepository;
import com.genisource.wms.identity.web.ChangePasswordRequest;
import com.genisource.wms.identity.web.CreateUserRequest;
import com.genisource.wms.identity.web.UpdateUserRequest;
import com.genisource.wms.identity.web.UserAdminResponse;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User administration. Guardrails that keep the system usable:
 * the last enabled ADMIN can never be disabled or demoted, and an admin cannot
 * disable their own account (which would lock everyone out of the console).
 */
@Service
public class UserAdminService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAdminService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserAdminResponse> list() {
        return userRepository.findAll().stream()
                .sorted(java.util.Comparator.comparing(AppUser::getId))
                .map(UserAdminResponse::from)
                .toList();
    }

    @Transactional
    public UserAdminResponse create(CreateUserRequest request) {
        String username = request.username().trim();
        if (userRepository.findByUsername(username).isPresent()) {
            throw WmsException.conflict("DUPLICATE_USERNAME", "用户名已存在：" + username);
        }

        Role role = resolveRole(request.roleCode());
        AppUser user = new AppUser(
                username,
                passwordEncoder.encode(request.password()),
                request.displayName().trim());
        user.getRoles().add(role);
        return UserAdminResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserAdminResponse update(Long id, UpdateUserRequest request, Long currentUserId) {
        AppUser user = userRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("用户不存在：" + id));

        Role role = resolveRole(request.roleCode());

        if (user.getId().equals(currentUserId) && !request.enabled()) {
            throw WmsException.conflict("CANNOT_DISABLE_SELF", "不能禁用当前登录账号");
        }
        if (!request.enabled() && isLastEnabledAdmin(user)) {
            throw WmsException.conflict("LAST_ADMIN", "不能禁用最后一个管理员");
        }
        if (user.roleCodes().contains("ADMIN") && !"ADMIN".equals(role.getCode()) && isLastEnabledAdmin(user)) {
            throw WmsException.conflict("LAST_ADMIN", "不能将最后一个管理员降级");
        }

        user.setDisplayName(request.displayName().trim());
        user.setEnabled(request.enabled());
        user.replaceRoles(List.of(role));
        return UserAdminResponse.from(user);
    }

    @Transactional
    public void changePassword(Long id, ChangePasswordRequest request) {
        AppUser user = userRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("用户不存在：" + id));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    private Role resolveRole(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase();
        if (!normalized.equals("ADMIN") && !normalized.equals("OPERATOR")) {
            throw WmsException.conflict("INVALID_ROLE", "角色只能是 ADMIN 或 OPERATOR");
        }
        return roleRepository
                .findByCode(normalized)
                .orElseThrow(() -> WmsException.notFound("角色不存在：" + normalized));
    }

    /** True when this user is the only enabled account holding the ADMIN role. */
    private boolean isLastEnabledAdmin(AppUser target) {
        if (!target.roleCodes().contains("ADMIN") || !target.isEnabled()) {
            return false;
        }
        long enabledAdmins = userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(u -> u.roleCodes().contains("ADMIN"))
                .count();
        return enabledAdmins <= 1;
    }
}
