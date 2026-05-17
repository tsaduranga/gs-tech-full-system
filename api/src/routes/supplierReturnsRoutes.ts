import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { operationsModel } from "../models/operationsModel.js";

export const supplierReturnsRouter = Router();
supplierReturnsRouter.use(requireAuth);

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
  supplier_id: optionalPositiveId,
  warehouse_id: optionalPositiveId,
  status: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    return x !== undefined && x !== "" && x != null ? String(x).trim().slice(0, 40) : undefined;
  }, z.string().max(40).optional()),
});

supplierReturnsRouter.get("/", requirePermission("supplier_returns.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await operationsModel.supplierReturns.listPaginated({
      search: qp.q?.trim() || undefined,
      supplier_id: qp.supplier_id,
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

supplierReturnsRouter.get(
  "/:id/lines",
  requirePermission("supplier_returns.read"),
  async (req, res, next) => {
    try {
      res.json(await operationsModel.supplierReturns.lines(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);

supplierReturnsRouter.post("/", requirePermission("supplier_returns.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        supplier_id: z.number(),
        warehouse_id: z.number(),
        purchase_order_id: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        lines: z.array(
          z.object({
            item_id: z.number(),
            qty: z.number().positive(),
            unit_cost: z.number().nonnegative(),
          })
        ),
      })
      .parse(req.body);
    const id = await operationsModel.supplierReturns.create({
      supplierId: body.supplier_id,
      warehouseId: body.warehouse_id,
      purchaseOrderId: body.purchase_order_id ?? null,
      notes: body.notes ?? null,
      lines: body.lines.map((l) => ({
        itemId: l.item_id,
        qty: l.qty,
        unitCost: l.unit_cost,
      })),
      userId: req.authUser!.id,
    });
    res.status(201).json({ id });
  } catch (e) {
    if (e instanceof Error && /Insufficient stock/i.test(e.message)) {
      return next(new HttpError(400, e.message));
    }
    next(e);
  }
});
