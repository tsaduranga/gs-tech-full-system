-- Supplier contact fields and VAT number (idempotent).

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'contact_number'
    ) = 0,
    'ALTER TABLE suppliers ADD COLUMN contact_number VARCHAR(64) DEFAULT NULL',
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
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'telephone_number'
    ) = 0,
    'ALTER TABLE suppliers ADD COLUMN telephone_number VARCHAR(64) DEFAULT NULL',
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
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'whatsapp_number'
    ) = 0,
    'ALTER TABLE suppliers ADD COLUMN whatsapp_number VARCHAR(64) DEFAULT NULL',
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
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'vat_number'
    ) = 0,
    'ALTER TABLE suppliers ADD COLUMN vat_number VARCHAR(30) DEFAULT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
