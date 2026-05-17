import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool } from "../db/pool.js";
import type { RowDataPacket } from "mysql2/promise";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);
reportsRouter.use(requirePermission("reports.read"));

reportsRouter.get("/sales", async (req, res, next) => {
  try {
    const q = z
      .object({
        granularity: z.enum(["daily", "monthly", "yearly"]).default("daily"),
      })
      .parse(req.query);

    let rows: RowDataPacket[];
    if (q.granularity === "daily") {
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT DATE(invoice_date) AS period, SUM(total) AS gross, COUNT(*) AS cnt
         FROM invoices WHERE status NOT IN ('VOID','DRAFT')
           AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
         GROUP BY DATE(invoice_date) ORDER BY period`
      );
    } else if (q.granularity === "monthly") {
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(invoice_date,'%Y-%m') AS period, SUM(total) AS gross, COUNT(*) AS cnt
         FROM invoices WHERE status NOT IN ('VOID','DRAFT')
           AND invoice_date >= DATE_SUB(CURDATE(), INTERVAL 48 MONTH)
         GROUP BY YEAR(invoice_date), MONTH(invoice_date) ORDER BY period`
      );
    } else {
      ;[rows] = await pool.query<RowDataPacket[]>(
        `SELECT YEAR(invoice_date) AS period, SUM(total) AS gross, COUNT(*) AS cnt
         FROM invoices WHERE status NOT IN ('VOID','DRAFT')
         GROUP BY YEAR(invoice_date) ORDER BY period`
      );
    }
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/sales/by-payment-method", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.payment_method AS method, COALESCE(SUM(p.amount),0) AS total
       FROM payments p JOIN invoices i ON i.id = p.invoice_id
       WHERE i.status <> 'VOID' GROUP BY p.payment_method`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/sales/by-employee", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.username, COUNT(i.id) AS invoices, COALESCE(SUM(i.total),0) AS total
       FROM invoices i JOIN users u ON u.id = i.created_by
       WHERE i.status NOT IN ('VOID','DRAFT') GROUP BY u.id ORDER BY total DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/inventory/current-stock", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, i.sku, i.name AS item_name, w.code AS warehouse_code
       FROM stock s JOIN items i ON i.id = s.item_id JOIN warehouses w ON w.id = s.warehouse_id
       ORDER BY w.code, i.sku`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/purchases/by-supplier", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.name AS supplier, COALESCE(SUM(pol.qty_received * pol.unit_cost),0) AS value
       FROM purchase_order_lines pol
       JOIN purchase_orders po ON po.id = pol.purchase_order_id
       JOIN suppliers s ON s.id = po.supplier_id
       GROUP BY s.id ORDER BY value DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/purchases/summary", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT po.order_number, s.name AS supplier, po.status, SUM(pol.qty_ordered * pol.unit_cost) AS po_value
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
       GROUP BY po.id ORDER BY po.id DESC LIMIT 500`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/repairs/jobs", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT rj.*, c.name AS customer_name, u.username AS technician
       FROM repair_jobs rj
       LEFT JOIN users u ON u.id = rj.technician_user_id
       JOIN customers c ON c.id = rj.customer_id
       ORDER BY rj.id DESC LIMIT 500`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/customers/:id/outstanding", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, invoice_number, balance_due, status, invoice_date
       FROM invoices WHERE customer_id = ? AND balance_due > 0.01 ORDER BY id DESC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/customers/:id/history", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [quotes] = await pool.query(
      `SELECT id, quote_number, status, total, created_at FROM quotations WHERE customer_id = ? ORDER BY id DESC`,
      [id]
    );
    const [invs] = await pool.query(
      `SELECT id, invoice_number, status, total, amount_paid, balance_due, invoice_date FROM invoices WHERE customer_id = ? ORDER BY id DESC`,
      [id]
    );
    const [repairs] = await pool.query(
      `SELECT id, status, device_info, created_at FROM repair_jobs WHERE customer_id = ? ORDER BY id DESC`,
      [id]
    );
    res.json({ quotations: quotes, invoices: invs, repairs });
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/suppliers/:id/summary", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [orders] = await pool.query<RowDataPacket[]>(
      `SELECT po.* FROM purchase_orders po WHERE supplier_id = ? ORDER BY id DESC`,
      [id]
    );
    const [spendRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(pol.qty_received * pol.unit_cost),0) AS spend
       FROM purchase_order_lines pol
       JOIN purchase_orders po ON po.id = pol.purchase_order_id
       WHERE po.supplier_id = ?`,
      [id]
    );
    res.json({
      orders,
      total_received_value: Number(spendRows[0]?.spend ?? 0),
    });
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/financial/daily-cash", async (_req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(paid_at) AS day, SUM(amount) AS total
       FROM payments GROUP BY DATE(paid_at) ORDER BY day DESC LIMIT 90`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

reportsRouter.get("/financial/pl", async (req, res, next) => {
  try {
    const months = Math.min(
      24,
      Math.max(1, Number((req.query.months as string) ?? "1"))
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        COALESCE(SUM(il.line_total),0) AS revenue,
        COALESCE(SUM(il.qty * items.unit_cost),0) AS cogs
      FROM invoice_lines il
      JOIN invoices inv ON inv.id = il.invoice_id
      JOIN items ON items.id = il.item_id
      WHERE inv.status IN ('PAID','PARTIAL_PAID','PENDING')
        AND inv.invoice_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
      [months]
    );
    const row = rows[0] ?? { revenue: 0, cogs: 0 };
    res.json({
      revenue: Number(row.revenue ?? 0),
      cogs: Number(row.cogs ?? 0),
      gross_profit: Number(row.revenue ?? 0) - Number(row.cogs ?? 0),
      months,
    });
  } catch (e) {
    next(e);
  }
});
