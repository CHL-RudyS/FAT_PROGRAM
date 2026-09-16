import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { handleRead, rule } from "@/lib/api";
import { can } from "@/lib/auth";

/** Read-only audit trail. Filters: userId, entityType, from, to (yyyy-mm-dd). */
export async function GET(request: Request) {
  return handleRead(async (context) => {
    if (!can(context.user, "audit.lihat")) rule("Tidak diizinkan melihat jejak audit.");

    const params = new URL(request.url).searchParams;
    const userId = params.get("userId") ?? "";
    const entityType = params.get("entityType") ?? "";
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
      };
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { name: true, role: { select: { name: true } } } } },
    });

    return NextResponse.json(logs);
  });
}
