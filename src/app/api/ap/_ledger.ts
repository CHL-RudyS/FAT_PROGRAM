import "server-only";
import { db } from "@/lib/db";
import { nextDocumentNumber, rule } from "@/lib/api";
import { humanizeEnum, periodLabel } from "@/lib/format";
import type { ActiveContext } from "@/lib/context";

/** Shared posting helpers for Hutang Usaha (AP) and Piutang Usaha (AR). */

export type InvoiceStatusValue = "DRAF" | "TERBUKA" | "SEBAGIAN" | "LUNAS" | "JATUH_TEMPO" | "BATAL";
export type JournalSourceValue = "MANUAL" | "PEMBELIAN" | "FAKTUR_PENJUALAN";

/** Account codes in the seeded chart of accounts, most specific first. */
export const AP_ACCOUNT_CODES = ["2-1000"];
export const AR_ACCOUNT_CODES = ["1-1200"];
export const PPN_MASUKAN_CODES = ["1-1400"];
export const PPN_KELUARAN_CODES = ["2-1100"];
export const REVENUE_CODES = ["4-1000"];
/** PPh yang dipotong dari tagihan vendor menambah utang pajak. */
export const PPH_ACCOUNT_CODES = ["2-1200"];

/** The prototype's `m-bayar` note: payments above this need Administrator approval. */
export const PAYMENT_APPROVAL_LIMIT = 50_000_000;

/** Default PPN rate carried over from the prototype's "010 · PPN 11%" option. */
export const PPN_RATE = 11;

/** Kas & bank rows of the seeded chart — the dialogs' "sumber dana" picker. */
export function isCashAccount(account: { code: string; name: string }) {
  return /^1-1[01]/.test(account.code) || /(^|\s)(kas|bank)(\s|$)/i.test(account.name);
}

/** Money rounded to whole rupiah, the way every figure in the prototype is shown. */
export function money(value: number) {
  return Math.round(value * 100) / 100;
}

/** "2026-09-03" -> 2026-09-03T00:00:00Z (parsed in UTC so the period never shifts). */
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Refuses a posting into a period that is DITUTUP or DIKUNCI. */
export async function requireOpenPeriod(companyId: string, date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const period = await db.fiscalPeriod.findUnique({
    where: { companyId_year_month: { companyId, year, month } },
  });
  if (!period) rule(`Periode ${periodLabel(year, month)} belum dibuka.`);
  if (period.status !== "TERBUKA") {
    rule(`Periode ${periodLabel(year, month)} sudah ${humanizeEnum(period.status).toLowerCase()} — posting ditolak.`);
  }
  return period;
}

export async function accountById(companyId: string, id: string, label: string) {
  const account = await db.account.findFirst({
    where: { id, companyId, isActive: true, isPostable: true },
    select: { id: true, code: true, name: true },
  });
  if (!account) rule(`Akun ${label} tidak ditemukan di bagan akun.`);
  return account;
}

export async function accountByCode(companyId: string, codes: string[], label: string) {
  const account = await db.account.findFirst({
    where: { companyId, code: { in: codes }, isActive: true },
    select: { id: true, code: true, name: true },
  });
  if (!account) rule(`Akun ${label} belum ada di bagan akun perusahaan ini.`);
  return account;
}

export type JournalLineInput = {
  accountId: string;
  description?: string | null;
  debit?: number;
  credit?: number;
};

/** Creates a posted, balanced JournalEntry. Throws a business rule if it does not balance. */
export async function postJournal(
  context: ActiveContext,
  input: {
    date: Date;
    periodId: string;
    description: string;
    reference?: string | null;
    source: JournalSourceValue;
    lines: JournalLineInput[];
  },
) {
  const lines = input.lines.filter((line) => (line.debit ?? 0) !== 0 || (line.credit ?? 0) !== 0);
  const debit = lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
  const credit = lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
  if (lines.length < 2) rule("Jurnal harus punya minimal dua baris.");
  if (Math.round((debit - credit) * 100) !== 0) rule("Jurnal tidak seimbang — debit dan kredit harus sama.");

  const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");

  return db.journalEntry.create({
    data: {
      companyId: context.companyId,
      unitId: context.unitId,
      periodId: input.periodId,
      number,
      date: input.date,
      description: input.description,
      reference: input.reference ?? null,
      status: "DIPOSTING",
      source: input.source,
      createdById: context.user.id,
      postedById: context.user.id,
      postedAt: new Date(),
      lines: {
        create: lines.map((line, index) => ({
          accountId: line.accountId,
          description: line.description ?? null,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          lineNo: index + 1,
        })),
      },
    },
    select: { id: true, number: true },
  });
}

/** TERBUKA → SEBAGIAN → LUNAS, with JATUH_TEMPO once the due date has passed. */
export function invoiceStatusFor(amount: number, paid: number, dueDate: Date): InvoiceStatusValue {
  if (Math.round((paid - amount) * 100) >= 0) return "LUNAS";
  if (dueDate.getTime() < startOfToday().getTime()) return "JATUH_TEMPO";
  if (paid > 0) return "SEBAGIAN";
  return "TERBUKA";
}

export const OPEN_INVOICE_STATUSES: InvoiceStatusValue[] = ["TERBUKA", "SEBAGIAN", "JATUH_TEMPO"];

/**
 * Shared guard for `m-bayar` / `m-terima`: an invoice can only be settled when it is
 * posted, still open, and the payment fits inside what is left of it.
 */
export function settlementFor(
  invoice: { amount: number; paidAmount: number; dueDate: Date; status: InvoiceStatusValue },
  payment: number,
  labels: { draft: string; closed: string; tooMuch: (remaining: string) => string },
) {
  if (invoice.status === "DRAF") rule(labels.draft);
  if (invoice.status === "LUNAS" || invoice.status === "BATAL") rule(labels.closed);

  const remaining = money(invoice.amount - invoice.paidAmount);
  if (payment <= 0) rule("Nilai pembayaran harus lebih besar dari nol.");
  if (Math.round((payment - remaining) * 100) > 0) {
    rule(labels.tooMuch(new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(remaining)));
  }

  const paidAmount = money(invoice.paidAmount + payment);
  return { remaining, paidAmount, status: invoiceStatusFor(invoice.amount, paidAmount, invoice.dueDate) };
}

/** Reads the next document number for a dialog badge without consuming it. */
export async function previewDocumentNumber(companyId: string, docType: string, fallbackPrefix: string) {
  const numbering = await db.documentNumbering.findUnique({
    where: { companyId_docType: { companyId, docType } },
  });

  const now = new Date();
  const pattern = numbering?.pattern ?? `${fallbackPrefix}/{YYYY}/{MM}/{####}`;
  const sequence = numbering?.nextNumber ?? 1;

  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}
