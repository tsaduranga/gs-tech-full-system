import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import type { PermissionKey } from "../constants/permissions.js";
import {
  readPermissionForWarrantyType,
  writePermissionForWarrantyType,
  type WarrantyType,
} from "../constants/warrantyTypes.js";
import { warrantyModel } from "../models/warrantyModel.js";
import {
  refineWarrantyMasterFields,
  warrantyMasterFields,
} from "../validation/warranty.js";

export const warrantiesRouter = Router();
warrantiesRouter.use(requireAuth);

function isDuplicateKey(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const errno = Number((e as { errno?: number }).errno);
  const code = String((e as { code?: string }).code ?? "");
  return errno === 1062 || code === "ER_DUP_ENTRY";
}

const warrantyTypeSchema = z.preprocess((v) => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x.trim().toLowerCase() : x;
}, z.enum(["customer", "supplier"]));

const listQuerySchema = z.object({
  type: warrantyTypeSchema,
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

function parseWarrantyTypeFromQuery(req: { query: Record<string, unknown> }): WarrantyType {
  const parsed = warrantyTypeSchema.safeParse(req.query.type);
  if (!parsed.success) {
    throw new HttpError(400, "Query parameter type must be customer or supplier");
  }
  return parsed.data;
}

function assertRowType(row: Record<string, unknown>, type: WarrantyType): void {
  if (String(row.warranty_type) !== type) {
    throw new HttpError(404, "Warranty not found");
  }
}

function serializeWarranty(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    name: String(row.name),
    warranty_type: String(row.warranty_type) as WarrantyType,
    warranty_years: Number(row.warranty_years ?? 0),
    warranty_months: Number(row.warranty_months ?? 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function requireWarrantyRead(type: WarrantyType) {
  const key = readPermissionForWarrantyType(type) as PermissionKey;
  return requirePermission(key);
}

function requireWarrantyWrite(type: WarrantyType) {
  const key = writePermissionForWarrantyType(type) as PermissionKey;
  return requirePermission(key);
}

warrantiesRouter.get(
  "/picker",
  requirePermission("customer_warranties.read", "supplier_warranties.read", "items.read", "purchase_orders.read", "purchase_orders.write"),
  async (req, res, next) => {
    try {
      const type = parseWarrantyTypeFromQuery(req);
      if (!req.authUser?.permissions.includes(readPermissionForWarrantyType(type) as PermissionKey) &&
          !req.authUser?.permissions.includes("items.read") &&
          !req.authUser?.permissions.includes("purchase_orders.read") &&
          !req.authUser?.permissions.includes("purchase_orders.write")) {
        throw new HttpError(403, "Forbidden");
      }
      const rows = await warrantyModel.listActiveBrief(type);
      res.json(
        rows.map((r) => ({
          id: r.id as number,
          name: String(r.name),
          warranty_type: String(r.warranty_type),
          warranty_years: Number(r.warranty_years ?? 0),
          warranty_months: Number(r.warranty_months ?? 0),
        }))
      );
    } catch (e) {
      next(e);
    }
  }
);

warrantiesRouter.get("/", async (req, res, next) => {
  try {
    const type = parseWarrantyTypeFromQuery(req);
    await new Promise<void>((resolve, reject) => {
      requireWarrantyRead(type)(req, res, (err) => (err ? reject(err) : resolve()));
    });
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await warrantyModel.listPaginated({
      warranty_type: type,
      search: qp.q,
      limit: qp.pageSize,
      offset,
    });
    res.json({
      items: rows.map((r) => serializeWarranty(r as Record<string, unknown>)),
      total,
      page: qp.page,
      pageSize: qp.pageSize,
    });
  } catch (e) {
    next(e);
  }
});

warrantiesRouter.post("/", async (req, res, next) => {
  try {
    const type = parseWarrantyTypeFromQuery(req);
    await new Promise<void>((resolve, reject) => {
      requireWarrantyWrite(type)(req, res, (err) => (err ? reject(err) : resolve()));
    });
    const body = z
      .object({
        name: z.string().trim().min(1, "Name is required").max(255),
        ...warrantyMasterFields,
        is_active: z.boolean().optional(),
      })
      .superRefine(refineWarrantyMasterFields)
      .parse(req.body);
    try {
      const id = await warrantyModel.create({
        warranty_type: type,
        name: body.name,
        warranty_years: body.warranty_years,
        warranty_months: body.warranty_months,
        is_active: body.is_active ?? true,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new HttpError(409, "A warranty with this name already exists for this type");
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

warrantiesRouter.get("/:id", async (req, res, next) => {
  try {
    const type = parseWarrantyTypeFromQuery(req);
    await new Promise<void>((resolve, reject) => {
      requireWarrantyRead(type)(req, res, (err) => (err ? reject(err) : resolve()));
    });
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warranty id");
    const row = await warrantyModel.get(id);
    if (!row) throw new HttpError(404, "Warranty not found");
    assertRowType(row as Record<string, unknown>, type);
    res.json(serializeWarranty(row as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

warrantiesRouter.patch("/:id", async (req, res, next) => {
  try {
    const type = parseWarrantyTypeFromQuery(req);
    await new Promise<void>((resolve, reject) => {
      requireWarrantyWrite(type)(req, res, (err) => (err ? reject(err) : resolve()));
    });
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warranty id");
    const exists = await warrantyModel.get(id);
    if (!exists) throw new HttpError(404, "Warranty not found");
    assertRowType(exists as Record<string, unknown>, type);

    const body = z
      .object({
        name: z.string().trim().min(1).max(255).optional(),
        ...warrantyMasterFields,
        is_active: z.boolean().optional(),
      })
      .superRefine(refineWarrantyMasterFields)
      .parse(req.body);

    try {
      await warrantyModel.update(id, {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.warranty_years !== undefined ? { warranty_years: body.warranty_years } : {}),
        ...(body.warranty_months !== undefined ? { warranty_months: body.warranty_months } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw new HttpError(409, "A warranty with this name already exists for this type");
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

warrantiesRouter.delete("/:id", async (req, res, next) => {
  try {
    const type = parseWarrantyTypeFromQuery(req);
    await new Promise<void>((resolve, reject) => {
      requireWarrantyWrite(type)(req, res, (err) => (err ? reject(err) : resolve()));
    });
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid warranty id");
    const ok = await warrantyModel.delete(id, type);
    if (!ok) throw new HttpError(404, "Warranty not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
