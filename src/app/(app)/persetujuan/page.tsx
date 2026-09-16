import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import PersetujuanScreen, { type ApprovalRow, type NotificationRow } from "./PersetujuanScreen";

const DAY = 86_400_000;

function startOfWeek(now: Date) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - weekday);
  return date;
}

/** "Hari ini" / "Kemarin" / "N hari lalu", like the prototype's notification timeline. */
function relativeDayLabel(value: Date, today: number) {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((today - day) / DAY);
  if (diff <= 0) return "Hari ini";
  if (diff === 1) return "Kemarin";
  return `${diff} hari lalu`;
}

export default async function PersetujuanPage() {
  const context = await requireActiveContext();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = startOfWeek(now);

  const [requests, units, notifications, myDecisions] = await Promise.all([
    db.approvalRequest.findMany({
      where: { companyId: context.companyId },
      orderBy: { requestedAt: "asc" },
      include: {
        requester: { select: { name: true } },
        unit: { select: { code: true, name: true } },
      },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.notification.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.approvalDecision.findMany({
      where: { approverId: context.user.id, decidedAt: { gte: weekStart } },
      select: { status: true },
    }),
  ]);

  const rows: ApprovalRow[] = requests.map((item) => ({
    id: item.id,
    kind: item.kind,
    referenceNo: item.referenceNo,
    requester: item.requester.name,
    unitCode: item.unit.code,
    unitName: item.unit.name,
    amount: toNumber(item.amount),
    status: item.status,
    escalateNote: item.escalateNote,
    waitingDays: Math.max(0, Math.floor((now.getTime() - item.requestedAt.getTime()) / DAY)),
  }));

  const resolved = requests.filter((item) => item.resolvedAt !== null);
  const averageHours =
    resolved.length === 0
      ? 0
      : resolved.reduce(
          (sum, item) => sum + (item.resolvedAt!.getTime() - item.requestedAt.getTime()) / 3_600_000,
          0,
        ) / resolved.length;

  const notificationRows: NotificationRow[] = notifications.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    when: relativeDayLabel(item.createdAt, today),
  }));

  return (
    <PersetujuanScreen
      rows={rows}
      units={units}
      notifications={notificationRows}
      unitCount={units.length}
      approvedThisWeek={myDecisions.filter((item) => item.status === "DISETUJUI").length}
      rejectedThisWeek={myDecisions.filter((item) => item.status === "DITOLAK").length}
      averageHours={averageHours}
      canDecide={
        context.user.roleCode === "ADMIN" || context.user.permissions.includes("approval.putuskan")
      }
    />
  );
}
