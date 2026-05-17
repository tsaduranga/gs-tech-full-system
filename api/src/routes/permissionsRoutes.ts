import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { permissionModel, PERMISSION_KEY_RE } from "../models/permissionModel.js";

function isDuplicateEntry(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    String((e as { code?: string }).code) === "ER_DUP_ENTRY"
  );
}

export const permissionsRouter = Router();
permissionsRouter.use(requireAuth);

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

const permissionKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .refine((k) => PERMISSION_KEY_RE.test(k), {
    message: "Key must look like domain.action (e.g. warehouses.read)",
  });

permissionsRouter.get("/", requirePermission("roles.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await permissionModel.listPaginated({
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

permissionsRouter.post("/", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        key: permissionKeySchema,
        description: z.union([z.string().max(500), z.null()]).optional(),
      })
      .parse(req.body);
    try {
      const id = await permissionModel.create({
        key: body.key,
        description:
          body.description === undefined
            ? undefined
            : body.description === null
              ? null
              : body.description.trim() || null,
      });
      res.status(201).json({ id });
    } catch (e) {
      if (isDuplicateEntry(e))
        throw new HttpError(409, "A permission with this key already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

permissionsRouter.get("/:id", requirePermission("roles.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid permission id");
    const row = await permissionModel.getById(id);
    if (!row) throw new HttpError(404, "Permission not found");
    res.json(row);
  } catch (e) {
    next(e);
  }
});

permissionsRouter.patch("/:id", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid permission id");
    const exists = await permissionModel.getById(id);
    if (!exists) throw new HttpError(404, "Permission not found");
    const body = z
      .object({
        key: permissionKeySchema.optional(),
        description: z.union([z.string().max(500), z.null()]).optional(),
      })
      .parse(req.body);

    try {
      await permissionModel.update(id, {
        ...(body.key !== undefined ? { key: body.key.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
      });
      res.json({ ok: true });
    } catch (e) {
      if (isDuplicateEntry(e))
        throw new HttpError(409, "A permission with this key already exists");
      throw e;
    }
  } catch (e) {
    next(e);
  }
});

permissionsRouter.delete("/:id", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid permission id");
    const ok = await permissionModel.delete(id);
    if (!ok) throw new HttpError(404, "Permission not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
