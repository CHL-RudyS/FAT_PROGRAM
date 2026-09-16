import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import PenggunaScreen, { type PermissionRow, type RoleRow, type UserRow } from "./PenggunaScreen";

export default async function PenggunaPage() {
  const context = await requireActiveContext();

  const [users, roles, permissions, companies, units] = await Promise.all([
    db.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        jobTitle: true,
        phone: true,
        role: { select: { id: true, code: true, name: true } },
        unitAccess: { select: { unitId: true, unit: { select: { companyId: true } } } },
      },
    }),
    db.role.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { code: true } } } },
      },
    }),
    db.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] }),
    db.company.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true, legalForm: true } }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const userRows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    jobTitle: user.jobTitle,
    phone: user.phone,
    roleId: user.role.id,
    roleCode: user.role.code,
    roleName: user.role.name,
    companyIds: [...new Set(user.unitAccess.map((grant) => grant.unit.companyId))],
    unitIds: user.unitAccess.map((grant) => grant.unitId),
  }));

  const roleRows: RoleRow[] = roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((entry) => entry.permission.code),
  }));

  const permissionRows: PermissionRow[] = permissions.map((permission) => ({
    code: permission.code,
    module: permission.module,
    action: permission.action,
    description: permission.description,
  }));

  return (
    <PenggunaScreen
      users={userRows}
      roles={roleRows}
      permissions={permissionRows}
      companies={companies.map((company) => ({
        id: company.id,
        label: company.legalForm ? `${company.legalForm} ${company.name}` : company.name,
        code: company.code,
      }))}
      units={units}
      activeCompanyName={context.company.name}
      canManage={context.user.roleCode === "ADMIN" || context.user.permissions.includes("pengguna.kelola")}
    />
  );
}
