import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { adjustStockConn } from "./stockAdjust.js";

function nextDoc(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function applyEntityFilters(
  filters: Partial<Record<"customer_id" | "supplier_id" | "warehouse_id", number>>,
  tableAlias: string,
  conditions: string[],
  params: unknown[]
): void {
  if (filters.customer_id != null && filters.customer_id > 0) {
    conditions.push(`${tableAlias}.customer_id = ?`);
    params.push(filters.customer_id);
  }
  if (filters.supplier_id != null && filters.supplier_id > 0) {
    conditions.push(`${tableAlias}.supplier_id = ?`);
    params.push(filters.supplier_id);
  }
  if (filters.warehouse_id != null && filters.warehouse_id > 0) {
    conditions.push(`${tableAlias}.warehouse_id = ?`);
    params.push(filters.warehouse_id);
  }
}

export const operationsModel = {
  salesOrders: {
    async listPaginated(opts: {
      search?: string;
      customer_id?: number;
      status?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
LEFT JOIN users u ON u.id = so.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];
      const q = opts.search?.trim();
      if (q) {
        conditions.push(`(
          c.name LIKE ? OR so.order_number LIKE ?
          OR CAST(so.id AS CHAR) LIKE ? OR CAST(so.customer_id AS CHAR) LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      applyEntityFilters({ customer_id: opts.customer_id }, "so", conditions, params);
      const st = opts.status?.trim();
      if (st) {
        conditions.push("so.status = ?");
        params.push(st);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT so.id, so.customer_id, c.name AS customer_name,
           so.order_number, so.status, so.order_date, so.subtotal, so.tax, so.total,
           so.notes, so.invoice_id, so.created_by, so.created_at, so.updated_at,
           u.username AS created_by_username
         ${baseSql}
         ${whereSql}
         ORDER BY so.id DESC
         LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },

    async lines(soId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT sl.*, i.sku FROM sales_order_lines sl
         JOIN items i ON i.id = sl.item_id WHERE sl.sales_order_id = ?`,
        [soId]
      );
      return rows as RowDataPacket[];
    },

    async create(input: {
      customerId: number;
      orderDate: string;
      notes: string | null;
      lines: { itemId: number; qty: number; unitPrice: number }[];
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        let subtotal = 0;
        const lineTotals: number[] = [];
        for (const ln of input.lines) {
          const lt = ln.qty * ln.unitPrice;
          lineTotals.push(lt);
          subtotal += lt;
        }
        const tax = 0;
        const total = subtotal + tax;
        const [r] = await conn.query<ResultSetHeader>(
          `INSERT INTO sales_orders (customer_id, order_number, status, order_date, subtotal, tax, total, notes, created_by)
           VALUES (?, ?, 'OPEN', ?, ?, ?, ?, ?, ?)`,
          [
            input.customerId,
            nextDoc("SO"),
            input.orderDate,
            subtotal,
            tax,
            total,
            input.notes,
            input.userId,
          ]
        );
        const id = r.insertId as number;
        for (let i = 0; i < input.lines.length; i++) {
          const ln = input.lines[i];
          await conn.query(
            `INSERT INTO sales_order_lines (sales_order_id, item_id, qty, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?)`,
            [id, ln.itemId, ln.qty, ln.unitPrice, lineTotals[i]]
          );
        }
        await conn.commit();
        return id;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async updateStatus(id: number, status: string): Promise<void> {
      await pool.query(`UPDATE sales_orders SET status = ? WHERE id = ?`, [
        status.slice(0, 40),
        id,
      ]);
    },
  },

  goodsReceipts: {
    async listPaginated(opts: {
      search?: string;
      supplier_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM purchase_receipts pr
JOIN purchase_orders po ON po.id = pr.purchase_order_id
JOIN suppliers s ON s.id = po.supplier_id
LEFT JOIN users u ON u.id = pr.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];
      const q = opts.search?.trim();
      if (q) {
        conditions.push(`(
          po.order_number LIKE ? OR s.name LIKE ?
          OR CAST(pr.id AS CHAR) LIKE ? OR CAST(pr.purchase_order_id AS CHAR) LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      if (opts.supplier_id != null && opts.supplier_id > 0) {
        conditions.push("po.supplier_id = ?");
        params.push(opts.supplier_id);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT pr.id, pr.purchase_order_id, po.order_number, po.supplier_id, s.name AS supplier_name,
            pr.received_at, pr.created_by, u.username AS created_by_username
         ${baseSql}
         ${whereSql}
         ORDER BY pr.id DESC
         LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },

    async lines(receiptId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT prl.id, prl.qty, prl.purchase_order_line_id, pol.item_id, pol.unit_cost, i.sku, i.name AS item_name
         FROM purchase_receipt_lines prl
         JOIN purchase_order_lines pol ON pol.id = prl.purchase_order_line_id
         JOIN items i ON i.id = pol.item_id
         WHERE prl.purchase_receipt_id = ?`,
        [receiptId]
      );
      return rows as RowDataPacket[];
    },
  },

  supplierReturns: {
    async listPaginated(opts: {
      search?: string;
      supplier_id?: number;
      warehouse_id?: number;
      status?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM supplier_returns sr
JOIN suppliers s ON s.id = sr.supplier_id
JOIN warehouses w ON w.id = sr.warehouse_id
LEFT JOIN users u ON u.id = sr.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];
      const q = opts.search?.trim();
      if (q) {
        conditions.push(`(
          sr.return_number LIKE ? OR s.name LIKE ? OR COALESCE(sr.notes,'') LIKE ?
          OR CAST(sr.id AS CHAR) LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      applyEntityFilters(
        {
          supplier_id: opts.supplier_id,
          warehouse_id: opts.warehouse_id,
        },
        "sr",
        conditions,
        params
      );
      const st = opts.status?.trim();
      if (st) {
        conditions.push("sr.status = ?");
        params.push(st);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT sr.id, sr.supplier_id, s.name AS supplier_name, sr.warehouse_id, w.code AS warehouse_code,
            sr.return_number, sr.status, sr.purchase_order_id, sr.notes,
            sr.created_by, sr.created_at, sr.updated_at, u.username AS created_by_username
         ${baseSql}
         ${whereSql}
         ORDER BY sr.id DESC
         LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },

    async lines(srId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT srl.*, i.sku FROM supplier_return_lines srl
         JOIN items i ON i.id = srl.item_id WHERE srl.supplier_return_id = ?`,
        [srId]
      );
      return rows as RowDataPacket[];
    },

    async create(input: {
      supplierId: number;
      warehouseId: number;
      purchaseOrderId: number | null;
      notes: string | null;
      lines: { itemId: number; qty: number; unitCost: number }[];
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [r] = await conn.query<ResultSetHeader>(
          `INSERT INTO supplier_returns (supplier_id, warehouse_id, return_number, status, purchase_order_id, notes, created_by)
           VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?)`,
          [
            input.supplierId,
            input.warehouseId,
            nextDoc("SR"),
            input.purchaseOrderId,
            input.notes,
            input.userId,
          ]
        );
        const id = r.insertId as number;

        for (const ln of input.lines) {
          const [[st]] = await conn.query<RowDataPacket[]>(
            `SELECT quantity FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
            [input.warehouseId, ln.itemId]
          );
          const avail = Number(st?.quantity ?? 0);
          if (avail + 1e-9 < ln.qty) {
            throw new Error(
              `Insufficient stock for item ${ln.itemId}: have ${avail}, need ${ln.qty}`
            );
          }
          await conn.query(
            `INSERT INTO supplier_return_lines (supplier_return_id, item_id, qty, unit_cost)
             VALUES (?, ?, ?, ?)`,
            [id, ln.itemId, ln.qty, ln.unitCost]
          );
          await adjustStockConn(conn, {
            warehouseId: input.warehouseId,
            itemId: ln.itemId,
            delta: -Number(ln.qty),
            movementType: "SUPPLIER_RETURN",
            referenceType: "SUPPLIER_RETURN",
            referenceId: id,
            userId: input.userId,
          });
        }

        await conn.commit();
        return id;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  },

  customerReturns: {
    async listPaginated(opts: {
      search?: string;
      customer_id?: number;
      warehouse_id?: number;
      status?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM customer_returns cr
JOIN customers c ON c.id = cr.customer_id
JOIN warehouses w ON w.id = cr.warehouse_id
LEFT JOIN invoices inv ON inv.id = cr.invoice_id
LEFT JOIN users u ON u.id = cr.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];
      const q = opts.search?.trim();
      if (q) {
        conditions.push(`(
          cr.return_number LIKE ? OR c.name LIKE ? OR COALESCE(cr.notes,'') LIKE ?
          OR CAST(cr.id AS CHAR) LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      applyEntityFilters(
        {
          customer_id: opts.customer_id,
          warehouse_id: opts.warehouse_id,
        },
        "cr",
        conditions,
        params
      );
      const st = opts.status?.trim();
      if (st) {
        conditions.push("cr.status = ?");
        params.push(st);
      }
      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT cr.id, cr.customer_id, c.name AS customer_name, cr.warehouse_id, w.code AS warehouse_code,
            cr.return_number, cr.status, cr.invoice_id, inv.invoice_number AS linked_invoice_number,
            cr.notes, cr.created_by, cr.created_at, cr.updated_at, u.username AS created_by_username
         ${baseSql}
         ${whereSql}
         ORDER BY cr.id DESC
         LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },

    async lines(crId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT crl.*, i.sku FROM customer_return_lines crl
         JOIN items i ON i.id = crl.item_id WHERE crl.customer_return_id = ?`,
        [crId]
      );
      return rows as RowDataPacket[];
    },

    async create(input: {
      customerId: number;
      warehouseId: number;
      invoiceId: number | null;
      notes: string | null;
      lines: {
        itemId: number;
        qty: number;
        unitPrice: number;
        invoiceLineId: number | null;
      }[];
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [r] = await conn.query<ResultSetHeader>(
          `INSERT INTO customer_returns (customer_id, warehouse_id, return_number, status, invoice_id, notes, created_by)
           VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?)`,
          [
            input.customerId,
            input.warehouseId,
            nextDoc("CR"),
            input.invoiceId,
            input.notes,
            input.userId,
          ]
        );
        const id = r.insertId as number;

        for (const ln of input.lines) {
          await conn.query(
            `INSERT INTO customer_return_lines (customer_return_id, invoice_line_id, item_id, qty, unit_price)
             VALUES (?, ?, ?, ?, ?)`,
            [id, ln.invoiceLineId, ln.itemId, ln.qty, ln.unitPrice]
          );
          await adjustStockConn(conn, {
            warehouseId: input.warehouseId,
            itemId: ln.itemId,
            delta: Number(ln.qty),
            movementType: "CUSTOMER_RETURN",
            referenceType: "CUSTOMER_RETURN",
            referenceId: id,
            userId: input.userId,
          });
        }

        await conn.commit();
        return id;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  },
};
