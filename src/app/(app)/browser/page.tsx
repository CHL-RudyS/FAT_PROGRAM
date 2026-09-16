import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_ID } from "@/lib/format";
import BrowserScreen from "./BrowserScreen";

export default async function BrowserPage() {
  const context = await requireActiveContext();

  const company = await db.company.findUnique({
    where: { id: context.companyId },
    select: { name: true, npwp: true },
  });

  const now = new Date();

  return (
    <BrowserScreen
      companyName={company?.name ?? context.company.name}
      npwp={company?.npwp ?? "—"}
      userName={context.user.name}
      periodLabel={`${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`}
    />
  );
}
