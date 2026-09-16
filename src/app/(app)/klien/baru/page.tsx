import { readLegalForms } from "@/app/api/settings/_legal-forms";
import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import KlienBaruScreen from "./KlienBaruScreen";

export default async function KlienBaruPage() {
  const context = await requireActiveContext();

  const [legalForms, parents] = await Promise.all([
    readLegalForms(),
    db.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalForm: true },
    }),
  ]);

  return (
    <KlienBaruScreen
      legalForms={legalForms}
      parents={parents}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("setelan.kelola")}
    />
  );
}
