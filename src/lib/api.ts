import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { requireActiveContext, type ActiveContext } from "@/lib/context";
import { db } from "@/lib/db";

export type ApiHandler<T> = (input: { body: T; context: ActiveContext }) => Promise<NextResponse>;

/** Wraps a route handler: auth + active company/unit + zod validation + error shape. */
export async function handle<T>(request: Request, schema: ZodType<T>, handler: ApiHandler<T>) {
  try {
    const context = await requireActiveContext();
    const body = schema.parse(await request.json());
    return await handler({ body, context });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Same as `handle` but for routes without a request body (GET/DELETE). */
export async function handleRead(handler: (context: ActiveContext) => Promise<NextResponse>) {
  try {
    return await handler(await requireActiveContext());
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Data tidak valid.", field: first?.path.join(".") },
      { status: 400 },
    );
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
    if (error.message === "NO_ACTIVE_CONTEXT") {
      return NextResponse.json({ error: "Pilih perusahaan dan unit bisnis dulu." }, { status: 409 });
    }
    if (error.message.startsWith("RULE:")) {
      return NextResponse.json({ error: error.message.slice(5) }, { status: 422 });
    }
  }
  console.error(error);
  return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
}

/** Throws a business-rule violation that `handle` turns into a 422 with this message. */
export function rule(message: string): never {
  throw new Error(`RULE:${message}`);
}

export async function recordAudit(
  context: ActiveContext,
  input: { action: string; entityType: string; entityId?: string; summary?: string; changes?: unknown },
) {
  await db.auditLog.create({
    data: {
      userId: context.user.id,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      changes: input.changes === undefined ? undefined : JSON.parse(JSON.stringify(input.changes)),
    },
  });
}

/**
 * Builds the next document number from the company's numbering pattern,
 * e.g. "JU/{YYYY}/{MM}/{####}" -> "JU/2026/09/0007".
 */
export async function nextDocumentNumber(companyId: string, docType: string, fallbackPrefix: string) {
  const numbering = await db.documentNumbering.findUnique({
    where: { companyId_docType: { companyId, docType } },
  });

  const now = new Date();
  const pattern = numbering?.pattern ?? `${fallbackPrefix}/{YYYY}/{MM}/{####}`;
  const sequence = numbering?.nextNumber ?? 1;

  if (numbering) {
    await db.documentNumbering.update({
      where: { id: numbering.id },
      data: { nextNumber: sequence + 1 },
    });
  }

  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}
