import { z } from "zod";

export const warrantyYearsField = z.coerce
  .number()
  .int()
  .min(0, "Years cannot be negative")
  .max(50, "Years cannot exceed 50");

export const warrantyMonthsField = z.coerce
  .number()
  .int()
  .min(0, "Months cannot be negative")
  .max(11, "Months cannot exceed 11");

export const warrantyMasterFields = {
  warranty_years: warrantyYearsField,
  warranty_months: warrantyMonthsField,
};

export function refineWarrantyMasterFields<
  T extends {
    warranty_years?: number | undefined;
    warranty_months?: number | undefined;
  },
>(data: T, ctx: z.RefinementCtx): void {
  const years = data.warranty_years ?? 0;
  const months = data.warranty_months ?? 0;
  if (years <= 0 && months <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Enter warranty years or months",
      path: ["warranty_years"],
    });
  }
}
