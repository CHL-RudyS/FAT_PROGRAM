import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import PonselScreen, { type PonselRow } from "./PonselScreen";

const DAY = 86_400_000;

export default async function PersetujuanPonselPage() {
  const context = await requireActiveContext();
  const now = new Date();

  const [requests, unitCount] = await Promise.all([
    db.approvalRequest.findMany({
      where: { companyId: context.companyId },
      orderBy: { requestedAt: "asc" },
      include: {
        requester: { select: { name: true } },
        unit: { select: { code: true } },
      },
    }),
    db.businessUnit.count({ where: { companyId: context.companyId } }),
  ]);

  const rows: PonselRow[] = requests.map((item) => ({
    id: item.id,
    kind: item.kind,
    referenceNo: item.referenceNo,
    requester: item.requester.name,
    unitCode: item.unit.code,
    amount: toNumber(item.amount),
    status: item.status,
    escalateNote: item.escalateNote,
    waitingDays: Math.max(0, Math.floor((now.getTime() - item.requestedAt.getTime()) / DAY)),
  }));

  return (
    <PonselScreen
      rows={rows}
      unitCount={unitCount}
      companyName={context.company.name}
      canDecide={
        context.user.roleCode === "ADMIN" || context.user.permissions.includes("approval.putuskan")
      }
    />
  );
}
