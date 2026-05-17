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

export const subcategoriesRouter = Router();
subcategoriesRouter.use(requireAuth);

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
  categoryId: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    return x;
  }, z.coerce.number().int().min(1).optional()),
});

subcategoriesRouter.get("/", requirePermission("items.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await catalogModel.subcategories.listPaginated({
      search: qp.q,
      category_id: qp.categoryId,
      limit: qp.pageSize,
      offset,
    });
    res.json({
      items: rows.map((r) => ({
        id: r.id as number,
        category_id: r.category_id as number,
        category_name: String(r.category_name),
        name: String(r.name),
        description: r.description != null ? String(r.description) : null,
        sort_order: Number(r.sort_order),
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      total,
      page: qp.page,
      pageSize: qp.pageSize,
    });
  } catch (e) {
    next(e);
  }
});

subcategoriesRouter.post("/", requirePermission("items.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        category_id: z.coerce.number().int().min(1),
        name: z.string().trim().min(1).max(255),
        description: optionalTrimmedDescription(),
        sort_order: z.coerce.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);
    const cat = await catalogModel.categories.get(body.category_id);
    if (!cat) throw new HttpError(400, "Parent category does not exist");
    try {
      const id = await catalogModel.subcategories.create({
        category_id: body.category_id,
        name: body.name,
        description: body.description ?? null,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateKey(e))
        throw new HttpError(
          409,
          "A subcategory with this name already exists under this category"
        );
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

subcategoriesRouter.get("/:id", requirePermission("items.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid subcategory id");
    const row = await catalogModel.subcategories.get(id);
    if (!row) throw new HttpError(404, "Subcategory not found");
    res.json({
      id: row.id as number,
      category_id: row.category_id as number,
      category_name:
        row.category_name != null ? String(row.category_name) : "",
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

subcategoriesRouter.patch("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid subcategory id");
    const exists = await catalogModel.subcategories.get(id);
    if (!exists) throw new HttpError(404, "Subcategory not found");

    const body = z
      .object({
        category_id: z.coerce.number().int().min(1).optional(),
        name: z.string().trim().min(1).max(255).optional(),
        description: patchNullableTrimmedDescription(),
        sort_order: z.coerce.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    if (body.category_id !== undefined) {
      const cat = await catalogModel.categories.get(body.category_id);
      if (!cat) throw new HttpError(400, "Parent category does not exist");
    }

    try {
      await catalogModel.subcategories.update(id, {
        ...(body.category_id !== undefined ? { category_id: body.category_id } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateKey(e))
        throw new HttpError(
          409,
          "A subcategory with this name already exists under this category"
        );
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

subcategoriesRouter.delete("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid subcategory id");
    const ok = await catalogModel.subcategories.delete(id);
    if (!ok) throw new HttpError(404, "Subcategory not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
