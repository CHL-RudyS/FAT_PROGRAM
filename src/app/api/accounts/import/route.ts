import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { ACCOUNT_CODE_PATTERN, type AccountTypeValue, normalBalanceFor } from "../route";

const MAX_ROWS = 500;

const schema = z.object({
  fileName: z.string().trim().min(1, "Nama berkas tidak terbaca.").max(180),
  text: z.string().min(1, "Berkas kosong — tidak ada baris yang bisa dibaca."),
  mode: z.enum(["pratinjau", "proses"]).default("pratinjau"),
  skipErrors: z.boolean().default(true),
});

export type ImportRow = {
  line: number;
  code: string;
  name: string;
  typeLabel: string;
  type: AccountTypeValue | null;
  parentCode: string;
  opening: number;
  ok: boolean;
  message: string;
};

const TYPE_LABELS: Record<AccountTypeValue, string> = {
  ASET: "Aset",
  KEWAJIBAN: "Liabilitas",
  EKUITAS: "Ekuitas",
  PENDAPATAN: "Pendapatan",
  BEBAN: "Beban",
};

/** "Liabilitas", "kewajiban", "ASET" … -> nilai enum AccountType. */
function parseType(raw: string): AccountTypeValue | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith("aset") || value.startsWith("aktiva")) return "ASET";
  if (value.startsWith("liabilit") || value.startsWith("kewajiban") || value.startsWith("utang") || value.startsWith("hutang")) return "KEWAJIBAN";
  if (value.startsWith("ekuitas") || value.startsWith("modal")) return "EKUITAS";
  if (value.startsWith("pendapatan") || value.startsWith("penjualan")) return "PENDAPATAN";
  if (value.startsWith("beban") || value.startsWith("biaya")) return "BEBAN";
  return null;
}

/** "1.250.000" / "1250000,00" / "" -> angka. NaN kalau ada karakter lain. */
function parseMoney(raw: string): number {
  const value = raw.trim();
  if (!value || value === "-" || value === "—") return 0;
  const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function headerIndex(header: string[], ...needles: string[]) {
  return header.findIndex((cell) => {
    const value = cell.toLowerCase().replace(/[^a-z]/g, "");
    return needles.some((needle) => value === needle || value.startsWith(needle));
  });
}

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const lines = body.text
      .replace(/^﻿/, "")
      .split(/\r\n|\n|\r/)
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) rule("Berkas tidak berisi baris data — pastikan ada baris judul kolom dan minimal satu akun.");

    const delimiter = [";", "\t", ","].find((candidate) => lines[0].includes(candidate)) ?? ",";
    const header = splitRow(lines[0], delimiter);

    const iCode = headerIndex(header, "kodeakun", "kode");
    const iName = headerIndex(header, "namaakun", "nama");
    const iType = headerIndex(header, "tipe", "jenis");
    const iParent = headerIndex(header, "induk", "akuninduk", "parent");
    const iOpening = headerIndex(header, "saldoawal", "saldo");

    if (iCode < 0 || iName < 0 || iType < 0) {
      rule("Kolom wajib tidak lengkap. Kolom wajib: Kode Akun, Nama Akun, Tipe, Induk, Saldo Awal.");
    }

    const dataLines = lines.slice(1);
    if (dataLines.length > MAX_ROWS) rule(`Maksimal ${MAX_ROWS} baris per file — berkas ini berisi ${dataLines.length} baris.`);

    const existing = await db.account.findMany({
      where: { companyId: context.companyId },
      select: { id: true, code: true, level: true },
    });
    const existingByCode = new Map(existing.map((account) => [account.code, account]));

    const seen = new Set<string>();
    const rows: ImportRow[] = dataLines.map((line, index) => {
      const cells = splitRow(line, delimiter);
      const code = (cells[iCode] ?? "").trim();
      const name = (cells[iName] ?? "").trim();
      const rawType = (cells[iType] ?? "").trim();
      const parentCode = iParent >= 0 ? (cells[iParent] ?? "").trim() : "";
      const rawOpening = iOpening >= 0 ? (cells[iOpening] ?? "").trim() : "";
      const type = parseType(rawType);
      const opening = parseMoney(rawOpening);

      const row: ImportRow = {
        line: index + 2,
        code,
        name,
        typeLabel: type ? TYPE_LABELS[type] : rawType,
        type,
        parentCode,
        opening: Number.isNaN(opening) ? 0 : opening,
        ok: false,
        message: "",
      };

      if (!code || !ACCOUNT_CODE_PATTERN.test(code) || !name || !type || Number.isNaN(opening)) {
        row.message = "Format salah";
      } else if (existingByCode.has(code) || seen.has(code)) {
        row.message = "Kode ganda";
      } else if (parentCode && !existingByCode.has(parentCode) && !seen.has(parentCode)) {
        row.message = "Induk tidak ada";
      } else {
        row.ok = true;
        row.message = "OK";
        seen.add(code);
      }

      return row;
    });

    const okRows = rows.filter((row) => row.ok);
    const errorRows = rows.filter((row) => !row.ok);

    if (body.mode === "pratinjau") {
      return NextResponse.json({
        fileName: body.fileName,
        rows,
        total: rows.length,
        okCount: okRows.length,
        errorCount: errorRows.length,
        imported: 0,
      });
    }

    if (okRows.length === 0) rule("Tidak ada baris yang bisa diimpor — perbaiki berkas lalu unggah ulang.");
    if (!body.skipErrors && errorRows.length > 0) {
      rule(`${errorRows.length} baris bermasalah — pilih “Lewati baris error” untuk mengimpor sisanya.`);
    }

    // Akun induk yang baru dibuat di berkas ini harus bisa dipakai baris berikutnya,
    // jadi baris dibuat berurutan menurut kode.
    const ordered = [...okRows].sort((a, b) => a.code.localeCompare(b.code));
    const created = new Map<string, { id: string; level: number }>();

    for (const row of ordered) {
      const parent = row.parentCode
        ? (created.get(row.parentCode) ?? existingByCode.get(row.parentCode) ?? null)
        : null;

      const account = await db.account.create({
        data: {
          companyId: context.companyId,
          code: row.code,
          name: row.name,
          type: row.type!,
          normalBalance: normalBalanceFor(row.type!),
          parentId: parent ? parent.id : null,
          level: parent ? parent.level + 1 : 1,
          isPostable: true,
          isActive: true,
        },
        select: { id: true, code: true, level: true },
      });
      created.set(account.code, { id: account.id, level: account.level });
    }

    await recordAudit(context, {
      action: "IMPORT",
      entityType: "AccountImport",
      summary: body.fileName,
      changes: { total: rows.length, imported: okRows.length, gagal: errorRows.length },
    });

    return NextResponse.json({
      fileName: body.fileName,
      rows,
      total: rows.length,
      okCount: okRows.length,
      errorCount: errorRows.length,
      imported: okRows.length,
    });
  });
}
