import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "chl_session";
const SESSION_DAYS = 7;

export type SessionPayload = {
  userId: string;
  tokenId: string;
  roleCode: string;
  companyId?: string;
  unitId?: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(value);
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || typeof payload.tokenId !== "string") return null;
    return {
      userId: payload.userId,
      tokenId: payload.tokenId,
      roleCode: typeof payload.roleCode === "string" ? payload.roleCode : "",
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      unitId: typeof payload.unitId === "string" ? payload.unitId : undefined,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
