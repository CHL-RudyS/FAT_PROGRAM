import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_ID, toNumber } from "@/lib/format";
import BukuBesarScreen, { type LedgerRow, type LedgerAccount, type LedgerUnit } from "./BukuBesarScreen";

type Search = { akun?: string; buku?: string; dari?: string; sampai?: string };

function parseDate(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "1 – 30 September 2026" atau "1 Agustus – 30 September 2026". */
function rangeLabel(from: Date, to: Date) {
  const tail = `${to.getDate()} ${MONTHS_ID[to.getMonth()]} ${to.getFullYear()}`;
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${from.getDate()} – ${tail}`;
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} ${MONTHS_ID[from.getMonth()]} – ${tail}`;
  }
  return `${from.getDate()} ${MONTHS_ID[from.getMonth()]} ${from.getFullYear()} – ${tail}`;
}

export default async function BukuBesarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const context = await requireActiveContext();
  const query = await searchParams;

  const [accounts, units] = await Promise.all([
    db.account.findMany({
      where: { companyId: context.companyId, isPostable: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, normalBalance: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const from = parseDate(query.dari, defaultFrom);
  const to = parseDate(query.sampai, defaultTo);
  const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  const account = accounts.find((item) => item.id === query.akun) ?? accounts[0] ?? null;
  // "gabungan" = semua buku unit perusahaan digabung dalam satu buku besar.
  const unitId = query.buku === "gabungan" ? "" : (units.find((unit) => unit.id === query.buku)?.id ?? context.unitId);

  let opening = 0;
  let rows: LedgerRow[] = [];

  if (account) {
    const entryWhere = {
      companyId: context.companyId,
      status: "DIPOSTING" as const,
      ...(unitId ? { unitId } : {}),
    };

    const before = await db.journalLine.findMany({
      where: { accountId: account.id, entry: { ...entryWhere, date: { lt: from } } },
      select: { debit: true, credit: true },
    });
    const openingRaw = before.reduce((sum, line) => sum + toNumber(line.debit) - toNumber(line.credit), 0);
    opening = account.normalBalance === "DEBIT" ? openingRaw : -openingRaw;

    const lines = await db.journalLine.findMany({
      where: { accountId: account.id, entry: { ...entryWhere, date: { gte: from, lte: toEnd } } },
      orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }, { lineNo: "asc" }],
      select: {
        id: true,
        description: true,
        debit: true,
        credit: true,
        entry: {
          select: { number: true, date: true, description: true, unit: { select: { code: true } } },
        },
      },
    });

    let running = opening;
    rows = lines.map((line) => {
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      running += account.normalBalance === "DEBIT" ? debit - credit : credit - debit;
      return {
        id: line.id,
        date: line.entry.date.toISOString(),
        number: line.entry.number,
        unitCode: line.entry.unit.code,
        description: line.description ?? line.entry.description,
        debit,
        credit,
        balance: running,
      };
    });
  }

  const closing = rows.length > 0 ? rows[rows.length - 1].balance : opening;
  const activeUnit = units.find((unit) => unit.id === unitId) ?? null;

  const accountOptions: LedgerAccount[] = accounts.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
  }));
  const unitOptions: LedgerUnit[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  const subtitle = account
    ? `${account.code} · ${account.name} · ${activeUnit ? `buku ${activeUnit.code} ${activeUnit.name}` : "semua buku (gabungan)"} · ${rangeLabel(from, to)}`
    : `${rangeLabel(from, to)}`;

  return (
    <BukuBesarScreen
      accounts={accountOptions}
      units={unitOptions}
      rows={rows}
      opening={opening}
      closing={closing}
      accountId={account?.id ?? ""}
      accountLabel={account ? `${account.code} · ${account.name}` : ""}
      unitValue={unitId || "gabungan"}
      unitLabel={activeUnit ? `${activeUnit.code} ${activeUnit.name}` : ""}
      from={inputDate(from)}
      to={inputDate(to)}
      subtitle={subtitle}
    />
  );
}
