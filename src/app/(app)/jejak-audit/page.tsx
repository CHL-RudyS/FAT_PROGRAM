import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import JejakAuditScreen, { type AuditRow } from "./JejakAuditScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function JejakAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireActiveContext();
  const params = await searchParams;

  const userId = single(params.userId);
  const entityType = single(params.entityType);
  const from = single(params.from);
  const to = single(params.to);

  const [logs, users, entityTypes] = await Promise.all([
    db.auditLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(entityType ? { entityType } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { name: true, role: { select: { name: true } } } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    userName: log.user?.name ?? null,
    roleName: log.user?.role.name ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    summary: log.summary,
    changes: log.changes === null || log.changes === undefined ? null : JSON.stringify(log.changes),
  }));

  return (
    <JejakAuditScreen
      rows={rows}
      users={users}
      entityTypes={entityTypes.map((entry) => entry.entityType)}
      filters={{ userId, entityType, from, to }}
    />
  );
}
