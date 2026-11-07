-- Identity seed: two roles (PRD §5) and their permissions.
-- The built-in administrator account itself is created at startup by
-- AdminBootstrap, because the password must come from the environment and
-- never be committed to the repository.

INSERT INTO role (code, name) VALUES
    ('ADMIN', '管理员'),
    ('OPERATOR', '作业员');

INSERT INTO permission (code, name) VALUES
    ('VIEW_DASHBOARD', '查看总览'),
    ('MANAGE_MASTER', '维护基础资料'),
    ('MANAGE_ORDER', '维护单据'),
    ('VIEW_INVENTORY', '查看库存与流水'),
    ('VIEW_AUDIT', '查看操作日志'),
    ('EXECUTE_TASK', '执行扫码作业');

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.code = 'ADMIN';

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.code = 'EXECUTE_TASK'
WHERE r.code = 'OPERATOR';
