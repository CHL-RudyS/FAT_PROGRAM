import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentUser } from "@/lib/auth";
import { getActiveContext, initialsOf } from "@/lib/context";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getActiveContext();
  if (!context) redirect("/perusahaan");

  const companies = await db.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, colorTag: true, _count: { select: { units: true } } },
  });

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
