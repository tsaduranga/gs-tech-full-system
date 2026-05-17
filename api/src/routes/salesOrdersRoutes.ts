import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { operationsModel } from "../models/operationsModel.js";

export const salesOrdersRouter = Router();
salesOrdersRouter.use(requireAuth);

const SO_STATUS = ["OPEN", "FULFILLED", "CANCELLED", "DRAFT"] as const;

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
  status: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    const u = String(x).trim().toUpperCase();
    return (SO_STATUS as readonly string[]).includes(u) ? u : undefined;
  }, z.enum(SO_STATUS).optional()),
});

salesOrdersRouter.get("/", requirePermission("sales_orders.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await operationsModel.salesOrders.listPaginated({
      search: qp.q?.trim() || undefined,
      customer_id: qp.customer_id,
      status: qp.status,
      limit: qp.pageSize,
      offset,
    });
    res.json({ items: rows, total, page: qp.page, pageSize: qp.pageSize });
  } catch (e) {
    next(e);
  }
});

salesOrdersRouter.get(
  "/:id/lines",
  requirePermission("sales_orders.read"),
  async (req, res, next) => {
    try {
      res.json(await operationsModel.salesOrders.lines(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

salesOrdersRouter.post("/", requirePermission("sales_orders.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        customer_id: z.number(),
        order_date: z.string(),
        notes: z.string().nullable().optional(),
        lines: z.array(
          z.object({
            item_id: z.number(),
            qty: z.number().positive(),
            unit_price: z.number().nonnegative(),
          })
        ),
      })
      .parse(req.body);
    const id = await operationsModel.salesOrders.create({
      customerId: body.customer_id,
      orderDate: body.order_date.slice(0, 10),
      notes: body.notes ?? null,
      lines: body.lines.map((l) => ({
        itemId: l.item_id,
        qty: l.qty,
        unitPrice: l.unit_price,
      })),
      userId: req.authUser!.id,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

salesOrdersRouter.patch(
  "/:id",
  requirePermission("sales_orders.write"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const body = z
        .object({
          status: z.enum(SO_STATUS),
        })
        .parse(req.body);
      await operationsModel.salesOrders.updateStatus(id, body.status);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);
