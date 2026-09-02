import { z } from "zod";

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhoneNumber(value: string): boolean {
  const digits = phoneDigits(value);
  if (!digits) return true;

  if (digits.startsWith("94")) {
    return digits.length === 11;
  }

  if (digits.startsWith("0")) {
    return digits.length === 10;
  }

  return digits.length >= 9 && digits.length <= 15;
}

export const PHONE_VALIDATION_MESSAGE =
  "Enter a valid number (e.g. 077 123 4567 or +94 77 123 4567)";

export const optionalPhoneField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  })
  .refine((v) => v === undefined || v === null || v.length <= 64, {
    message: "Must be at most 64 characters",
  })
  .refine((v) => v === undefined || v === null || isValidPhoneNumber(v), {
    message: PHONE_VALIDATION_MESSAGE,
  });

export const requiredPhoneField = z
  .string()
  .trim()
  .min(1, "Contact number is required")
  .max(64, "Must be at most 64 characters")
  .refine((v) => isValidPhoneNumber(v), {
    message: PHONE_VALIDATION_MESSAGE,
  });
