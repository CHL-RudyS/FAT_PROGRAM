import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

/** Folders of the prototype's folder pane (screen 04). */
export const MAIL_FOLDERS = [
  "masuk",
  "bank",
  "pajak",
  "vendor",
  "hrd",
  "audit",
  "draf",
  "terkirim",
  "outbox",
  "sampah",
  "chl",
  "chlbukti",
] as const;

const folderSchema = z.enum(MAIL_FOLDERS);

const composeSchema = z.object({
  to: z.string().trim().min(1, "Alamat tujuan harus diisi.").max(180),
  cc: z.string().trim().max(180).optional(),
  priority: z.enum(["Normal", "Tinggi", "Rendah"]).default("Normal"),
  subject: z.string().trim().min(1, "Subjek harus diisi.").max(240),
  body: z.string().trim().min(1, "Isi pesan harus diisi.").max(8000),
  draft: z.boolean().default(false),
});

const patchSchema = z.object({
  id: z.string().trim().min(1),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  folder: folderSchema.optional(),
});

export async function GET(request: Request) {
  return handleRead(async () => {
    const folder = new URL(request.url).searchParams.get("folder");
    const messages = await db.mailMessage.findMany({
      where: folder ? { folder } : undefined,
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
    return NextResponse.json(messages);
  });
}

/** Composing a message writes a real row — sent messages land in "terkirim", drafts in "draf". */
export async function POST(request: Request) {
  return handle(request, composeSchema, async ({ body, context }) => {
    const message = await db.mailMessage.create({
      data: {
        folder: body.draft ? "draf" : "terkirim",
        fromName: context.user.name,
        fromEmail: context.user.email,
        toEmail: body.cc ? `${body.to}; cc: ${body.cc}` : body.to,
        subject: body.priority === "Normal" ? body.subject : `[${body.priority}] ${body.subject}`,
        body: body.body,
        isRead: true,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "MailMessage",
      entityId: message.id,
      summary: `${body.draft ? "Simpan draf" : "Kirim"} pesan “${body.subject}” ke ${body.to}`,
    });

    return NextResponse.json(message, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle(request, patchSchema, async ({ body }) => {
    const existing = await db.mailMessage.findUnique({ where: { id: body.id }, select: { id: true } });
    if (!existing) rule("Pesan tidak ditemukan.");

    const message = await db.mailMessage.update({
      where: { id: body.id },
      data: {
        isRead: body.isRead,
        isStarred: body.isStarred,
        folder: body.folder,
      },
    });

    return NextResponse.json(message);
  });
}
