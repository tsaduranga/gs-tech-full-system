-- Split warranties into customer and supplier types.

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'warranties'
        AND COLUMN_NAME = 'warranty_type'
    ) = 0,
    "ALTER TABLE warranties ADD COLUMN warranty_type ENUM('customer', 'supplier') NOT NULL DEFAULT 'customer' AFTER name",
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE warranties SET warranty_type = 'customer' WHERE warranty_type IS NULL OR warranty_type = '';

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'warranties'
        AND INDEX_NAME = 'uk_warranties_name_type'
    ) = 0,
    'ALTER TABLE warranties ADD UNIQUE KEY uk_warranties_name_type (name, warranty_type)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
