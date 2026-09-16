import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { initialsOf } from "@/lib/context";
import { db } from "@/lib/db";
import PerusahaanScreen from "./PerusahaanScreen";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatLogin(date: Date | null) {
  if (!date) return "Login —";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `Login ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} · ${hh}:${mm} WIB`;
}

export default async function PerusahaanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [companies, record] = await Promise.all([
    db.company.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, colorTag: true, _count: { select: { units: true } } },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { lastLoginAt: true } }),
  ]);

  return (
    <PerusahaanScreen
      companies={companies.map((company) => ({
        id: company.id,
        name: company.name,
        colorTag: company.colorTag,
        unitCount: company._count.units,
      }))}
      user={{ name: user.name, roleName: user.roleName, initials: initialsOf(user.name) }}
      lastLogin={formatLogin(record?.lastLoginAt ?? null)}
    />
  );
}
