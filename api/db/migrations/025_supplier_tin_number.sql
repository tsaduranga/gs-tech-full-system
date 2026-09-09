-- Optional supplier TIN number.

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'tin_number'
    ) = 0,
    'ALTER TABLE suppliers ADD COLUMN tin_number VARCHAR(30) DEFAULT NULL AFTER vat_number',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
