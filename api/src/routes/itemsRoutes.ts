import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { tableHasColumn } from "../db/schemaHints.js";
import { catalogModel } from "../models/catalogModel.js";
import { mastersModel } from "../models/mastersModel.js";
import { resolveItemCatalogSelection } from "../services/itemCatalog.js";

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

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

const optionalCategory = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : v === null ? null : v.trim() === "" ? null : v.trim().slice(0, 100)
  );

const optionalDescription = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : v === null ? null : v.trim() === "" ? null : v.trim().slice(0, 65535)
  );

const optionalNullableId = z.union([z.number().int().min(1), z.null()]).optional();

function serializeItem(row: Record<string, unknown>) {
  const catShown =
    row.category != null && String(row.category).trim() !== ""
      ? String(row.category)
      : null;
  const subId = row.subcategory_id != null ? Number(row.subcategory_id) : null;
  const catIdRaw = row.catalog_category_id;
  const catalogCategoryId =
    catIdRaw != null && String(catIdRaw).trim() !== "" && !Number.isNaN(Number(catIdRaw))
      ? Number(catIdRaw)
      : null;
  const subName =
    row.subcategory_name != null && String(row.subcategory_name).trim() !== ""
      ? String(row.subcategory_name)
      : null;

  return {
    id: row.id as number,
    sku: String(row.sku),
    name: String(row.name),
    category: catShown,
    catalog_category_id: catalogCategoryId,
    subcategory_id: subId != null && !Number.isNaN(subId) ? subId : null,
    subcategory_name: subName,
    description: row.description != null ? String(row.description) : null,
    unit_cost: Number(row.unit_cost),
    unit_price: Number(row.unit_price),
    reorder_level: Number(row.reorder_level),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

itemsRouter.get("/", requirePermission("items.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await mastersModel.items.listPaginated({
      search: qp.q,
      category: qp.category?.trim() || undefined,
      catalog_category_id: qp.catalog_category_id,
      subcategory_id: qp.subcategory_id,
      limit: qp.pageSize,
      offset,
    });
    res.json({
      items: rows.map((r) => serializeItem(r as Record<string, unknown>)),
      total,
      page: qp.page,
      pageSize: qp.pageSize,
    });
  } catch (e) {
    next(e);
  }
});

itemsRouter.get("/categories", requirePermission("items.read"), async (_req, res, next) => {
  try {
    let fromCatalog: string[] = [];
    try {
      fromCatalog = await catalogModel.categories.listActiveNamesOrdered();
    } catch {
      fromCatalog = [];
    }
    const legacyHas = await tableHasColumn("items", "category");
    const fromItems = legacyHas ? await mastersModel.items.distinctCategories() : [];
    const merged = [...new Set([...fromCatalog, ...fromItems])];
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    res.json(merged);
  } catch (e) {
    next(e);
  }
});

