-- Editable description snapshot on quotation lines.

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'quotation_lines'
        AND COLUMN_NAME = 'description'
    ) = 0,
    'ALTER TABLE quotation_lines ADD COLUMN description VARCHAR(500) NULL AFTER item_id',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
