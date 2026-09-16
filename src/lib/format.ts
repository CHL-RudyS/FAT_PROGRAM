/** Formatting helpers. The prototype renders money without the "Rp" prefix in
 *  tables and with thousands separators, and uses tabular figures via `.num`. */

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const MONTHS_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(parsed)) return 0;
  // Normalise -0 so credit-side totals never render as "-0".
  return parsed === 0 ? 0 : parsed;
}

/** 1234567.5 -> "1.234.568" (no decimals, like the prototype's ledger columns). */
export function formatAmount(value: Numeric): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(toNumber(value));
}

/** 1234567.5 -> "1.234.567,50" for balances that need cents. */
export function formatAmount2(value: Numeric): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(value));
}

export function formatRupiah(value: Numeric): string {
  return `Rp ${formatAmount(value)}`;
}

export function formatQuantity(value: Numeric): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(toNumber(value));
}

/** Empty cells in the prototype render as an em dash. */
export function dash(value: Numeric): string {
  const n = toNumber(value);
  return n === 0 ? "—" : formatAmount(n);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS_SHORT_ID[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateLong(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)} ${hh}:${mm}`;
}

export function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function periodLabel(year: number, month: number): string {
  return `${MONTHS_ID[month - 1]} ${year}`;
}

/** "1.234.567" typed into a money field -> 1234567 */
export function parseAmountInput(text: string): number {
  const digits = text.replace(/[^\d-]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Status label -> chip class used across the prototype's tables. */
export function chipClassFor(status: string): string {
  const value = status.toUpperCase();
  if (["LUNAS", "DISETUJUI", "SELESAI", "DIPOSTING", "AKTIF", "TERHUBUNG", "COCOK", "DIBAYAR"].includes(value)) return "chip chip-ok";
  if (["MENUNGGU", "DIAJUKAN", "SEBAGIAN", "BERJALAN", "DIPROSES", "MENUNGGU_PERSETUJUAN"].includes(value)) return "chip chip-warn";
  if (["DITOLAK", "JATUH_TEMPO", "GAGAL", "TERLAMBAT", "BATAL", "DIBATALKAN"].includes(value)) return "chip chip-bad";
  if (["DIKUNCI", "DITUTUP", "NONAKTIF", "DIABAIKAN"].includes(value)) return "chip chip-lock";
  return "chip chip-open";
}

/** DITUTUP -> "Ditutup", MENUNGGU_PERSETUJUAN -> "Menunggu persetujuan" */
export function humanizeEnum(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Names are stored the way they are written on the payroll — in capitals.
 * That reads as shouting at small sizes, so the compact user chip renders
 * them as a name instead: "KARTIKA PUTRI" -> "Kartika Putri". Left alone
 * when the text is already mixed case, so "PT" or "bin" survive as typed.
 */
export function titleCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/(^|[\s'’(-])([a-zà-ÿ])/g, (_match, before: string, letter: string) => before + letter.toUpperCase());
}
