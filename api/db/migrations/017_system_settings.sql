-- System-wide tax rates for item pricing (SSCL + VAT).

CREATE TABLE IF NOT EXISTS system_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  sscl_rate DECIMAL(10, 6) NOT NULL DEFAULT 0.012500,
  vat_rate DECIMAL(10, 6) NOT NULL DEFAULT 0.180000,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO system_settings (id, sscl_rate, vat_rate) VALUES (1, 0.012500, 0.180000);

INSERT IGNORE INTO permissions (`key`) VALUES
  ('settings.read'),
  ('settings.write');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN ('settings.read', 'settings.write')
WHERE r.name = 'Administrator'
  AND p.deleted_at IS NULL;
