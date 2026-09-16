import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead } from "@/lib/api";

const markSchema = z.object({
  /** Omit to mark every unread notification of the signed-in user as read. */
  ids: z.array(z.string().trim().min(1)).optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const notifications = await db.notification.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json(notifications);
  });
}

export async function PATCH(request: Request) {
  return handle(request, markSchema, async ({ body, context }) => {
    const result = await db.notification.updateMany({
      where: {
        userId: context.user.id,
        readAt: null,
        id: body.ids ? { in: body.ids } : undefined,
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ updated: result.count });
  });
}
