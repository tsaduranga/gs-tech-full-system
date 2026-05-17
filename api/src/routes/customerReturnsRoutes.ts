import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { operationsModel } from "../models/operationsModel.js";

export const customerReturnsRouter = Router();
customerReturnsRouter.use(requireAuth);

const optionalPositiveId = z.preprocess((v) => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === undefined || x === "" || x === null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}, z.number().int().min(1).optional());

const listQuerySchema = z.object({
  page: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.coerce.number().int().min(1).default(1)
  ),
  pageSize: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.coerce.number().int().min(1).max(500).default(10)
  ),
  q: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().optional()
  ),
  customer_id: optionalPositiveId,
  warehouse_id: optionalPositiveId,
  status: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    return x !== undefined && x !== "" && x != null ? String(x).trim().slice(0, 40) : undefined;
  }, z.string().max(40).optional()),
});

customerReturnsRouter.get("/", requirePermission("customer_returns.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await operationsModel.customerReturns.listPaginated({
      search: qp.q?.trim() || undefined,
      customer_id: qp.customer_id,
      warehouse_id: qp.warehouse_id,
      status: qp.status,
      limit: qp.pageSize,
      offset,
    });
    res.json({ items: rows, total, page: qp.page, pageSize: qp.pageSize });
  } catch (e) {
    next(e);
  }
});

customerReturnsRouter.get(
  "/:id/lines",
  requirePermission("customer_returns.read"),
  async (req, res, next) => {
    try {
      res.json(await operationsModel.customerReturns.lines(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

customerReturnsRouter.post("/", requirePermission("customer_returns.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        customer_id: z.number(),
        warehouse_id: z.number(),
        invoice_id: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        lines: z.array(
          z.object({
            item_id: z.number(),
            qty: z.number().positive(),
            unit_price: z.number().nonnegative(),
            invoice_line_id: z.number().nullable().optional(),
          })
        ),
      })
      .parse(req.body);
    const id = await operationsModel.customerReturns.create({
      customerId: body.customer_id,
      warehouseId: body.warehouse_id,
      invoiceId: body.invoice_id ?? null,
      notes: body.notes ?? null,
      lines: body.lines.map((l) => ({
        itemId: l.item_id,
        qty: l.qty,
        unitPrice: l.unit_price,
        invoiceLineId: l.invoice_line_id ?? null,
      })),
      userId: req.authUser!.id,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});
