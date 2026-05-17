import { z } from "zod";

/** CREATE bodies: omit empty descriptions; coerce stray numbers/strings from clients. */
export function optionalTrimmedDescription(max = 500) {
  return z.preprocess((val: unknown) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return undefined;
    if (typeof val === "number" && Number.isFinite(val)) return String(val);
    const s = typeof val === "string" ? val : String(val);
    const t = s.trim();
    return t === "" ? undefined : t;
  }, z.string().max(max).optional());
}

/** PATCH bodies: allow explicit null (clear description). */
export function patchNullableTrimmedDescription(max = 500) {
  return z.preprocess((val: unknown) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    if (typeof val === "number" && Number.isFinite(val)) return String(val);
    const s = typeof val === "string" ? val : String(val);
    const t = s.trim();
    return t === "" ? null : t;
  }, z.string().max(max).nullable().optional());
}
