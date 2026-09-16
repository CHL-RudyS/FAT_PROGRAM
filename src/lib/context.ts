import "server-only";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/auth";

export type ActiveContext = {
  user: CurrentUser;
  companyId: string;
  unitId: string;
  company: { id: string; name: string; colorTag: string | null };
  unit: { id: string; code: string; name: string };
};

/**
 * Resolves the company/unit the session is working in. Every module screen and
 * API route scopes its queries by these ids.
 */
export async function getActiveContext(): Promise<ActiveContext | null> {
  const user = await requireUser();
  if (!user.companyId || !user.unitId) return null;

  const unit = await db.businessUnit.findFirst({
    where: { id: user.unitId, companyId: user.companyId },
    include: { company: { select: { id: true, name: true, colorTag: true } } },
  });
  if (!unit) return null;

  return {
    user,
    companyId: unit.companyId,
    unitId: unit.id,
    company: unit.company,
    unit: { id: unit.id, code: unit.code, name: unit.name },
  };
}

export async function requireActiveContext(): Promise<ActiveContext> {
  const context = await getActiveContext();
  if (!context) throw new Error("NO_ACTIVE_CONTEXT");
  return context;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
