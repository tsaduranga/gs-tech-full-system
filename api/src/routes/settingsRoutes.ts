import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { settingsModel } from "../models/settingsModel.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

function canReadTaxSettings(permissions: readonly string[]): boolean {
  return permissions.includes("settings.read") || permissions.includes("items.read");
}

function serializeTaxRates(row: Awaited<ReturnType<typeof settingsModel.getTaxRates>>) {
  return {
    sscl_rate: row.sscl_rate,
    vat_rate: row.vat_rate,
    sscl_percent: Math.round(row.sscl_rate * 10000) / 100,
    vat_percent: Math.round(row.vat_rate * 10000) / 100,
    updated_at: row.updated_at,
  };
}

settingsRouter.get("/", async (req, res, next) => {
  try {
    const perms = req.authUser?.permissions ?? [];
    if (!canReadTaxSettings(perms)) {
      throw new HttpError(403, "Forbidden");
    }
    const row = await settingsModel.getTaxRates();
    res.json(serializeTaxRates(row));
  } catch (e) {
    next(e);
  }
});

settingsRouter.patch("/", requirePermission("settings.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        sscl_percent: z.coerce
          .number()
          .finite()
          .min(0, "SSCL must be zero or positive")
          .max(100, "SSCL cannot exceed 100%"),
        vat_percent: z.coerce
          .number()
          .finite()
          .min(0, "VAT must be zero or positive")
          .max(100, "VAT cannot exceed 100%"),
      })
      .parse(req.body);

    await settingsModel.updateTaxRates({
      sscl_rate: body.sscl_percent / 100,
      vat_rate: body.vat_percent / 100,
    });

    const row = await settingsModel.getTaxRates();
    res.json(serializeTaxRates(row));
  } catch (e) {
    next(e);
  }
});
