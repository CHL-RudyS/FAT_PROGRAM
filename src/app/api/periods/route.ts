import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleRead } from "@/lib/api";

export async function GET() {
  return handleRead(async (context) => {
    const periods = await db.fiscalPeriod.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        closedAt: true,
        closedBy: { select: { name: true } },
      },
    });
    return NextResponse.json(periods);
  });
}
