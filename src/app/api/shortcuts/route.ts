import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ALL_MODULES } from "@/lib/navigation";

const schema = z.object({ keys: z.array(z.string()).max(24) });

export const SHORTCUT_DEFAULTS = ["ledger", "dash", "email", "internet"];

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pilihan pintasan tidak valid." }, { status: 400 });
  }

  const allowed = new Set(ALL_MODULES.map((entry) => entry.key));
  const keys = parsed.data.keys.filter((key) => allowed.has(key));

  await db.systemSetting.upsert({
    where: { key: `shortcuts:${user.id}` },
    update: { value: keys },
    create: { key: `shortcuts:${user.id}`, value: keys },
  });

  return NextResponse.json({ ok: true, keys });
}
