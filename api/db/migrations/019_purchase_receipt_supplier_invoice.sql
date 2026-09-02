-- Supplier invoice number on goods receipts (GRN).

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'purchase_receipts'
        AND COLUMN_NAME = 'supplier_invoice_number'
    ) = 0,
    'ALTER TABLE purchase_receipts ADD COLUMN supplier_invoice_number VARCHAR(100) NULL AFTER purchase_order_id',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
