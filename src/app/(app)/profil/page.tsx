import { requireActiveContext, initialsOf } from "@/lib/context";
import { db } from "@/lib/db";
import ProfilScreen from "./ProfilScreen";

export default async function ProfilPage() {
  const context = await requireActiveContext();

  const [user, sessions, units, prefs, entityCount, lastPasswordChange] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: context.user.id },
      select: { id: true, name: true, email: true, jobTitle: true, phone: true, locale: true },
    }),
    db.session.findMany({
      where: { userId: context.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
      select: { id: true, device: true, ipAddress: true, lastActiveAt: true, createdAt: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.systemSetting.findUnique({ where: { key: `prefs:${context.user.id}` } }),
    db.company.count({ where: { isActive: true } }),
    db.auditLog.findFirst({
      where: { userId: context.user.id, entityType: "User", summary: { contains: "kata sandi" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const preferences = (prefs?.value ?? {}) as Record<string, unknown>;

  return (
    <ProfilScreen
      user={{
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        phone: user.phone,
        locale: user.locale,
        initials: initialsOf(user.name),
        roleName: context.user.roleName,
      }}
      entityCount={entityCount}
      units={units}
      activeUnitId={context.unitId}
      sessions={sessions.map((session) => ({
        id: session.id,
        device: session.device,
        location: session.ipAddress,
        lastActiveAt: session.lastActiveAt.toISOString(),
      }))}
      preferences={{
        startScreen: typeof preferences.startScreen === "string" ? preferences.startScreen : "Beranda modul",
        density: typeof preferences.density === "string" ? preferences.density : "Normal",
        dateFormat: typeof preferences.dateFormat === "string" ? preferences.dateFormat : "31 Agu 2026",
        emailNotifications: Array.isArray(preferences.emailNotifications)
          ? (preferences.emailNotifications as unknown[]).filter((item): item is string => typeof item === "string")
          : ["approval", "import", "period"],
      }}
      passwordChangedAt={lastPasswordChange?.createdAt.toISOString() ?? null}
    />
  );
}
