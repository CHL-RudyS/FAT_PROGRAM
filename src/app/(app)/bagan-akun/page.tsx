import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import BaganAkunScreen, { type AccountNode } from "./BaganAkunScreen";

type Loaded = {
  id: string;
  code: string;
  name: string;
  type: AccountNode["type"];
  normalBalance: "DEBIT" | "KREDIT";
  parentId: string | null;
  level: number;
  isPostable: boolean;
  isActive: boolean;
  journalLines: { debit: unknown; credit: unknown }[];
};

export default async function BaganAkunPage() {
  const context = await requireActiveContext();

  const accounts = (await db.account.findMany({
    where: { companyId: context.companyId },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      parentId: true,
      level: true,
      isPostable: true,
      isActive: true,
      journalLines: {
        where: { entry: { status: "DIPOSTING" } },
        select: { debit: true, credit: true },
      },
    },
  })) as unknown as Loaded[];

  const byId = new Map(accounts.map((account) => [account.id, account]));

  // Akun kelompok (x-0000, tidak bisa menerima jurnal) menjadi induk implisit bagi
  // akun sekelompok yang belum punya parentId sendiri.
  const groupByPrefix = new Map<string, Loaded>();
  for (const account of accounts) {
    if (account.parentId || account.isPostable) continue;
    const prefix = account.code.charAt(0);
    if (!groupByPrefix.has(prefix)) groupByPrefix.set(prefix, account);
  }

  function parentOf(account: Loaded): Loaded | null {
    if (account.parentId) {
      const explicit = byId.get(account.parentId);
      if (explicit) return explicit;
    }
    const group = groupByPrefix.get(account.code.charAt(0));
    return group && group.id !== account.id ? group : null;
  }

  const childrenOf = new Map<string, Loaded[]>();
  const roots: Loaded[] = [];
  for (const account of accounts) {
    const parent = parentOf(account);
    if (!parent) {
      roots.push(account);
      continue;
    }
    const bucket = childrenOf.get(parent.id);
    if (bucket) bucket.push(account);
    else childrenOf.set(parent.id, [account]);
  }

  function ownBalance(account: Loaded) {
    const total = account.journalLines.reduce(
      (sum, line) => sum + toNumber(line.debit as never) - toNumber(line.credit as never),
      0,
    );
    return account.normalBalance === "DEBIT" ? total : -total;
  }

  // Akun penampung (Sub / Parent Sub / Main) hanya memegang saldo turunannya.
  const nodes: AccountNode[] = [];
  function walk(account: Loaded, depth: number, rootId: string): number {
    const index = nodes.length;
    const children = childrenOf.get(account.id) ?? [];
    nodes.push({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      parentId: account.parentId,
      isPostable: account.isPostable,
      isActive: account.isActive,
      depth,
      rootId,
      hasChildren: children.length > 0,
      balance: 0,
    });
    let total = ownBalance(account);
    for (const child of children) total += walk(child, depth + 1, rootId);
    nodes[index].balance = total;
    return total;
  }
  for (const root of roots) walk(root, 0, root.id);

  return (
    <BaganAkunScreen
      nodes={nodes}
      unitLabel={`${context.unit.code} · ${context.unit.name}`}
      unitCode={context.unit.code}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("coa.ubah")}
    />
  );
}
