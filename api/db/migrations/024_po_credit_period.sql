-- Credit period on purchase orders.

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'purchase_orders'
        AND COLUMN_NAME = 'credit_period_id'
    ) = 0,
    'ALTER TABLE purchase_orders ADD COLUMN credit_period_id BIGINT UNSIGNED NULL AFTER supplier_id',
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
        AND TABLE_NAME = 'purchase_orders'
        AND CONSTRAINT_NAME = 'fk_po_credit_period'
    ) = 0,
    'ALTER TABLE purchase_orders ADD CONSTRAINT fk_po_credit_period FOREIGN KEY (credit_period_id) REFERENCES credit_periods (id) ON DELETE RESTRICT',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
