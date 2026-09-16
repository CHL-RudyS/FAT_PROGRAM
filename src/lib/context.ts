import "server-only";
import { db } from "@/lib/db";
import { getCurrentUser, getSessionPayload, type CurrentUser } from "@/lib/auth";

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
  // The company/unit ids live in the signed cookie, so this lookup does not
  // depend on the user row — the two queries run side by side instead of in
  // sequence, which halves the database round trips on every screen.
  const payload = await getSessionPayload();
  if (!payload?.companyId || !payload.unitId) return null;

  const [user, unit] = await Promise.all([
    getCurrentUser(),
    db.businessUnit.findFirst({
      where: { id: payload.unitId, companyId: payload.companyId },
      include: { company: { select: { id: true, name: true, colorTag: true } } },
    }),
  ]);
  if (!user || !unit) return null;

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
