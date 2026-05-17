import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { mastersModel } from "../models/mastersModel.js";

export const warehousesRouter = Router();
warehousesRouter.use(requireAuth);

function isForeignKeyRestriction(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const errno = Number((e as { errno?: number }).errno);
  const code = String((e as { code?: string }).code ?? "");
  return errno === 1451 || code === "ER_ROW_IS_REFERENCED_2";
}

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

const codeSchema = z
  .string()
  .trim()
  .min(1, "Code is required")
  .max(50, "Code at most 50 characters")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use letters, numbers, hyphens, or underscores");

warehousesRouter.get("/", requirePermission("warehouses.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await mastersModel.warehouses.listPaginated({
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
});

warehousesRouter.post("/", requirePermission("warehouses.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        code: codeSchema,
        name: z.string().trim().min(1, "Name is required").max(255),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);
    try {
      const id = await mastersModel.warehouses.create({
        code: body.code,
        name: body.name,
        is_active: body.is_active ?? true,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new HttpError(409, "A warehouse with this code already exists");
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

warehousesRouter.get("/:id", requirePermission("warehouses.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warehouse id");
    const row = await mastersModel.warehouses.get(id);
    if (!row) throw new HttpError(404, "Warehouse not found");
    res.json({
      id: row.id as number,
      code: String(row.code),
      name: String(row.name),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (e) {
    next(e);
  }
});

warehousesRouter.patch("/:id", requirePermission("warehouses.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warehouse id");
    const exists = await mastersModel.warehouses.get(id);
    if (!exists) throw new HttpError(404, "Warehouse not found");

    const body = z
      .object({
        code: codeSchema.optional(),
        name: z.string().trim().min(1).max(255).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    try {
      await mastersModel.warehouses.update(id, {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new HttpError(409, "A warehouse with this code already exists");
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

warehousesRouter.delete("/:id", requirePermission("warehouses.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warehouse id");
    const exists = await mastersModel.warehouses.get(id);
    if (!exists) throw new HttpError(404, "Warehouse not found");
    try {
      const ok = await mastersModel.warehouses.delete(id);
      if (!ok) throw new HttpError(404, "Warehouse not found");
      res.status(204).send();
    } catch (e) {
      if (isForeignKeyRestriction(e)) {
        throw new HttpError(
          409,
          "Cannot delete warehouse: it still has stock or stock movement history."
        );
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});
