-- Credit periods permissions.

INSERT IGNORE INTO permissions (`key`) VALUES
  ('credit_periods.read'),
  ('credit_periods.write');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'credit_periods.read',
  'credit_periods.write'
)
WHERE r.name = 'Administrator'
  AND p.deleted_at IS NULL;
