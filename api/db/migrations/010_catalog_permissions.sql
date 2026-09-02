-- Categories and subcategories permissions (separate from items).

INSERT IGNORE INTO permissions (`key`) VALUES
  ('categories.read'),
  ('categories.write'),
  ('subcategories.read'),
  ('subcategories.write');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'categories.read',
  'categories.write',
  'subcategories.read',
  'subcategories.write'
)
WHERE r.name = 'Administrator'
  AND p.deleted_at IS NULL;
