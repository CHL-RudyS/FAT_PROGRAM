import "server-only";

/**
 * Bank statement parsing for screen 17 "Import Mutasi".
 *
 * The prototype's "Panduan Import" fixes the contract: columns Tanggal, Keterangan,
 * Debit, Kredit, Saldo; dates as DD/MM/YYYY; numbers without "Rp" or thousands dots;
 * at most 500 rows per file.
 */

export const MAX_ROWS = 500;
export const MAX_BYTES = 5 * 1024 * 1024;

export type ColumnKey = "date" | "description" | "reference" | "debit" | "credit" | "balance";

export type ColumnMapping = Partial<Record<ColumnKey, number>>;

export type ParsedRow = {
  lineNo: number;
  date: string | null;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number | null;
  valid: boolean;
  error: string | null;
};

export type ParseResult = {
  headers: string[];
  mapping: ColumnMapping;
  rows: ParsedRow[];
  validCount: number;
  errorCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  error?: string;
};

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  date: ["tanggal", "tgl", "date", "posting date", "tanggal transaksi"],
  description: ["keterangan", "uraian", "deskripsi", "description", "remark", "berita"],
  reference: ["ref", "referensi", "reference", "no ref", "no. ref", "no referensi"],
  debit: ["debit", "debet", "db", "mutasi debit"],
  credit: ["kredit", "credit", "cr", "mutasi kredit"],
  balance: ["saldo", "balance", "saldo akhir", "running balance"],
};

function normalizeHeader(text: string) {
  return text
    .replace(/^﻿/, "")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function detectDelimiter(line: string) {
  const candidates = [";", ",", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = line.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Minimal RFC4180 splitter: honours double quotes and doubled quotes inside them. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseStatementDate(text: string): Date | null {
  const value = text.trim();
  if (!value) return null;

  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(value);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const yearRaw = Number(dmy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (ymd) {
    const date = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** "1.234.567,89", "1234567.89" and "(1.500)" all become a plain number. */
export function parseStatementNumber(text: string): number | null {
  let value = text.trim().replace(/rp/gi, "").replace(/\s/g, "");
  if (!value || value === "-") return 0;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");
  if (hasComma && hasDot) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".")
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (hasComma) {
    value = /,\d{3}$/.test(value) ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (hasDot) {
    if (/\.\d{3}$/.test(value)) value = value.replace(/\./g, "");
  }

  if (!/^\d*(\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(normalizeHeader);
  (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
    const index = normalized.findIndex((header) => HEADER_ALIASES[key].includes(header));
    if (index >= 0) mapping[key] = index;
  });
  return mapping;
}

const REQUIRED: ColumnKey[] = ["date", "description", "debit", "credit", "balance"];

const REQUIRED_LABEL: Record<string, string> = {
  date: "Tanggal",
  description: "Keterangan",
  debit: "Debit",
  credit: "Kredit",
  balance: "Saldo",
};

export function parseStatement(text: string, override?: ColumnMapping): ParseResult {
  const empty: ParseResult = {
    headers: [],
    mapping: {},
    rows: [],
    validCount: 0,
    errorCount: 0,
    periodFrom: null,
    periodTo: null,
  };

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return { ...empty, error: "File kosong." };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter);
  const mapping = { ...detectMapping(headers), ...(override ?? {}) };
  // A negative index is the caller saying "this column is not in the file".
  (Object.keys(mapping) as ColumnKey[]).forEach((key) => {
    if ((mapping[key] as number) < 0) delete mapping[key];
  });

  const missing = REQUIRED.filter((key) => mapping[key] === undefined);
  if (missing.length > 0) {
    return {
      ...empty,
      headers,
      mapping,
      error: `Kolom wajib belum ditemukan: ${missing.map((key) => REQUIRED_LABEL[key]).join(", ")}.`,
    };
  }

  const body = lines.slice(1);
  if (body.length > MAX_ROWS) {
    return {
      ...empty,
      headers,
      mapping,
      error: `File berisi ${body.length} baris — maksimal ${MAX_ROWS} baris per file.`,
    };
  }

  const rows: ParsedRow[] = body.map((line, index) => {
    const cells = splitLine(line, delimiter);
    const cell = (key: ColumnKey) => {
      const position = mapping[key];
      return position === undefined ? "" : (cells[position] ?? "");
    };

    const rawDate = cell("date");
    const description = cell("description").trim();
    const date = parseStatementDate(rawDate);
    const debit = parseStatementNumber(cell("debit"));
    const credit = parseStatementNumber(cell("credit"));
    const rawBalance = cell("balance").trim();
    const balance = rawBalance ? parseStatementNumber(rawBalance) : null;
    const reference = cell("reference").trim() || null;

    let error: string | null = null;
    if (!date) error = "Tanggal tidak valid (DD/MM/YYYY).";
    else if (!description) error = "Keterangan kosong.";
    else if (debit === null || credit === null) error = "Nilai debit/kredit tidak valid.";
    else if (rawBalance && balance === null) error = "Saldo tidak valid.";
    else if ((debit ?? 0) === 0 && (credit ?? 0) === 0) error = "Debit dan kredit sama-sama nol.";
    else if ((debit ?? 0) !== 0 && (credit ?? 0) !== 0) error = "Debit dan kredit terisi bersamaan.";
    else if ((debit ?? 0) < 0 || (credit ?? 0) < 0) error = "Nilai tidak boleh negatif.";

    return {
      lineNo: index + 1,
      date: date ? date.toISOString() : null,
      description,
      reference,
      debit: debit ?? 0,
      credit: credit ?? 0,
      balance,
      valid: error === null,
      error,
    };
  });

  const validDates = rows
    .filter((row) => row.valid && row.date)
    .map((row) => new Date(row.date as string).getTime())
    .sort((a, b) => a - b);

  return {
    headers,
    mapping,
    rows,
    validCount: rows.filter((row) => row.valid).length,
    errorCount: rows.filter((row) => !row.valid).length,
    periodFrom: validDates.length > 0 ? new Date(validDates[0]).toISOString() : null,
    periodTo: validDates.length > 0 ? new Date(validDates[validDates.length - 1]).toISOString() : null,
  };
}
