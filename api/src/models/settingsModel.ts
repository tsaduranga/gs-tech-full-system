import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { tableExists } from "../db/schemaHints.js";
import { HttpError } from "../utils/httpError.js";

const DEFAULT_SSCL_RATE = 0.0125;
const DEFAULT_VAT_RATE = 0.18;

export type TaxRates = {
  sscl_rate: number;
  vat_rate: number;
  updated_at: string | null;
};

function normalizeRate(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const settingsModel = {
  async getTaxRates(): Promise<TaxRates> {
    if (!(await tableExists("system_settings"))) {
      return {
        sscl_rate: DEFAULT_SSCL_RATE,
        vat_rate: DEFAULT_VAT_RATE,
        updated_at: null,
      };
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sscl_rate, vat_rate, updated_at FROM system_settings WHERE id = 1 LIMIT 1`
    );
    const row = rows[0];
    if (!row) {
      return {
        sscl_rate: DEFAULT_SSCL_RATE,
        vat_rate: DEFAULT_VAT_RATE,
        updated_at: null,
      };
    }

    return {
      sscl_rate: normalizeRate(row.sscl_rate, DEFAULT_SSCL_RATE),
      vat_rate: normalizeRate(row.vat_rate, DEFAULT_VAT_RATE),
      updated_at: row.updated_at != null ? String(row.updated_at) : null,
    };
  },

  async updateTaxRates(patch: { sscl_rate: number; vat_rate: number }): Promise<void> {
    if (!(await tableExists("system_settings"))) {
      throw new HttpError(503, "Settings table is not installed. Run database migrations.");
    }

    await pool.query(
      `UPDATE system_settings SET sscl_rate = ?, vat_rate = ? WHERE id = 1`,
      [patch.sscl_rate, patch.vat_rate]
    );
  },
};
