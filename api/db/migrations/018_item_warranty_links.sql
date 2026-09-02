-- Item ↔ warranties (many-to-many), split by customer vs supplier role.

CREATE TABLE IF NOT EXISTS item_customer_warranties (
  item_id BIGINT UNSIGNED NOT NULL,
  warranty_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (item_id, warranty_id),
  KEY idx_item_customer_warranties_warranty (warranty_id),
  CONSTRAINT fk_item_customer_warranties_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_customer_warranties_warranty FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS item_supplier_warranties (
  item_id BIGINT UNSIGNED NOT NULL,
  warranty_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (item_id, warranty_id),
  KEY idx_item_supplier_warranties_warranty (warranty_id),
  CONSTRAINT fk_item_supplier_warranties_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_supplier_warranties_warranty FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO item_customer_warranties (item_id, warranty_id)
SELECT i.id, i.warranty_id
FROM items i
WHERE i.warranty_id IS NOT NULL
  AND i.deleted_at IS NULL;

INSERT IGNORE INTO item_supplier_warranties (item_id, warranty_id)
SELECT i.id, i.supplier_warranty_id
FROM items i
WHERE i.supplier_warranty_id IS NOT NULL
  AND i.deleted_at IS NULL;
