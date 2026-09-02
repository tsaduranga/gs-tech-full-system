-- Warehouse on goods receipts (GRN).

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'purchase_receipts'
        AND COLUMN_NAME = 'warehouse_id'
    ) = 0,
    'ALTER TABLE purchase_receipts ADD COLUMN warehouse_id BIGINT UNSIGNED NULL AFTER supplier_invoice_number',
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
        AND TABLE_NAME = 'purchase_receipts'
        AND CONSTRAINT_NAME = 'fk_pr_warehouse'
    ) = 0,
    'ALTER TABLE purchase_receipts ADD CONSTRAINT fk_pr_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
