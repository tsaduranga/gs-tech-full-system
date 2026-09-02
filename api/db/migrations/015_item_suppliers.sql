-- Item ↔ suppliers (many-to-many) and supplier warranty on items.

CREATE TABLE IF NOT EXISTS item_suppliers (
  item_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (item_id, supplier_id),
  KEY idx_item_suppliers_supplier (supplier_id),
  CONSTRAINT fk_item_suppliers_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_suppliers_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'items'
        AND COLUMN_NAME = 'supplier_warranty_id'
    ) = 0,
    'ALTER TABLE items ADD COLUMN supplier_warranty_id BIGINT UNSIGNED DEFAULT NULL',
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
        AND CONSTRAINT_NAME = 'fk_items_supplier_warranty'
    ) = 0,
    'ALTER TABLE items ADD CONSTRAINT fk_items_supplier_warranty FOREIGN KEY (supplier_warranty_id) REFERENCES warranties (id) ON DELETE SET NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
