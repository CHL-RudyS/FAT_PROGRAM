import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await db.auditLog.create({
      data: { userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id, summary: "Keluar dari sistem" },
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
