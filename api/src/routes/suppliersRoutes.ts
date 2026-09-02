import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { mastersModel } from "../models/mastersModel.js";
import { optionalPhoneField, requiredPhoneField } from "../validation/phone.js";

export const suppliersRouter = Router();
suppliersRouter.use(requireAuth);

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

const optionalVatNumber = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine(
    (v) => v === undefined || v === null || (v.length >= 10 && v.length <= 30),
    { message: "VAT number must be 10–30 characters" }
  );

const optionalEmail = z
  .union([z.string().email(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v));

const supplierBodyFields = {
  name: z.string().trim().min(1, "Name is required").max(255),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: optionalPhoneField,
  contact_number: requiredPhoneField,
  telephone_number: optionalPhoneField,
  whatsapp_number: optionalPhoneField,
  vat_number: optionalVatNumber,
  address: optionalTrimmedString,
  notes: optionalTrimmedString,
  is_active: z.boolean().optional(),
};

function supplierCreatePayload(
  body: z.infer<z.ZodObject<typeof supplierBodyFields>>
) {
  return {
    name: body.name,
    email: body.email === undefined ? null : body.email === "" ? null : body.email,
    phone: body.phone ?? null,
    contact_number: body.contact_number,
    telephone_number: body.telephone_number ?? null,
    whatsapp_number: body.whatsapp_number ?? null,
    vat_number: body.vat_number ?? null,
    address: body.address ?? null,
    notes: body.notes ?? null,
    is_active: body.is_active ?? true,
  };
}

function supplierDetailJson(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    name: row.name as string,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    contact_number:
      row.contact_number != null ? String(row.contact_number) : null,
    telephone_number:
      row.telephone_number != null ? String(row.telephone_number) : null,
    whatsapp_number:
      row.whatsapp_number != null ? String(row.whatsapp_number) : null,
    vat_number: row.vat_number != null ? String(row.vat_number) : null,
    address: row.address != null ? String(row.address) : null,
    notes: row.notes != null ? String(row.notes) : null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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
    const body = z.object(supplierBodyFields).parse(req.body);
    const id = await mastersModel.suppliers.create(supplierCreatePayload(body));
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.get("/picker", requirePermission("suppliers.read", "items.read"), async (_req, res, next) => {
  try {
    const rows = await mastersModel.suppliers.listActiveBrief();
    res.json(rows.map((r) => ({ id: r.id as number, name: String(r.name) })));
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
    res.json(supplierDetailJson(row as Record<string, unknown>));
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
        name: supplierBodyFields.name.optional(),
        email: optionalEmail,
        phone: optionalPhoneField,
        contact_number: requiredPhoneField,
        telephone_number: optionalPhoneField,
        whatsapp_number: optionalPhoneField,
        vat_number: optionalVatNumber,
        address: optionalTrimmedString,
        notes: optionalTrimmedString,
        is_active: z.boolean().optional(),
      })
      .parse(req.body);

    await mastersModel.suppliers.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.contact_number !== undefined
        ? { contact_number: body.contact_number }
        : {}),
      ...(body.telephone_number !== undefined
        ? { telephone_number: body.telephone_number }
        : {}),
      ...(body.whatsapp_number !== undefined
        ? { whatsapp_number: body.whatsapp_number }
        : {}),
      ...(body.vat_number !== undefined ? { vat_number: body.vat_number } : {}),
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
    const ok = await mastersModel.suppliers.delete(id);
    if (!ok) throw new HttpError(404, "Supplier not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
