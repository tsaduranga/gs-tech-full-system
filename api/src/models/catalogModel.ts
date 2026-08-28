import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { tableExists } from "../db/schemaHints.js";
import { HttpError } from "../utils/httpError.js";
import { softDelete, softDeleteWhere, notDeletedClause } from "../db/softDelete.js";

const CATALOG_MIGRATE_MSG =
  "Catalog tables are not installed. From the api folder run: yarn migrate";

async function insertId(rows: unknown): Promise<number> {
  return (rows as ResultSetHeader).insertId as number;
}

async function requireCategoriesTable(): Promise<void> {
  if (!(await tableExists("catalog_categories"))) {
    throw new HttpError(503, CATALOG_MIGRATE_MSG);
  }
}

async function requireCatalogTaxonomyTables(): Promise<void> {
  const cat = await tableExists("catalog_categories");
  const sub = await tableExists("catalog_subcategories");
  if (!cat || !sub) throw new HttpError(503, CATALOG_MIGRATE_MSG);
}

export const catalogModel = {
  categories: {
    async listPaginated(opts: {
      search?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      if (!(await tableExists("catalog_categories"))) {
        return { rows: [], total: 0 };
      }

      const q = opts.search?.trim();
      const conditions = [notDeletedClause("c")];
      const params: unknown[] = [];
      if (q) {
        conditions.push(
          "(c.name LIKE ? OR COALESCE(c.description,'') LIKE ? OR CAST(c.id AS CHAR) LIKE ?)"
        );
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS ct FROM catalog_categories c ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { ct?: number })?.ct ?? 0);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT c.id, c.name, c.description, c.sort_order, c.is_active, c.created_at, c.updated_at
         FROM catalog_categories c ${whereClause} ORDER BY c.sort_order ASC, c.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    async listActiveNamesOrdered(): Promise<string[]> {
      if (!(await tableExists("catalog_categories"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT name FROM catalog_categories WHERE is_active = 1 AND ${notDeletedClause()} ORDER BY sort_order ASC, id ASC`
      );
      return rows.map((r) => String(r.name));
    },

    /** Active categories for selects (id + name). */
    async listActiveBrief(): Promise<{ id: number; name: string }[]> {
      if (!(await tableExists("catalog_categories"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name FROM catalog_categories WHERE is_active = 1 AND ${notDeletedClause()} ORDER BY sort_order ASC, id ASC`
      );
      return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
    },

    async get(id: number): Promise<RowDataPacket | null> {
      if (!(await tableExists("catalog_categories"))) return null;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM catalog_categories WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async create(input: {
      name: string;
      description?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }): Promise<number> {
      await requireCategoriesTable();
      const sortOrder =
        input.sort_order ?? (await catalogModel.categories.nextSortOrder());
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO catalog_categories (name, description, sort_order, is_active)
         VALUES (?, ?, ?, ?)`,
        [
          input.name,
          input.description ?? null,
          sortOrder,
          input.is_active ?? true,
        ]
      );
      return insertId(r);
    },

    async nextSortOrder(): Promise<number> {
      await requireCategoriesTable();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(sort_order), 0) AS mx FROM catalog_categories WHERE ${notDeletedClause()}`
      );
      return Number(rows[0]?.mx ?? 0) + 10;
    },

    async update(
      id: number,
      patch: Partial<{
        name: string;
        description: string | null;
        sort_order: number;
        is_active: boolean;
      }>
    ): Promise<void> {
      await requireCategoriesTable();
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.description !== undefined) {
        fields.push("description = ?");
        params.push(patch.description);
      }
      if (patch.sort_order !== undefined) {
        fields.push("sort_order = ?");
        params.push(patch.sort_order);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE catalog_categories SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      await requireCatalogTaxonomyTables();
      await softDeleteWhere("catalog_subcategories", "category_id = ?", [id]);
      return softDelete("catalog_categories", id);
    },
  },

  subcategories: {
    async listPaginated(opts: {
      search?: string;
      category_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      if (
        !(await tableExists("catalog_categories")) ||
        !(await tableExists("catalog_subcategories"))
      ) {
        return { rows: [], total: 0 };
      }

      const q = opts.search?.trim();
      const conditions = [notDeletedClause("s"), notDeletedClause("c")];
      const params: unknown[] = [];
      if (q) {
        conditions.push(
          "(s.name LIKE ? OR COALESCE(s.description,'') LIKE ? OR c.name LIKE ? OR CAST(s.id AS CHAR) LIKE ?)"
        );
        const like = `%${q}%`;
        params.push(like, like, like, like);
      }
      if (opts.category_id != null && opts.category_id > 0) {
        conditions.push("s.category_id = ?");
        params.push(opts.category_id);
      }
      const whereClause = `WHERE ${conditions.join(" AND ")}`;

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS ct
         FROM catalog_subcategories s
         INNER JOIN catalog_categories c ON c.id = s.category_id
         ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { ct?: number })?.ct ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.category_id, c.name AS category_name, s.name, s.description, s.sort_order, s.is_active, s.created_at, s.updated_at
         FROM catalog_subcategories s
         INNER JOIN catalog_categories c ON c.id = s.category_id
         ${whereClause}
         ORDER BY s.sort_order ASC, s.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    async get(id: number): Promise<RowDataPacket | null> {
      if (!(await tableExists("catalog_subcategories"))) return null;
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.*, c.name AS category_name
         FROM catalog_subcategories s
         INNER JOIN catalog_categories c ON c.id = s.category_id
         WHERE s.id = ? AND ${notDeletedClause("s")} AND ${notDeletedClause("c")}
         LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async create(input: {
      category_id: number;
      name: string;
      description?: string | null;
      sort_order?: number;
      is_active?: boolean;
    }): Promise<number> {
      await requireCatalogTaxonomyTables();
      const sortOrder =
        input.sort_order ??
        (await catalogModel.subcategories.nextSortOrder(input.category_id));
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO catalog_subcategories (category_id, name, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [
          input.category_id,
          input.name,
          input.description ?? null,
          sortOrder,
          input.is_active ?? true,
        ]
      );
      return insertId(r);
    },

    async nextSortOrder(categoryId: number): Promise<number> {
      await requireCatalogTaxonomyTables();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(sort_order), 0) AS mx
         FROM catalog_subcategories WHERE category_id = ? AND ${notDeletedClause()}`,
        [categoryId]
      );
      return Number(rows[0]?.mx ?? 0) + 10;
    },

    async update(
      id: number,
      patch: Partial<{
        category_id: number;
        name: string;
        description: string | null;
        sort_order: number;
        is_active: boolean;
      }>
    ): Promise<void> {
      await requireCatalogTaxonomyTables();
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.category_id !== undefined) {
        fields.push("category_id = ?");
        params.push(patch.category_id);
      }
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.description !== undefined) {
        fields.push("description = ?");
        params.push(patch.description);
      }
      if (patch.sort_order !== undefined) {
        fields.push("sort_order = ?");
        params.push(patch.sort_order);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE catalog_subcategories SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      await requireCatalogTaxonomyTables();
      return softDelete("catalog_subcategories", id);
    },
  },
};
