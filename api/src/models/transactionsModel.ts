import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { adjustStockConn } from "./stockAdjust.js";
function nextOrderNumber(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

export const transactionsModel = {
  purchaseOrders: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.id DESC`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      supplier_id?: number;
      status?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM purchase_orders po
JOIN suppliers s ON s.id = po.supplier_id
LEFT JOIN users u ON u.id = po.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];

      const q = opts.search?.trim();
      if (q) {
        conditions.push(`(
          po.order_number LIKE ? OR s.name LIKE ?
          OR CAST(po.id AS CHAR) LIKE ? OR CAST(po.supplier_id AS CHAR) LIKE ?
        )`);
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      if (opts.supplier_id != null && opts.supplier_id > 0) {
        conditions.push("po.supplier_id = ?");
        params.push(opts.supplier_id);
      }
      if (opts.status != null && opts.status.trim() !== "") {
        conditions.push("po.status = ?");
        params.push(opts.status.trim());
      }

      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT po.id, po.supplier_id, s.name AS supplier_name,
            po.order_number, po.status, po.ordered_at, po.notes,
            po.created_by, po.created_at, po.updated_at,
            u.username AS created_by_username
         ${baseSql}
         ${whereSql}
         ORDER BY po.id DESC
         LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },
    async lines(poId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT pol.*, i.sku FROM purchase_order_lines pol
         JOIN items i ON i.id = pol.item_id WHERE pol.purchase_order_id = ?`,
        [poId]
      );
      return rows as RowDataPacket[];
    },
    async create(input: {
      supplierId: number;
      orderedAt: string;
      lines: { itemId: number; qtyOrdered: number; unitCost: number }[];
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [r] = await conn.query<ResultSetHeader>(
          `INSERT INTO purchase_orders (supplier_id, order_number, status, ordered_at, created_by)
           VALUES (?, ?, 'OPEN', ?, ?)`,
          [input.supplierId, nextOrderNumber("PO"), input.orderedAt, input.userId]
        );
        const poId = r.insertId as number;
        for (const ln of input.lines) {
          await conn.query(
            `INSERT INTO purchase_order_lines (purchase_order_id, item_id, qty_ordered, unit_cost)
             VALUES (?, ?, ?, ?)`,
            [poId, ln.itemId, ln.qtyOrdered, ln.unitCost]
          );
        }
        await conn.commit();
        return poId;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async receive(input: {
      purchaseOrderId: number;
      lines: { purchaseOrderLineId: number; qty: number }[];
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rRec] = await conn.query<ResultSetHeader>(
          `INSERT INTO purchase_receipts (purchase_order_id, created_by) VALUES (?, ?)`,
          [input.purchaseOrderId, input.userId]
        );
        const receiptId = rRec.insertId as number;

        for (const l of input.lines) {
          const [[pol]] = await conn.query<RowDataPacket[]>(
            `SELECT purchase_order_id, qty_ordered, qty_received, item_id, unit_cost
             FROM purchase_order_lines WHERE id = ? FOR UPDATE`,
            [l.purchaseOrderLineId]
          );
          if (!pol || pol.purchase_order_id !== input.purchaseOrderId) {
            throw new Error("Invalid PO line");
          }
          const remaining =
            Number(pol.qty_ordered) - Number(pol.qty_received);
          if (l.qty - 1e-9 > remaining) {
            throw new Error("Receive qty exceeds ordered");
          }
          await conn.query(
            `INSERT INTO purchase_receipt_lines (purchase_receipt_id, purchase_order_line_id, qty)
             VALUES (?, ?, ?)`,
            [receiptId, l.purchaseOrderLineId, l.qty]
          );
          await conn.query(
            `UPDATE purchase_order_lines SET qty_received = qty_received + ? WHERE id = ?`,
            [l.qty, l.purchaseOrderLineId]
          );
          /** default warehouse 1 assumption — use first active warehouse id */
          const [[wh]] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1`
          );
          if (!wh) throw new Error("No active warehouse");

          await adjustStockConn(conn, {
            warehouseId: wh.id as number,
            itemId: pol.item_id as number,
            delta: Number(l.qty),
            movementType: "PURCHASE_RECEIVE",
            referenceType: "PURCHASE_RECEIPT",
            referenceId: receiptId,
            userId: input.userId,
          });
        }

        const [[sum]] = await conn.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(qty_ordered - qty_received),0) AS rem FROM purchase_order_lines
           WHERE purchase_order_id = ?`,
          [input.purchaseOrderId]
        );
        const status =
          Number(sum?.rem ?? 0) <= 1e-9 ? "CLOSED" : "PARTIAL";
        await conn.query(`UPDATE purchase_orders SET status = ? WHERE id = ?`, [
          status,
          input.purchaseOrderId,
        ]);

        await conn.commit();
        return receiptId;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  },

  quotations: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT q.*, c.name AS customer_name FROM quotations q
         JOIN customers c ON c.id = q.customer_id ORDER BY q.id DESC`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      customer_id?: number;
      status?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM quotations q
JOIN customers c ON c.id = q.customer_id
LEFT JOIN users u ON u.id = q.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];

      const rawQ = opts.search?.trim();
      if (rawQ) {
        conditions.push(`(
          c.name LIKE ?
          OR q.quote_number LIKE ?
          OR CAST(q.id AS CHAR) LIKE ?
          OR CAST(q.customer_id AS CHAR) LIKE ?
        )`);
        const like = `%${rawQ}%`;
        params.push(like, like, like, like);
      }

      if (opts.customer_id != null && opts.customer_id > 0) {
        conditions.push("q.customer_id = ?");
        params.push(opts.customer_id);
      }
      const st = opts.status?.trim();
      if (st) {
        conditions.push("q.status = ?");
        params.push(st);
      }

      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
          q.id, q.customer_id, c.name AS customer_name,
          q.quote_number, q.status, q.valid_until,
          q.subtotal, q.tax, q.total, q.notes, q.invoice_id,
          q.created_at, q.updated_at, q.created_by,
          u.username AS created_by_username
        ${baseSql}
        ${whereSql}
        ORDER BY q.id DESC
        LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },
    async lines(qid: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT ql.*, i.sku FROM quotation_lines ql
         JOIN items i ON i.id = ql.item_id WHERE ql.quotation_id = ?`,
        [qid]
      );
      return rows as RowDataPacket[];
    },
    async create(input: {
      customerId: number;
      validUntil: string | null;
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
          `INSERT INTO quotations (customer_id, quote_number, status, valid_until, subtotal, tax, total, notes, created_by)
           VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
          [
            input.customerId,
            nextOrderNumber("QT"),
            input.validUntil,
            subtotal,
            tax,
            total,
            input.notes,
            input.userId,
          ]
        );
        const qId = r.insertId as number;
        for (let i = 0; i < input.lines.length; i++) {
          const ln = input.lines[i];
          await conn.query(
            `INSERT INTO quotation_lines (quotation_id, item_id, qty, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?)`,
            [qId, ln.itemId, ln.qty, ln.unitPrice, lineTotals[i]]
          );
        }
        await conn.commit();
        return qId;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async updateSimple(
      id: number,
      patch: Partial<{ status: string; validUntil: string | null }>
    ): Promise<void> {
      await pool.query(
        `UPDATE quotations SET status = COALESCE(?, status), valid_until = COALESCE(?, valid_until) WHERE id = ?`,
        [patch.status ?? null, patch.validUntil ?? null, id]
      );
    },

    async convertToInvoice(quotationId: number, userId: number | null): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[q]] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM quotations WHERE id = ? FOR UPDATE`,
          [quotationId]
        );
        if (!q) throw new Error("Quotation not found");
        if (q.status === "CONVERTED") throw new Error("Already converted");

        const [qlines] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM quotation_lines WHERE quotation_id = ?`,
          [quotationId]
        );

        const [rInv] = await conn.query<ResultSetHeader>(
          `INSERT INTO invoices (customer_id, quotation_id, invoice_number, status, invoice_date,
            subtotal, tax, total, amount_paid, balance_due, created_by)
           VALUES (?, ?, ?, 'PENDING', CURDATE(), ?, ?, ?, 0, ?, ?)`,
          [
            q.customer_id,
            quotationId,
            nextOrderNumber("INV"),
            q.subtotal,
            q.tax,
            q.total,
            q.total,
            userId,
          ]
        );
        const invoiceId = rInv.insertId as number;

        for (const ln of qlines) {
          await conn.query(
            `INSERT INTO invoice_lines (invoice_id, item_id, description, qty, unit_price, line_total)
             VALUES (?, ?, NULL, ?, ?, ?)`,
            [
              invoiceId,
              ln.item_id,
              ln.qty,
              ln.unit_price,
              ln.line_total,
            ]
          );
        }

        await conn.query(
          `UPDATE quotations SET status = 'CONVERTED', invoice_id = ? WHERE id = ?`,
          [invoiceId, quotationId]
        );
        await conn.commit();
        return invoiceId;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  },

  invoices: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT i.*, c.name AS customer_name FROM invoices i
         JOIN customers c ON c.id = i.customer_id ORDER BY i.id DESC`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      customer_id?: number;
      status?: string;
      has_balance?: boolean;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM invoices i
JOIN customers c ON c.id = i.customer_id
LEFT JOIN users u ON u.id = i.created_by`;
      const conditions: string[] = [];
      const params: unknown[] = [];

      const rawQ = opts.search?.trim();
      if (rawQ) {
        conditions.push(`(
          c.name LIKE ? OR i.invoice_number LIKE ?
          OR CAST(i.id AS CHAR) LIKE ?
          OR CAST(i.customer_id AS CHAR) LIKE ?
        )`);
        const like = `%${rawQ}%`;
        params.push(like, like, like, like);
      }

      if (opts.customer_id != null && opts.customer_id > 0) {
        conditions.push("i.customer_id = ?");
        params.push(opts.customer_id);
      }

      const st = opts.status?.trim();
      if (st) {
        conditions.push("i.status = ?");
        params.push(st);
      }

      if (opts.has_balance === true) {
        conditions.push("i.balance_due > 0.0001");
      }

      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
          i.id, i.customer_id, c.name AS customer_name,
          i.invoice_number, i.status, i.invoice_date,
          i.subtotal, i.tax, i.total, i.amount_paid, i.balance_due,
          i.quotation_id, i.repair_job_id, i.created_at, i.updated_at,
          i.created_by, u.username AS created_by_username
        ${baseSql}
        ${whereSql}
        ORDER BY i.id DESC
        LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );

      return { rows: rows as RowDataPacket[], total };
    },
    async lines(invoiceId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT il.*, it.sku, it.name AS item_name FROM invoice_lines il
         JOIN items it ON it.id = il.item_id WHERE il.invoice_id = ?`,
        [invoiceId]
      );
      return rows as RowDataPacket[];
    },
    async payments(invoiceId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(`SELECT * FROM payments WHERE invoice_id = ? ORDER BY id`, [
        invoiceId,
      ]);
      return rows as RowDataPacket[];
    },

    async createStandalone(input: {
      customerId: number;
      lines: { itemId: number; qty: number; unitPrice: number }[];
      repairJobId: number | null;
      userId: number | null;
    }): Promise<number> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        let subtotal = 0;
        const lts: number[] = [];
        for (const ln of input.lines) {
          const t = ln.qty * ln.unitPrice;
          lts.push(t);
          subtotal += t;
        }
        const tax = 0;
        const total = subtotal;

        const [rInv] = await conn.query<ResultSetHeader>(
          `INSERT INTO invoices (customer_id, invoice_number, status, invoice_date,
            subtotal, tax, total, amount_paid, balance_due, repair_job_id, created_by)
           VALUES (?, ?, 'PENDING', CURDATE(), ?, ?, ?, 0, ?, ?, ?)`,
          [
            input.customerId,
            nextOrderNumber("INV"),
            subtotal,
            tax,
            total,
            total,
            input.repairJobId,
            input.userId,
          ]
        );
        const invoiceId = rInv.insertId as number;

        if (input.repairJobId) {
          await conn.query(`UPDATE repair_jobs SET invoice_id = ? WHERE id = ?`, [
            invoiceId,
            input.repairJobId,
          ]);
        }

        for (let i = 0; i < input.lines.length; i++) {
          const ln = input.lines[i];
          await conn.query(
            `INSERT INTO invoice_lines (invoice_id, item_id, description, qty, unit_price, line_total)
             VALUES (?, ?, NULL, ?, ?, ?)`,
            [invoiceId, ln.itemId, ln.qty, ln.unitPrice, lts[i]]
          );
        }
        await conn.commit();
        return invoiceId;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async applyPayment(input: {
      invoiceId: number;
      amount: number;
      method: string;
      recordedBy: number | null;
    }): Promise<void> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[inv]] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM invoices WHERE id = ? FOR UPDATE`,
          [input.invoiceId]
        );
        if (!inv) throw new Error("Invoice not found");

        await conn.query(
          `INSERT INTO payments (invoice_id, amount, payment_method, recorded_by)
           VALUES (?, ?, ?, ?)`,
          [input.invoiceId, input.amount, input.method, input.recordedBy]
        );

        const paid = Number(inv.amount_paid) + input.amount;
        const balance = Number(inv.total) - paid;
        let status =
          balance <= 1e-6 ? "PAID" : paid > 0 ? "PARTIAL_PAID" : "PENDING";
        await conn.query(
          `UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ? WHERE id = ?`,
          [paid, Math.max(balance, 0), status, input.invoiceId]
        );

        /** fulfill stock deduction on full payment optionally — proposal: on selling; deduct when invoice finalized */
        if (balance <= 1e-6) {
          const [lines] = await conn.query<RowDataPacket[]>(
            `SELECT * FROM invoice_lines WHERE invoice_id = ?`,
            [input.invoiceId]
          );
          const [[wh]] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1`
          );
          if (wh) {
            for (const ln of lines) {
              await adjustStockConn(conn, {
                warehouseId: wh.id as number,
                itemId: ln.item_id as number,
                delta: -Number(ln.qty),
                movementType: "SALE",
                referenceType: "INVOICE",
                referenceId: input.invoiceId,
                userId: input.recordedBy,
              });
            }
          }
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  },

  repairs: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT rj.*, c.name AS customer_name, u.username AS technician_name
         FROM repair_jobs rj
         JOIN customers c ON c.id = rj.customer_id
         LEFT JOIN users u ON u.id = rj.technician_user_id
         ORDER BY rj.id DESC`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      customer_id?: number;
      status?: string;
      technician_user_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM repair_jobs rj
JOIN customers c ON c.id = rj.customer_id
LEFT JOIN users u ON u.id = rj.technician_user_id
LEFT JOIN invoices inv ON inv.id = rj.invoice_id`;
      const conditions: string[] = [];
      const params: unknown[] = [];

      const rawQ = opts.search?.trim();
      if (rawQ) {
        conditions.push(`(
          c.name LIKE ? OR rj.device_info LIKE ? OR rj.issue_description LIKE ?
          OR CAST(rj.id AS CHAR) LIKE ? OR CAST(rj.customer_id AS CHAR) LIKE ?
        )`);
        const like = `%${rawQ}%`;
        params.push(like, like, like, like, like);
      }

      if (opts.customer_id != null && opts.customer_id > 0) {
        conditions.push("rj.customer_id = ?");
        params.push(opts.customer_id);
      }

      const st = opts.status?.trim();
      if (st) {
        conditions.push("rj.status = ?");
        params.push(st);
      }

      if (opts.technician_user_id != null && opts.technician_user_id > 0) {
        conditions.push("rj.technician_user_id = ?");
        params.push(opts.technician_user_id);
      }

      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql} ${whereSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
          rj.id, rj.customer_id, c.name AS customer_name,
          rj.technician_user_id, u.username AS technician_name,
          rj.device_info, rj.issue_description, rj.status,
          rj.invoice_id, inv.invoice_number AS linked_invoice_number,
          rj.created_at, rj.updated_at
        ${baseSql}
        ${whereSql}
        ORDER BY rj.id DESC
        LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );

      return { rows: rows as RowDataPacket[], total };
    },
    async create(p: Record<string, unknown>): Promise<number> {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO repair_jobs (customer_id, technician_user_id, device_info, issue_description, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          p.customer_id,
          p.technician_user_id ?? null,
          p.device_info ?? null,
          p.issue_description ?? null,
          p.status ?? "OPEN",
        ]
      );
      return r.insertId as number;
    },
    async update(id: number, patch: Record<string, unknown>): Promise<void> {
      await pool.query(
        `UPDATE repair_jobs SET
         technician_user_id = COALESCE(?, technician_user_id),
         status = COALESCE(?, status),
         device_info = COALESCE(?, device_info),
         issue_description = COALESCE(?, issue_description)
         WHERE id = ?`,
        [
          patch.technician_user_id ?? null,
          patch.status ?? null,
          patch.device_info ?? null,
          patch.issue_description ?? null,
          id,
        ]
      );
    },
  },

  dashboard: {
    async recentTransactions(limit: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT i.invoice_number, i.total AS amount, i.status,
                IFNULL(pm.method_label, '-') AS payment_method,
                i.updated_at AS at,
                c.name AS customer_name
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN (
           SELECT invoice_id,
             GROUP_CONCAT(DISTINCT payment_method ORDER BY payment_method SEPARATOR ', ') AS method_label
           FROM payments GROUP BY invoice_id
         ) pm ON pm.invoice_id = i.id
         ORDER BY i.updated_at DESC LIMIT ?`,
        [limit]
      );
      return rows as RowDataPacket[];
    },
    async salesTotalsByDays(days: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT DATE(i.invoice_date) AS d,
          COALESCE(SUM(i.total),0) AS gross
        FROM invoices i
        WHERE i.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND i.status <> 'VOID' AND i.status <> 'DRAFT'
        GROUP BY DATE(i.invoice_date) ORDER BY d`,
        [days]
      );
      return rows as RowDataPacket[];
    },

    async topSellingItems(limit: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT i.sku, i.name, SUM(il.qty) AS qty_sold
         FROM invoice_lines il
         JOIN invoices inv ON inv.id = il.invoice_id
         JOIN items i ON i.id = il.item_id
         WHERE inv.status IN ('PAID','PARTIAL_PAID','PENDING')
         GROUP BY i.id ORDER BY qty_sold DESC LIMIT ?`,
        [limit]
      );
      return rows as RowDataPacket[];
    },

    async employeeSales(range: string): Promise<RowDataPacket[]> {
      const months = range === "quarterly" ? 3 : range === "yearly" ? 12 : 1;
      const [rows] = await pool.query(
        `SELECT u.id AS user_id, u.username,
          COALESCE(SUM(inv.total),0) AS total_sales,
          COUNT(inv.id) AS invoice_count
         FROM users u
         LEFT JOIN invoices inv ON inv.created_by = u.id
          AND inv.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
          AND inv.status NOT IN ('VOID','DRAFT')
         GROUP BY u.id, u.username ORDER BY total_sales DESC`,
        [months]
      );
      return rows as RowDataPacket[];
    },

    async repairsHandled(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT u.username, COUNT(*) AS jobs
         FROM repair_jobs rj
         JOIN users u ON u.id = rj.technician_user_id
         WHERE rj.technician_user_id IS NOT NULL
         GROUP BY u.id ORDER BY jobs DESC`
      );
      return rows as RowDataPacket[];
    },

    async profitRough(rangeMonths: number): Promise<RowDataPacket> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT
          COALESCE(SUM(il.line_total),0) AS revenue,
          COALESCE(SUM(il.qty * i.unit_cost),0) AS cogs
        FROM invoice_lines il
        JOIN invoices inv ON inv.id = il.invoice_id
        JOIN items i ON i.id = il.item_id
        WHERE inv.status IN ('PAID','PARTIAL_PAID','PENDING')
          AND inv.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
        [rangeMonths]
      );
      return rows[0] ?? ({ revenue: 0, cogs: 0 } as RowDataPacket);
    },

    /** daily sales grouped by employee for chart */
    async salesByUserDaily(days: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `
        SELECT inv.invoice_date AS d, u.username AS user_name, COALESCE(SUM(inv.total),0) AS total
        FROM invoices inv
        JOIN users u ON u.id = inv.created_by
        WHERE inv.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          AND inv.status <> 'VOID' AND inv.status <> 'DRAFT'
        GROUP BY inv.invoice_date, u.id
        ORDER BY inv.invoice_date`,
        [days]
      );
      return rows as RowDataPacket[];
    },

    async invoicesByCreator(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT u.username, COUNT(i.id) AS cnt, COALESCE(SUM(i.total),0) AS amount
         FROM users u
         LEFT JOIN invoices i ON i.created_by = u.id
         GROUP BY u.id ORDER BY amount DESC`
      );
      return rows as RowDataPacket[];
    },

    /** performance summary placeholders */
    async dailySummary(): Promise<RowDataPacket> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT
          COUNT(*) AS invoice_count,
          COALESCE(SUM(total),0) AS sales_total,
          AVG(total) AS avg_ticket
        FROM invoices
        WHERE invoice_date = CURDATE() AND status <> 'VOID' AND status <> 'DRAFT'`
      );
      return rows[0] ?? ({ invoice_count: 0, sales_total: 0, avg_ticket: 0 } as RowDataPacket);
    },

    async monthlySummary(): Promise<RowDataPacket> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT
          COUNT(*) AS invoice_count,
          COALESCE(SUM(total),0) AS sales_total
        FROM invoices
        WHERE YEAR(invoice_date) = YEAR(CURDATE())
          AND MONTH(invoice_date) = MONTH(CURDATE())
          AND status <> 'VOID' AND status <> 'DRAFT'`
      );
      return rows[0] ?? ({ invoice_count: 0, sales_total: 0 } as RowDataPacket);
    },
  },
};
