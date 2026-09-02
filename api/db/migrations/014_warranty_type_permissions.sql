-- Customer / supplier warranty permissions (replaces generic warranties.*).

INSERT IGNORE INTO permissions (`key`) VALUES
  ('customer_warranties.read'),
  ('customer_warranties.write'),
  ('supplier_warranties.read'),
  ('supplier_warranties.write');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'customer_warranties.read',
  'customer_warranties.write',
  'supplier_warranties.read',
  'supplier_warranties.write'
)
WHERE r.name = 'Administrator'
  AND p.deleted_at IS NULL;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permissions rp
INNER JOIN permissions p_old ON p_old.id = rp.permission_id AND p_old.`key` = 'warranties.read'
INNER JOIN permissions p_new ON p_new.`key` IN ('customer_warranties.read', 'supplier_warranties.read')
WHERE p_old.deleted_at IS NULL AND p_new.deleted_at IS NULL;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p_new.id
FROM role_permissions rp
INNER JOIN permissions p_old ON p_old.id = rp.permission_id AND p_old.`key` = 'warranties.write'
INNER JOIN permissions p_new ON p_new.`key` IN ('customer_warranties.write', 'supplier_warranties.write')
WHERE p_old.deleted_at IS NULL AND p_new.deleted_at IS NULL;
