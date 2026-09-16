import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getSessionPayload } from "@/lib/auth";
import { getActiveContext, initialsOf } from "@/lib/context";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Reading the cookie costs nothing, and it rules out the two redirect cases
  // before any query runs — so the remaining lookups can all go out at once.
  const payload = await getSessionPayload();
  if (!payload) redirect("/login");
  if (!payload.companyId || !payload.unitId) redirect("/perusahaan");

  const [context, companies] = await Promise.all([
    getActiveContext(),
    db.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, colorTag: true, _count: { select: { units: true } } },
    }),
  ]);
  if (!context) redirect("/perusahaan");

  const user = context.user;

  return (
    <AppShell
      context={{
        user: { name: user.name, roleName: user.roleName, initials: initialsOf(user.name) },
        company: { id: context.company.id, name: context.company.name },
        unit: context.unit,
        companies: companies.map((company) => ({
          id: company.id,
          name: company.name,
          colorTag: company.colorTag,
          unitCount: company._count.units,
        })),
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </AppShell>
  );
}
