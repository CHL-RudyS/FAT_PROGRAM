import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import JurnalScreen, { type JournalRow, type LedgerAccountOption, type UnitOption } from "./JurnalScreen";

/** Nomor berikutnya hanya ditampilkan — urutannya baru dipakai saat jurnal disimpan. */
function previewNumber(pattern: string, sequence: number) {
  const now = new Date();
  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}

export default async function JurnalPage() {
  const context = await requireActiveContext();

  const [accounts, units, entries, numbering] = await Promise.all([
    db.account.findMany({
      where: { companyId: context.companyId, isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.journalEntry.findMany({
      where: { companyId: context.companyId, status: "DIPOSTING" },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 100,
      select: {
        id: true,
        number: true,
        date: true,
        description: true,
        reference: true,
        source: true,
        unit: { select: { id: true, code: true, name: true } },
        lines: { select: { debit: true } },
      },
    }),
    db.documentNumbering.findUnique({
      where: { companyId_docType: { companyId: context.companyId, docType: "JURNAL" } },
      select: { pattern: true, nextNumber: true },
    }),
  ]);

  const rows: JournalRow[] = entries.map((entry) => ({
    id: entry.id,
    number: entry.number,
    date: entry.date.toISOString(),
    description: entry.description,
    reference: entry.reference,
    source: entry.source,
    unitId: entry.unit.id,
    unitCode: entry.unit.code,
    amount: entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0),
  }));

  const accountOptions: LedgerAccountOption[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  return (
    <JurnalScreen
      accounts={accountOptions}
      units={unitOptions}
      entries={rows}
      unitId={context.unitId}
      nextNumber={previewNumber(numbering?.pattern ?? "JU/{YYYY}/{MM}/{####}", numbering?.nextNumber ?? 1)}
      canPost={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting")}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.ubah")}
    />
  );
}
