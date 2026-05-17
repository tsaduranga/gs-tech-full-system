import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { roleModel } from "../models/roleModel.js";
import { permissionModel } from "../models/permissionModel.js";

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

rolesRouter.get("/", requirePermission("roles.read"), async (req, res, next) => {
  try {
    const qp = z
      .object({
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
      })
      .parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await roleModel.listRolesPaginated({
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

rolesRouter.get("/permissions", requirePermission("roles.read"), async (_req, res, next) => {
  try {
    res.json(await permissionModel.listAll());
  } catch (e) {
    next(e);
  }
});

rolesRouter.post("/", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        permission_ids: z.array(z.number()).optional(),
      })
      .parse(req.body);
    const id = await roleModel.createRole({ name: body.name, description: body.description });
    if (body.permission_ids !== undefined)
      await roleModel.setRolePermissions(id, body.permission_ids);
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

rolesRouter.get("/:id", requirePermission("roles.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) {
      throw new HttpError(400, "Invalid role id");
    }
    const role = await roleModel.getRoleById(id);
    if (!role) throw new HttpError(404, "Role not found");
    const permission_ids = await roleModel.getRolePermissionIds(id);
    res.json({
      id: role.id,
      name: role.name,
      description: role.description,
      permission_ids,
    });
  } catch (e) {
    next(e);
  }
});

rolesRouter.delete("/:id", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) {
      throw new HttpError(400, "Invalid role id");
    }
    const ok = await roleModel.deleteRole(id);
    if (!ok) throw new HttpError(404, "Role not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

rolesRouter.patch("/:id", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid role id");
    const exists = await roleModel.getRoleById(id);
    if (!exists) throw new HttpError(404, "Role not found");
    const body = z
      .object({
        name: z.string().min(2).optional(),
        description: z.union([z.string(), z.null()]).optional(),
        permission_ids: z.array(z.number()).optional(),
      })
      .parse(req.body);
    await roleModel.updateRole(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
    });
    if (body.permission_ids !== undefined)
      await roleModel.setRolePermissions(id, body.permission_ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
