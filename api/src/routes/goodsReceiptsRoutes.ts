import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { operationsModel } from "../models/operationsModel.js";

export const goodsReceiptsRouter = Router();
goodsReceiptsRouter.use(requireAuth);

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
});

goodsReceiptsRouter.get("/", requirePermission("goods_receipts.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await operationsModel.goodsReceipts.listPaginated({
      search: qp.q?.trim() || undefined,
      supplier_id: qp.supplier_id,
      limit: qp.pageSize,
      offset,
    });
    res.json({ items: rows, total, page: qp.page, pageSize: qp.pageSize });
  } catch (e) {
    next(e);
  }
});

goodsReceiptsRouter.get(
  "/:id/lines",
  requirePermission("goods_receipts.read"),
  async (req, res, next) => {
    try {
      res.json(await operationsModel.goodsReceipts.lines(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
);
