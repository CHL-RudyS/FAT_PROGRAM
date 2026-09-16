import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/units">) {
  const { id } = await ctx.params;

  // The lookup does not depend on who is asking, so it goes out alongside the
  // session check rather than after it — one round trip to the database
  // instead of two. Nothing is returned until requireUser has resolved.
  const [, units] = await Promise.all([
    requireUser(),
    db.businessUnit.findMany({
      where: { companyId: id, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, address: true, needsWork: true, hasVariance: true },
    }),
  ]);

  return NextResponse.json(
    units.map(({ address, ...unit }) => ({ ...unit, city: address })),
  );
}
