import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const schema = z.object({ sessionId: z.string().min(1).optional(), all: z.boolean().optional() });

/** Ends one other device session, or every other one when `all` is true. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const current = token ? await verifySession(token) : null;

    if (parsed.data.all) {
      const result = await db.session.updateMany({
        where: { userId: user.id, revokedAt: null, ...(current ? { NOT: { tokenId: current.tokenId } } : {}) },
        data: { revokedAt: new Date() },
      });
      await db.auditLog.create({
        data: { userId: user.id, action: "UPDATE", entityType: "Session", summary: `Akhiri ${result.count} sesi lain` },
      });
      return NextResponse.json({ ok: true, ended: result.count });
    }

    if (!parsed.data.sessionId) {
      return NextResponse.json({ error: "Sesi tidak disebutkan." }, { status: 400 });
    }

    const target = await db.session.findFirst({
      where: { id: parsed.data.sessionId, userId: user.id, revokedAt: null },
      select: { id: true, tokenId: true },
    });
    if (!target) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
    if (current && target.tokenId === current.tokenId) {
      return NextResponse.json({ error: "Sesi ini sedang dipakai. Gunakan Keluar untuk mengakhirinya." }, { status: 422 });
    }

    await db.session.update({ where: { id: target.id }, data: { revokedAt: new Date() } });
    await db.auditLog.create({
      data: { userId: user.id, action: "UPDATE", entityType: "Session", entityId: target.id, summary: "Akhiri sesi perangkat" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
