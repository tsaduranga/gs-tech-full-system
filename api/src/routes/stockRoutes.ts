import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { mastersModel } from "../models/mastersModel.js";
import { HttpError } from "../utils/httpError.js";

export const stockRouter = Router();
stockRouter.use(requireAuth);

const stockListQuerySchema = z.object({
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
  warehouse_id: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    const n = Number(x);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  }, z.number().int().min(1).optional()),
  category: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().optional()
  ),
  catalog_category_id: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    const n = Number(x);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  }, z.number().int().min(1).optional()),
  subcategory_id: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    const n = Number(x);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  }, z.number().int().min(1).optional()),
});

stockRouter.get("/", requirePermission("stock.read"), async (req, res, next) => {
  try {
    const qp = stockListQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await mastersModel.stock.listPaginated({
      warehouse_id: qp.warehouse_id,
      search: qp.q,
      category: qp.category?.trim() || undefined,
      catalog_category_id: qp.catalog_category_id,
      subcategory_id: qp.subcategory_id,
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

const optionalPositiveId = z.preprocess((v) => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === undefined || x === "" || x === null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}, z.number().int().min(1).optional());

const transferHistoryQuerySchema = z.object({
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
  item_id: optionalPositiveId,
  from_warehouse_id: optionalPositiveId,
  to_warehouse_id: optionalPositiveId,
});

stockRouter.get("/transfer-history", requirePermission("stock.read"), async (req, res, next) => {
  try {
    const qp = transferHistoryQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await mastersModel.stock.listTransferHistoryPaginated({
      search: qp.q,
      item_id: qp.item_id,
      from_warehouse_id: qp.from_warehouse_id,
      to_warehouse_id: qp.to_warehouse_id,
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

stockRouter.get("/low-stock", requirePermission("stock.read"), async (req, res, next) => {
  try {
    const t = Number(req.query.threshold ?? "5");
    res.json(await mastersModel.stock.lowStock(Number.isNaN(t) ? 5 : t));
  } catch (e) {
    next(e);
  }
});

stockRouter.post("/transfer", requirePermission("stock.transfer"), async (req, res, next) => {
  try {
    const body = z
      .object({
        item_id: z.number(),
        from_warehouse_id: z.number(),
        to_warehouse_id: z.number(),
        quantity: z.number().positive(),
      })
      .parse(req.body);
    await mastersModel.stock.transfer({
      itemId: body.item_id,
      fromWarehouseId: body.from_warehouse_id,
      toWarehouseId: body.to_warehouse_id,
      quantity: body.quantity,
      userId: req.authUser!.id,
    });
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && /Insufficient/i.test(e.message)) {
      return next(new HttpError(400, e.message));
    }
    next(e);
  }
});
