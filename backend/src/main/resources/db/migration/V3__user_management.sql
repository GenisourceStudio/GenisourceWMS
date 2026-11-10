-- C2: user administration capability.
-- V3 is kept separate from V4 (extended warehouse features) so each change is
-- independently replayable. Idempotent inserts keep re-runs safe.

INSERT INTO permission (code, name) VALUES
    ('MANAGE_USER', '管理用户账号')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permission p
WHERE r.code = 'ADMIN' AND p.code = 'MANAGE_USER'
ON CONFLICT DO NOTHING;
