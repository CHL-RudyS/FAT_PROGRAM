import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import ImportBaganAkunScreen, { type ImportHistoryRow } from "./ImportBaganAkunScreen";

export default async function ImportBaganAkunPage() {
  const context = await requireActiveContext();

  const logs = await db.auditLog.findMany({
    where: { entityType: "AccountImport" },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, summary: true, changes: true },
  });

  const history: ImportHistoryRow[] = logs.map((log) => {
    const changes = (log.changes ?? {}) as { imported?: number; gagal?: number; total?: number };
    const imported = typeof changes.imported === "number" ? changes.imported : 0;
    return {
      id: log.id,
      fileName: log.summary ?? "—",
      rows: imported,
      ok: imported > 0,
    };
  });

  return (
    <ImportBaganAkunScreen
      history={history}
      unitCode={context.unit.code}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("coa.ubah")}
    />
  );
}
