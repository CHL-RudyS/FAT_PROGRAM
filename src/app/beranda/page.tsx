import { redirect } from "next/navigation";
import { getActiveContext, initialsOf } from "@/lib/context";
import { MAX_SHORTCUTS, SHORTCUT_DEFAULTS } from "@/lib/navigation";
import { db } from "@/lib/db";
import BerandaScreen, { type BerandaTodo } from "./BerandaScreen";


export default async function BerandaPage() {
  const context = await getActiveContext();
  if (!context) redirect("/perusahaan");

  const [unmatched, draftJournals, companies, units, saved] = await Promise.all([
    db.bankStatementLine.count({
      where: { matchStatus: "BELUM_COCOK", bankAccount: { unitId: context.unitId } },
    }),
    db.journalEntry.count({ where: { unitId: context.unitId, status: "DRAF" } }),
    db.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, colorTag: true, _count: { select: { units: true } } },
    }),
    // Carried with the page so the company switcher lists a company's units
    // the instant it is clicked — about a hundred short rows in total.
    db.businessUnit.findMany({
      where: { isActive: true, company: { isActive: true } },
      orderBy: { code: "asc" },
      select: { id: true, companyId: true, code: true, name: true },
    }),
    db.systemSetting.findUnique({ where: { key: `shortcuts:${context.user.id}` } }),
  ]);

  const unitsByCompany: Record<string, Array<{ id: string; code: string; name: string }>> = {};
  for (const { companyId, ...unit } of units) {
    (unitsByCompany[companyId] ??= []).push(unit);
  }

  const todos: BerandaTodo[] = [];
  if (unmatched > 0) {
    todos.push({
      key: "rekon",
      href: "/rekonsiliasi",
      count: unmatched,
      label: "Mutasi bank belum cocok",
      tone: "bad",
    });
  }
  if (draftJournals > 0) {
    todos.push({
      key: "jurnal",
      href: "/jurnal",
      count: draftJournals,
      label: "Jurnal masih berstatus draf",
      tone: "warn",
    });
  }

  // Trimmed on read as well as on write, so lists saved before the limit
  // existed still show the number of tiles the screen is designed around.
  const shortcuts = Array.isArray(saved?.value)
    ? (saved.value as unknown[])
        .filter((item): item is string => typeof item === "string")
        .slice(0, MAX_SHORTCUTS)
    : SHORTCUT_DEFAULTS;

  return (
    <BerandaScreen
      company={{ id: context.company.id, name: context.company.name }}
      unit={context.unit}
      user={{
        name: context.user.name,
        email: context.user.email,
        roleName: context.user.roleName,
        initials: initialsOf(context.user.name),
      }}
      todos={todos}
      shortcuts={shortcuts}
      companies={companies.map((company) => ({
        id: company.id,
        name: company.name,
        colorTag: company.colorTag,
        unitCount: company._count.units,
      }))}
      unitsByCompany={unitsByCompany}
    />
  );
}
