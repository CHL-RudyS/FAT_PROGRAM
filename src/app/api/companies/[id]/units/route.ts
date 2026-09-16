import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/units">) {
  await requireUser();
  const { id } = await ctx.params;

  const units = await db.businessUnit.findMany({
    where: { companyId: id, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, address: true, needsWork: true, hasVariance: true },
  });

  return NextResponse.json(
    units.map(({ address, ...unit }) => ({ ...unit, city: address })),
  );
}
