import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { transactionsModel } from "../models/transactionsModel.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

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
    return String(x).trim().slice(0, 40).toUpperCase();
  }, z.string().max(40).optional()),
  has_balance: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    if (x === true || x === "true" || x === "1" || x === 1) return true;
    return undefined;
  }, z.literal(true).optional()),
});

invoicesRouter.get("/", requirePermission("invoices.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await transactionsModel.invoices.listPaginated({
      search: qp.q?.trim() || undefined,
      customer_id: qp.customer_id,
      status: qp.status,
      has_balance: qp.has_balance === true ? true : undefined,
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

invoicesRouter.get(
  "/:id/lines",
  requirePermission("invoices.read"),
  async (req, res, next) => {
    try {
      res.json(await transactionsModel.invoices.lines(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

invoicesRouter.get(
  "/:id/payments",
  requirePermission("invoices.read"),
  async (req, res, next) => {
    try {
      res.json(await transactionsModel.invoices.payments(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

invoicesRouter.post("/", requirePermission("invoices.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        customer_id: z.number(),
        repair_job_id: z.number().nullable().optional(),
        lines: z.array(
          z.object({
            item_id: z.number(),
            qty: z.number().positive(),
            unit_price: z.number().nonnegative(),
          })
        ),
      })
      .parse(req.body);

    const id = await transactionsModel.invoices.createStandalone({
      customerId: body.customer_id,
      repairJobId: body.repair_job_id ?? null,
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

invoicesRouter.post(
  "/:id/payments",
  requirePermission("invoices.write"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const body = z
        .object({
          amount: z.number().positive(),
          payment_method: z.enum(["CASH", "CARD", "BANK", "OTHER"]),
        })
        .parse(req.body);
      await transactionsModel.invoices.applyPayment({
        invoiceId: id,
        amount: body.amount,
        method: body.payment_method,
        recordedBy: req.authUser!.id,
      });
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof Error && /not found/i.test(e.message)) {
        return next(new HttpError(404, e.message));
      }
      next(e);
    }
  }
);
