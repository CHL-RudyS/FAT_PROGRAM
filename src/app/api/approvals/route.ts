import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleRead } from "@/lib/api";

/** Reads the approval queue of the active company (all books of the company). */
export async function GET(request: Request) {
  return handleRead(async (context) => {
    const status = new URL(request.url).searchParams.get("status");

    const requests = await db.approvalRequest.findMany({
      where: {
        companyId: context.companyId,
        status: status === "MENUNGGU" || status === "DISETUJUI" || status === "DITOLAK" || status === "DIBATALKAN"
          ? status
          : undefined,
      },
      orderBy: { requestedAt: "asc" },
      include: {
        requester: { select: { id: true, name: true } },
        unit: { select: { id: true, code: true, name: true } },
      },
    });

    return NextResponse.json(
      requests.map((item) => ({
        id: item.id,
        kind: item.kind,
        referenceNo: item.referenceNo,
        referenceId: item.referenceId,
        requester: item.requester.name,
        unitCode: item.unit.code,
        unitName: item.unit.name,
        amount: item.amount.toString(),
        status: item.status,
        escalateNote: item.escalateNote,
        requestedAt: item.requestedAt,
        resolvedAt: item.resolvedAt,
      })),
    );
  });
}
