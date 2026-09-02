-- Minimum selling price floor on items.

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'minimum_price'
    ) = 0,
    'ALTER TABLE items ADD COLUMN minimum_price DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER unit_price',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
