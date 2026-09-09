import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { mastersModel } from "../models/mastersModel.js";

export const creditPeriodsRouter = Router();
creditPeriodsRouter.use(requireAuth);

function isDuplicateKey(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const errno = Number((e as { errno?: number }).errno);
  const code = String((e as { code?: string }).code ?? "");
  return errno === 1062 || code === "ER_DUP_ENTRY";
}

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
});

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name at most 100 characters");

const daysSchema = z.coerce
  .number()
  .int("Days must be a whole number")
  .min(0, "Days cannot be negative")
  .max(3650, "Days cannot exceed 3650");

creditPeriodsRouter.get(
  "/",
  requirePermission(
    "credit_periods.read",
    "purchase_orders.read",
    "purchase_orders.write"
  ),
  async (req, res, next) => {
    try {
      const qp = listQuerySchema.parse(req.query);
      const offset = (qp.page - 1) * qp.pageSize;
      const { rows, total } = await mastersModel.creditPeriods.listPaginated({
        search: qp.q,
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
  }
);

creditPeriodsRouter.post(
  "/",
  requirePermission("credit_periods.write"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          name: nameSchema,
          days: daysSchema,
          is_active: z.boolean().optional(),
        })
        .parse(req.body);
      try {
        const id = await mastersModel.creditPeriods.create({
          name: body.name,
          days: body.days,
          is_active: body.is_active ?? true,
        });
        res.status(201).json({ id });
      } catch (e) {
        if (isDuplicateKey(e)) {
          throw new HttpError(409, "A credit period with this name already exists");
        }
        throw e;
      }
    } catch (e) {
      next(e);
    }
  }
);

creditPeriodsRouter.get(
  "/:id",
  requirePermission("credit_periods.read"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid credit period id");
      const row = await mastersModel.creditPeriods.get(id);
      if (!row) throw new HttpError(404, "Credit period not found");
      res.json({
        id: row.id as number,
        name: String(row.name),
        days: Number(row.days),
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    } catch (e) {
      next(e);
    }
  }
);

creditPeriodsRouter.patch(
  "/:id",
  requirePermission("credit_periods.write"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid credit period id");
      const exists = await mastersModel.creditPeriods.get(id);
      if (!exists) throw new HttpError(404, "Credit period not found");

      const body = z
        .object({
          name: nameSchema.optional(),
          days: daysSchema.optional(),
          is_active: z.boolean().optional(),
        })
        .parse(req.body);

      try {
        await mastersModel.creditPeriods.update(id, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.days !== undefined ? { days: body.days } : {}),
          ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
        });
        res.json({ ok: true });
      } catch (e) {
        if (isDuplicateKey(e)) {
          throw new HttpError(409, "A credit period with this name already exists");
        }
        throw e;
      }
    } catch (e) {
      next(e);
    }
  }
);

creditPeriodsRouter.delete(
  "/:id",
  requirePermission("credit_periods.write"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid credit period id");
      const exists = await mastersModel.creditPeriods.get(id);
      if (!exists) throw new HttpError(404, "Credit period not found");
      const ok = await mastersModel.creditPeriods.delete(id);
      if (!ok) throw new HttpError(404, "Credit period not found");
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  }
);
