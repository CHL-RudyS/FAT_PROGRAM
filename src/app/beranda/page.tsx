import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import BerandaScreen, { type BerandaTodo } from "./BerandaScreen";

const SHORTCUT_DEFAULTS = ["ledger", "dash", "email", "internet"];

export default async function BerandaPage() {
  const context = await getActiveContext();
  if (!context) redirect("/perusahaan");

  const [unmatched, draftJournals, companies, saved] = await Promise.all([
    db.bankStatementLine.count({
      where: { matchStatus: "BELUM_COCOK", bankAccount: { unitId: context.unitId } },
    }),
    db.journalEntry.count({ where: { unitId: context.unitId, status: "DRAF" } }),
    db.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, colorTag: true, _count: { select: { units: true } } },
    }),
    db.systemSetting.findUnique({ where: { key: `shortcuts:${context.user.id}` } }),
  ]);

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

  const shortcuts = Array.isArray(saved?.value)
    ? (saved.value as unknown[]).filter((item): item is string => typeof item === "string")
    : SHORTCUT_DEFAULTS;

  return (
    <BerandaScreen
      company={{ id: context.company.id, name: context.company.name }}
      unit={context.unit}
      todos={todos}
      shortcuts={shortcuts}
      companies={companies.map((company) => ({
        id: company.id,
        name: company.name,
        colorTag: company.colorTag,
        unitCount: company._count.units,
      }))}
    />
  );
}
