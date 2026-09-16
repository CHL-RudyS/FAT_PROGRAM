import "server-only";
import { db } from "@/lib/db";

export type LegalForm = { code: string; label: string };

export const LEGAL_FORMS_KEY = "legalForms";

/** Reads SystemSetting "legalForms" — an array of { code, label }. */
export async function readLegalForms(): Promise<LegalForm[]> {
  const setting = await db.systemSetting.findUnique({ where: { key: LEGAL_FORMS_KEY } });
  if (!setting || !Array.isArray(setting.value)) return [];
  return (setting.value as unknown[]).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.code !== "string") return [];
    return [{ code: record.code, label: typeof record.label === "string" ? record.label : "" }];
  });
}

export async function writeLegalForms(forms: LegalForm[]) {
  await db.systemSetting.upsert({
    where: { key: LEGAL_FORMS_KEY },
    update: { value: forms },
    create: { key: LEGAL_FORMS_KEY, value: forms },
  });
}
