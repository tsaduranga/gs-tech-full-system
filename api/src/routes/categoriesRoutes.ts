import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { catalogModel } from "../models/catalogModel.js";
import {
  optionalTrimmedDescription,
  patchNullableTrimmedDescription,
} from "../validation/formFields.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

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

categoriesRouter.get("/", requirePermission("items.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await catalogModel.categories.listPaginated({
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

categoriesRouter.get("/picker", requirePermission("items.read"), async (_req, res, next) => {
  try {
    const rows = await catalogModel.categories.listActiveBrief();
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

categoriesRouter.post("/", requirePermission("items.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(1).max(255),
        description: optionalTrimmedDescription(),
        sort_order: z.coerce.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);
    try {
      const id = await catalogModel.categories.create({
        name: body.name,
        description: body.description ?? null,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateKey(e))
        throw new HttpError(409, "A category with this name already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

categoriesRouter.get("/:id", requirePermission("items.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid category id");
    const row = await catalogModel.categories.get(id);
    if (!row) throw new HttpError(404, "Category not found");
    res.json({
      id: row.id as number,
      name: String(row.name),
      description: row.description != null ? String(row.description) : null,
      sort_order: Number(row.sort_order),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.patch("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid category id");
    const exists = await catalogModel.categories.get(id);
    if (!exists) throw new HttpError(404, "Category not found");

    const body = z
      .object({
        name: z.string().trim().min(1).max(255).optional(),
        description: patchNullableTrimmedDescription(),
        sort_order: z.coerce.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    try {
      await catalogModel.categories.update(id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateKey(e))
        throw new HttpError(409, "A category with this name already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

categoriesRouter.delete("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid category id");
    const ok = await catalogModel.categories.delete(id);
    if (!ok) throw new HttpError(404, "Category not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
