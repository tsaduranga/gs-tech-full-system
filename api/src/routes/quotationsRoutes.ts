import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { transactionsModel } from "../models/transactionsModel.js";

export const quotationsRouter = Router();
quotationsRouter.use(requireAuth);

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
    const s = String(x).trim();
    return s === "" ? undefined : s.slice(0, 40).toUpperCase();
  }, z.string().max(40).optional()),
});

quotationsRouter.get("/", requirePermission("quotations.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await transactionsModel.quotations.listPaginated({
      search: qp.q?.trim() || undefined,
      customer_id: qp.customer_id,
      status: qp.status,
      limit: qp.pageSize,
      offset,
    });
    res.json({
      items: rows,
      total,
      page: qp.page,
      pageSize: qp.pageSize,
    });
  } catch (e) {
    next(e);
  }
});

quotationsRouter.get(
  "/:id/lines",
  requirePermission("quotations.read"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await transactionsModel.quotations.lines(id));
    } catch (e) {
      next(e);
    }
  }
);

quotationsRouter.post("/", requirePermission("quotations.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        customer_id: z.number(),
        valid_until: z.string().nullable().optional(),
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
    const id = await transactionsModel.quotations.create({
      customerId: body.customer_id,
      validUntil: body.valid_until ?? null,
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

quotationsRouter.patch("/:id", requirePermission("quotations.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z
      .object({
        status: z.string().optional(),
        valid_until: z.string().nullable().optional(),
      })
      .parse(req.body);
    await transactionsModel.quotations.updateSimple(id, {
      status: body.status,
      validUntil: body.valid_until === undefined ? undefined : body.valid_until,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

quotationsRouter.post("/:id/convert", requirePermission("quotations.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const invoiceId = await transactionsModel.quotations.convertToInvoice(id, req.authUser!.id);
    res.json({ invoice_id: invoiceId });
  } catch (e) {
    if (e instanceof Error && /Already converted|not found/i.test(e.message)) {
      return next(new HttpError(400, e.message));
    }
    next(e);
  }
});