itemsRouter.post("/", requirePermission("items.write"), async (req, res, next) => {
  try {
    const raw = req.body;
    const usedTaxonomy =
      typeof raw === "object" &&
      raw !== null &&
      (Object.hasOwn(raw, "catalog_category_id") || Object.hasOwn(raw, "subcategory_id"));

    const body = z
      .object({
        sku: z.string().trim().min(1, "SKU is required").max(100),
        name: z.string().trim().min(1, "Name is required").max(255),
        category: optionalCategory,
        catalog_category_id: optionalNullableId,
        subcategory_id: optionalNullableId,
        description: optionalDescription,
        unit_cost: z.coerce
          .number()
          .finite()
          .positive("Unit cost must be greater than zero"),
        unit_price: z.coerce
          .number()
          .finite()
          .positive("Unit price must be greater than zero"),
        reorder_level: z.coerce
          .number()
          .int()
          .min(0, "Reorder level cannot be negative"),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    let categoryLabel = body.category ?? null;
    let fkSubcategory: number | null | undefined;

    if (usedTaxonomy) {
      const clearingBoth =
        body.catalog_category_id === null && body.subcategory_id === null;
      if (
        !clearingBoth &&
        (body.catalog_category_id == null ||
          body.catalog_category_id < 1 ||
          body.subcategory_id == null ||
          body.subcategory_id < 1)
      ) {
        throw new HttpError(
          400,
          "Category and subcategory are required when using catalog taxonomy fields."
        );
      }
      const r = await resolveItemCatalogSelection(
        body.catalog_category_id,
        body.subcategory_id
      );
      categoryLabel = r.categoryText;
      fkSubcategory = r.subcategoryId;
    }

    try {
      const id = await mastersModel.items.create({
        sku: body.sku,
        name: body.name,
        category: categoryLabel,
        description: body.description ?? null,
        unit_cost: body.unit_cost,
        unit_price: body.unit_price,
        reorder_level: body.reorder_level,
        is_active: body.is_active ?? true,
        subcategory_id: usedTaxonomy ? fkSubcategory ?? null : undefined,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateKey(e)) throw new HttpError(409, "An item with this SKU already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

itemsRouter.get("/:id", requirePermission("items.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid item id");
    const row = await mastersModel.items.get(id);
    if (!row) throw new HttpError(404, "Item not found");
    res.json(serializeItem(row as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

itemsRouter.patch("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid item id");
    const exists = await mastersModel.items.get(id);
    if (!exists) throw new HttpError(404, "Item not found");

    const raw = req.body;
    const usedTaxonomy =
      typeof raw === "object" &&
      raw !== null &&
      (Object.hasOwn(raw, "catalog_category_id") || Object.hasOwn(raw, "subcategory_id"));

    const body = z
      .object({
        sku: z.string().trim().min(1).max(100).optional(),
        name: z.string().trim().min(1).max(255).optional(),
        category: optionalCategory,
        catalog_category_id: optionalNullableId,
        subcategory_id: optionalNullableId,
        description: optionalDescription,
        unit_cost: z.coerce
          .number()
          .finite()
          .positive("Unit cost must be greater than zero")
          .optional(),
        unit_price: z.coerce
          .number()
          .finite()
          .positive("Unit price must be greater than zero")
          .optional(),
        reorder_level: z.coerce
          .number()
          .int()
          .min(0, "Reorder level cannot be negative")
          .optional(),
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    try {
      if (usedTaxonomy) {
        const cat = body.catalog_category_id;
        const sub = body.subcategory_id;
        const clearingBoth = cat === null && sub === null;
        const taxonomyTouched = cat !== undefined || sub !== undefined;
        if (taxonomyTouched && !clearingBoth) {
          const catOk =
            typeof cat === "number" &&
            Number.isFinite(cat) &&
            cat >= 1;
          const subOk =
            typeof sub === "number" &&
            Number.isFinite(sub) &&
            sub >= 1;
          if (!(catOk && subOk)) {
            throw new HttpError(
              400,
              "Category and subcategory must both be set to valid IDs, or both cleared (null)."
            );
          }
        }
      }

      const patchUpdate: Parameters<typeof mastersModel.items.update>[1] = {
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.unit_cost !== undefined ? { unit_cost: body.unit_cost } : {}),
        ...(body.unit_price !== undefined ? { unit_price: body.unit_price } : {}),
        ...(body.reorder_level !== undefined ? { reorder_level: body.reorder_level } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      };

      if (usedTaxonomy) {
        const r = await resolveItemCatalogSelection(
          body.catalog_category_id,
          body.subcategory_id
        );
        patchUpdate.category = r.categoryText;
        patchUpdate.subcategory_id = r.subcategoryId;
      } else if (body.category !== undefined) {
        patchUpdate.category = body.category;
      }

      await mastersModel.items.update(id, patchUpdate);
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateKey(e)) throw new HttpError(409, "An item with this SKU already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

itemsRouter.delete("/:id", requirePermission("items.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid item id");
    const exists = await mastersModel.items.get(id);
    if (!exists) throw new HttpError(404, "Item not found");
    try {
      const ok = await mastersModel.items.delete(id);
      if (!ok) throw new HttpError(404, "Item not found");
      res.status(204).send();
    } catch (e) {
      if (isForeignKeyRestriction(e)) {
        throw new HttpError(
          409,
          "Cannot delete item: still referenced by stock, movements, PO lines, quotations, invoices, sales orders, supplier returns, or customer returns."
        );
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});
