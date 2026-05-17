import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { mastersModel } from "../models/mastersModel.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

function isForeignKeyRestriction(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const errno = Number((e as { errno?: number }).errno);
  const code = String((e as { code?: string }).code ?? "");
  return errno === 1451 || code === "ER_ROW_IS_REFERENCED_2";
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

const optionalTrimmedString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : v === null ? null : v.trim() === "" ? null : v.trim()
  );

const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

suppliersRouter.get("/", requirePermission("suppliers.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await mastersModel.suppliers.listPaginated({
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

suppliersRouter.post("/", requirePermission("suppliers.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(1, "Name is required").max(255),
        email: z.union([z.string().email(), z.literal("")]).optional(),
        phone: optionalTrimmedString,
        address: optionalTrimmedString,
        notes: optionalTrimmedString,
        is_active: z.boolean().optional(),
      })
      .parse(req.body);
    const id = await mastersModel.suppliers.create({
      name: body.name,
      email: body.email === undefined ? null : body.email === "" ? null : body.email,
      phone: body.phone ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
      is_active: body.is_active ?? true,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.get("/:id", requirePermission("suppliers.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid supplier id");
    const row = await mastersModel.suppliers.get(id);
    if (!row) throw new HttpError(404, "Supplier not found");
    res.json({
      id: row.id as number,
      name: row.name as string,
      email: row.email != null ? String(row.email) : null,
      phone: row.phone != null ? String(row.phone) : null,
      address: row.address != null ? String(row.address) : null,
      notes: row.notes != null ? String(row.notes) : null,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.patch("/:id", requirePermission("suppliers.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid supplier id");
    const exists = await mastersModel.suppliers.get(id);
    if (!exists) throw new HttpError(404, "Supplier not found");

    const body = z
      .object({
        name: z.string().trim().min(1).max(255).optional(),
        email: optionalEmail,
        phone: optionalTrimmedString,
        address: optionalTrimmedString,
        notes: optionalTrimmedString,
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    await mastersModel.suppliers.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.delete("/:id", requirePermission("suppliers.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid supplier id");
    const exists = await mastersModel.suppliers.get(id);
    if (!exists) throw new HttpError(404, "Supplier not found");
    try {
      const ok = await mastersModel.suppliers.delete(id);
      if (!ok) throw new HttpError(404, "Supplier not found");
      res.status(204).send();
    } catch (e) {
      if (isForeignKeyRestriction(e)) {
        throw new HttpError(
          409,
          "Cannot delete supplier: still referenced by a purchase order."
        );
      }
      throw e;
    }
  } catch (e) {
    next(e);
  }
});
