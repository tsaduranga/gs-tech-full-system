-- Soft delete: archived rows stay in DB but are hidden from lists/pickers.

ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD KEY idx_users_deleted_at (deleted_at);

ALTER TABLE roles ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE roles ADD KEY idx_roles_deleted_at (deleted_at);

ALTER TABLE permissions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE permissions ADD KEY idx_permissions_deleted_at (deleted_at);

ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE customers ADD KEY idx_customers_deleted_at (deleted_at);

ALTER TABLE suppliers ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE suppliers ADD KEY idx_suppliers_deleted_at (deleted_at);

ALTER TABLE warehouses ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE warehouses ADD KEY idx_warehouses_deleted_at (deleted_at);

ALTER TABLE items ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE items ADD KEY idx_items_deleted_at (deleted_at);

ALTER TABLE catalog_categories ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE catalog_categories ADD KEY idx_catalog_categories_deleted_at (deleted_at);

ALTER TABLE catalog_subcategories ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE catalog_subcategories ADD KEY idx_catalog_subcategories_deleted_at (deleted_at);
