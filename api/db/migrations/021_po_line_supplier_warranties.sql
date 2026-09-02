-- Supplier warranties assigned per purchase order line.

CREATE TABLE IF NOT EXISTS purchase_order_line_supplier_warranties (
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  warranty_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (purchase_order_line_id, warranty_id),
  CONSTRAINT fk_polsw_line FOREIGN KEY (purchase_order_line_id)
    REFERENCES purchase_order_lines (id) ON DELETE CASCADE,
  CONSTRAINT fk_polsw_warranty FOREIGN KEY (warranty_id)
    REFERENCES warranties (id) ON DELETE RESTRICT
);
