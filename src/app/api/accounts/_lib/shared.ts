/** Shared by the account routes. Route files may only export HTTP handlers, so
 *  anything imported across them has to live outside a route module. */

/** "Kode akun mengikuti format 4 digit setelah awalan kelompok" (panduan import). */
export const ACCOUNT_CODE_PATTERN = /^[1-9]-\d{4}$/;

export const ACCOUNT_TYPES = ["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "BEBAN"] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

/** ASET & BEBAN bersaldo normal debit, sisanya kredit. */
export function normalBalanceFor(type: AccountTypeValue) {
  return type === "ASET" || type === "BEBAN" ? "DEBIT" : "KREDIT";
}

/** Kategori akun pada dialog m-akun -> apakah akun bisa menerima jurnal. */
export const ACCOUNT_CATEGORIES = ["ANAK", "SUB", "PARENT_SUB", "MAIN"] as const;
