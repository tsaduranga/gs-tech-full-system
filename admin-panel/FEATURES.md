# GS Technology Admin Panel - Features Implemented

This document lists the currently implemented features, organized by the application menu structure.

## Authentication

- Login screen with username/password.
- JWT-based session handling (access + refresh tokens).
- Session persistence in browser storage.
- Route protection for dashboard pages (redirects to login when unauthenticated).
- Logout flow with token invalidation request.

## Dashboard

- Landing dashboard view for signed-in users.
- Central navigation shell with desktop sidebar + mobile drawer.
- Collapsible menu sections with persisted collapse state.
- Dark/light theme toggle.

## Menu-Wise Feature Coverage

### User Management

#### Users
- List users.
- Create users.
- Edit users.
- Activate/deactivate users.

#### Roles
- List roles.
- Create roles.
- Edit roles.
- Assign permissions to roles.

#### Permissions
- List available permissions.
- Permission visibility for role/user management.

### Master Data

#### Customers
- Customer master maintenance (list/create/edit).

#### Suppliers
- Supplier master maintenance (list/create/edit).

#### Warehouses
- Warehouse master maintenance (list/create/edit).

#### Categories
- Category master maintenance (list/create/edit).

#### Subcategories
- Subcategory maintenance linked to categories.

#### Items
- Item master maintenance (SKU/product catalog records).
- Category/subcategory associations.

### Inventory

#### Stock
- Current stock visibility by item/warehouse.
- Stock-related quantity reference for operations.

#### Transfer Items
- Inter-warehouse stock transfer workflow.

#### Transfer History
- Historical view of stock transfers.

### Purchasing

#### Purchase Orders
- Create and manage purchase orders.

#### Purchase Order History
- Historical list of purchase orders.

#### Goods Receipt (GRN)
- Goods receipt entry against procurement flow.

#### GRN History
- Historical list of received goods entries.

#### Supplier Returns
- Supplier return processing.

#### Supplier Return History
- Historical list of supplier returns.

### Sales

#### Quotations
- Create and manage quotations.

#### Quotation History
- Historical list of quotations.

#### Sales Orders
- Create and manage sales orders.

#### Sales Order History
- Historical list of sales orders.

#### Invoices
- Create and manage invoices.

#### Invoice History
- Historical list of invoices.

#### Customer Returns
- Customer return processing.

#### Customer Return History
- Historical list of customer returns.

### Service

#### Repairs
- Create and manage repair jobs.

#### Repair History
- Historical list of repairs.

### Reports

#### Reports
- Reporting page for operational/business views.
- API-backed reporting route integration.

## API Modules Implemented (Backend Coverage)

The admin panel is backed by corresponding API route modules for:

- Auth
- Users
- Roles
- Permissions
- Customers
- Suppliers
- Warehouses
- Categories
- Subcategories
- Items
- Stock
- Purchase Orders
- Goods Receipts
- Supplier Returns
- Quotations
- Sales Orders
- Invoices
- Customer Returns
- Repairs
- Dashboard
- Reports

## Notes

- This is a "developed so far" inventory and reflects current implementation status in the repository.
- Future enhancements (validations, approvals, analytics depth, printing, exports, etc.) can be added as an extension to this file.
