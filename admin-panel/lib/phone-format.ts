export const PHONE_PLACEHOLDER_MOBILE = "07X XXX XXXX";
export const PHONE_PLACEHOLDER_LANDLINE = "0XX XXX XXXX";

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format while typing: local `0XX XXX XXXX` or international `+94 XX XXX XXXX`. */
export function formatPhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = phoneDigits(value);
  const wantsIntl = trimmed.startsWith("+") || digits.startsWith("94");

  if (wantsIntl) {
    if (digits.startsWith("94")) {
      const local = digits.slice(2, 11);
      if (local.length === 0) return "+94 ";
      if (local.length <= 2) return `+94 ${local}`;
      if (local.length <= 5) {
        return `+94 ${local.slice(0, 2)} ${local.slice(2)}`;
      }
      return `+94 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
    }

    const intl = digits.slice(0, 15);
    if (!intl) return "+";
    return `+${intl}`;
  }

  const local = digits.slice(0, 10);
  if (!local) return "";
  if (local.length <= 3) return local;
  if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return formatPhoneInput(value);
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
