-- Warranties master table and link items to warranties.

CREATE TABLE IF NOT EXISTS warranties (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  warranty_years INT UNSIGNED NOT NULL DEFAULT 0,
  warranty_months INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_warranties_deleted_at (deleted_at),
  KEY idx_warranties_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'warranty_id'
    ) = 0,
    'ALTER TABLE items ADD COLUMN warranty_id BIGINT UNSIGNED DEFAULT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND CONSTRAINT_NAME = 'fk_items_warranty'
    ) = 0,
    'ALTER TABLE items ADD CONSTRAINT fk_items_warranty FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE SET NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate legacy inline item warranty fields into warranties master rows.
INSERT INTO warranties (name, warranty_years, warranty_months, is_active)
SELECT DISTINCT TRIM(i.warranty_name), i.warranty_years, i.warranty_months, 1
FROM items i
WHERE i.warranty_name IS NOT NULL
  AND TRIM(i.warranty_name) <> ''
  AND (i.warranty_years > 0 OR i.warranty_months > 0)
  AND NOT EXISTS (
    SELECT 1 FROM warranties w
    WHERE w.name = TRIM(i.warranty_name)
      AND w.warranty_years = i.warranty_years
      AND w.warranty_months = i.warranty_months
      AND w.deleted_at IS NULL
  );

UPDATE items i
INNER JOIN warranties w
  ON w.name = TRIM(i.warranty_name)
 AND w.warranty_years = i.warranty_years
 AND w.warranty_months = i.warranty_months
 AND w.deleted_at IS NULL
SET i.warranty_id = w.id
WHERE i.warranty_id IS NULL
  AND i.warranty_name IS NOT NULL
  AND TRIM(i.warranty_name) <> '';

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'warranty_name'
    ) > 0,
    'ALTER TABLE items DROP COLUMN warranty_name',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'warranty_years'
    ) > 0,
    'ALTER TABLE items DROP COLUMN warranty_years',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'warranty_months'
    ) > 0,
    'ALTER TABLE items DROP COLUMN warranty_months',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
