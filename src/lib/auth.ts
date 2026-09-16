import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionExpiry,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  locale: "ID" | "EN";
  jobTitle: string | null;
  roleCode: string;
  roleName: string;
  permissions: string[];
  companyId?: string;
  unitId?: string;
};

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * Reads and verifies the session cookie without touching the database, so a
 * caller can learn the company/unit ids before deciding what to query.
 */
export async function getSessionPayload(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { tokenId: payload.tokenId },
    include: {
      user: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.status !== "AKTIF") return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    locale: session.user.locale,
    jobTitle: session.user.jobTitle,
    roleCode: session.user.role.code,
    roleName: session.user.role.name,
    permissions: session.user.role.permissions.map((entry) => entry.permission.code),
    companyId: payload.companyId,
    unitId: payload.unitId,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function can(user: CurrentUser, permission: string) {
  return user.roleCode === "ADMIN" || user.permissions.includes(permission);
}

export async function createSession(userId: string, roleCode: string) {
  const headerList = await headers();
  const tokenId = randomUUID();
  const expiresAt = sessionExpiry();

  await db.session.create({
    data: {
      userId,
      tokenId,
      expiresAt,
      device: headerList.get("user-agent")?.slice(0, 180) ?? null,
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });

  const token = await signSession({ userId, tokenId, roleCode });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: expiresAt });
}

/** Re-issues the session cookie carrying the selected company/unit context. */
export async function setActiveContext(companyId: string, unitId?: string) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("UNAUTHORIZED");

  const payload = await verifySession(token);
  if (!payload) throw new Error("UNAUTHORIZED");

  const next = await signSession({ ...payload, companyId, unitId });
  store.set(SESSION_COOKIE, next, { ...sessionCookieOptions, expires: sessionExpiry() });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = await verifySession(token);
    if (payload) {
      await db.session.updateMany({
        where: { tokenId: payload.tokenId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }
  store.delete(SESSION_COOKIE);
}
