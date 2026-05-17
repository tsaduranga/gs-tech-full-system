import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { transactionsModel } from "../models/transactionsModel.js";

export const repairsRouter = Router();
repairsRouter.use(requireAuth);

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
  technician_user_id: optionalPositiveId,
  status: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    return String(x).trim().slice(0, 40).toUpperCase();
  }, z.string().max(40).optional()),
});

repairsRouter.get("/", requirePermission("repairs.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await transactionsModel.repairs.listPaginated({
      search: qp.q?.trim() || undefined,
      customer_id: qp.customer_id,
      status: qp.status,
      technician_user_id: qp.technician_user_id,
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

repairsRouter.post("/", requirePermission("repairs.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        customer_id: z.number(),
        technician_user_id: z.number().nullable().optional(),
        device_info: z.string().nullable().optional(),
        issue_description: z.string().nullable().optional(),
        status: z.string().optional(),
      })
      .parse(req.body);
    const id = await transactionsModel.repairs.create({
      customer_id: body.customer_id,
      technician_user_id: body.technician_user_id ?? null,
      device_info: body.device_info,
      issue_description: body.issue_description,
      status: body.status,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

repairsRouter.patch("/:id", requirePermission("repairs.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const patch = z
      .object({
        technician_user_id: z.number().nullable().optional(),
        status: z.string().optional(),
        device_info: z.string().optional(),
        issue_description: z.string().optional(),
      })
      .parse(req.body);
    await transactionsModel.repairs.update(id, patch as Record<string, unknown>);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
