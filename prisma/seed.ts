import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const COMPANIES: Array<[string, string, number]> = [
  ["CIPTA HARMONI LESTARI", "#2E86AB", 12],
  ["CIPTA SELARAS CEMERLANG", "#1F5E80", 7],
  ["HARMONI ADIL SELARAS", "#3C7A5A", 3],
  ["SERPONG BANGUN CIPTA", "#8A6A3B", 3],
  ["SERPONG BANGUN LESTARI", "#7A4B6B", 5],
  ["PERTIWI AGUNG LESTARI", "#2F6F6F", 5],
  ["BANGUN INDAH HARMONI", "#5A6B2F", 1],
  ["BUMI MAHARDIKA MAKMUR", "#8A4B3B", 1],
  ["GEMA GRIYA INSANI", "#3B5A8A", 6],
  ["GRAHA BUMI TIRTA", "#6B4B8A", 6],
  ["SOLOHANA HARMONI LESTARI", "#2E86AB", 12],
  ["GRIYA GARDENIA INDAH CIPTA HARMONI LESTARI SELARAS CEMERLANG PERKASA", "#1F5E80", 7],
  ["GRIYA BHAKTI HARMONI", "#3C7A5A", 3],
  ["HARMONI INDAH SENTOSA", "#8A6A3B", 3],
  ["KREASI KELOLA SEJAHTERA", "#7A4B6B", 5],
  ["GRIYA KIRANA PROPERTINDO", "#2F6F6F", 5],
  ["SERPONG INDO RAYA", "#5A6B2F", 1],
  ["AGRO CIPTA HARMONI", "#8A4B3B", 1],
  ["BHAKTI BANGUN HARMONI", "#3B5A8A", 6],
  ["BUANA PERMAI LUHUR", "#6B4B8A", 6],
  ["BANGUN INTI ABADI", "#2E86AB", 3],
  ["CIPTA HARMONI LESTARI SELARAS CEMERLANG", "#2E86AB", 3],
];

const INDUSTRIES = [
  "Perdagangan air minum",
  "Perkebunan",
  "Ekspedisi & pergudangan",
  "Perdagangan bahan bangunan",
  "Distribusi farmasi",
  "Properti & persewaan",
  "Perdagangan hasil tani",
  "Perdagangan elektronik",
  "Perdagangan hasil laut",
  "Koperasi konsumen",
  "Percetakan",
  "Industri tekstil",
  "Kontraktor sipil",
  "Industri makanan",
  "Klinik & alat kesehatan",
  "Perdagangan umum",
  "Jasa konstruksi",
];

const UNIT_POOL: Array<[string, string, string]> = [
  ["PST", "Unit Pusat", "Jakarta"],
  ["SRP", "Unit Serpong", "Tangerang Selatan"],
  ["BDG", "Unit Bandung", "Bandung"],
  ["SBY", "Unit Surabaya", "Surabaya"],
  ["MDN", "Unit Medan", "Medan"],
  ["SMG", "Unit Semarang", "Semarang"],
  ["MKS", "Unit Makassar", "Makassar"],
  ["DPS", "Unit Denpasar", "Denpasar"],
  ["PLB", "Unit Palembang", "Palembang"],
  ["BPP", "Unit Balikpapan", "Balikpapan"],
  ["PKU", "Unit Pekanbaru", "Pekanbaru"],
  ["YOG", "Unit Yogyakarta", "Yogyakarta"],
];

type AccountSeed = {
  code: string;
  name: string;
  type: "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
  postable?: boolean;
};

const ACCOUNTS: AccountSeed[] = [
  { code: "1-0000", name: "ASET", type: "ASET", postable: false },
  { code: "1-1000", name: "Kas", type: "ASET" },
  { code: "1-1100", name: "Bank", type: "ASET" },
  { code: "1-1120", name: "Kas Kecil", type: "ASET" },
  { code: "1-1200", name: "Piutang Usaha", type: "ASET" },
  { code: "1-1300", name: "Persediaan", type: "ASET" },
  { code: "1-1400", name: "PPN Masukan", type: "ASET" },
  { code: "1-1500", name: "Uang Muka Pembelian", type: "ASET" },
  { code: "1-2000", name: "Aset Tetap", type: "ASET" },
  { code: "1-2100", name: "Akumulasi Penyusutan", type: "ASET" },
  { code: "2-0000", name: "KEWAJIBAN", type: "KEWAJIBAN", postable: false },
  { code: "2-1000", name: "Hutang Usaha", type: "KEWAJIBAN" },
  { code: "2-1100", name: "PPN Keluaran", type: "KEWAJIBAN" },
  { code: "2-1200", name: "Hutang Pajak", type: "KEWAJIBAN" },
  { code: "2-1300", name: "Biaya Yang Masih Harus Dibayar", type: "KEWAJIBAN" },
  { code: "2-1900", name: "Penerimaan Belum Ditagih", type: "KEWAJIBAN" },
  { code: "3-0000", name: "EKUITAS", type: "EKUITAS", postable: false },
  { code: "3-1000", name: "Modal Disetor", type: "EKUITAS" },
  { code: "3-2000", name: "Laba Ditahan", type: "EKUITAS" },
  { code: "4-0000", name: "PENDAPATAN", type: "PENDAPATAN", postable: false },
  { code: "4-1000", name: "Pendapatan Usaha", type: "PENDAPATAN" },
  { code: "4-2000", name: "Pendapatan Lain-lain", type: "PENDAPATAN" },
  { code: "5-0000", name: "BEBAN POKOK", type: "BEBAN", postable: false },
  { code: "5-1000", name: "Beban Pokok Penjualan", type: "BEBAN" },
  { code: "6-0000", name: "BEBAN OPERASI", type: "BEBAN", postable: false },
  { code: "6-1000", name: "Beban Gaji & Tunjangan", type: "BEBAN" },
  { code: "6-2000", name: "Beban Sewa", type: "BEBAN" },
  { code: "6-3000", name: "Beban Penyusutan", type: "BEBAN" },
  { code: "6-4000", name: "Beban Utilitas", type: "BEBAN" },
  { code: "7-0000", name: "BEBAN LAIN", type: "BEBAN", postable: false },
  { code: "7-1100", name: "Beban Pemeliharaan Kantor", type: "BEBAN" },
  { code: "7-2000", name: "Beban Administrasi Bank", type: "BEBAN" },
];

const PERMISSIONS: Array<[string, string, string]> = [
  ["jurnal.lihat", "Jurnal Umum", "lihat"],
  ["jurnal.ubah", "Jurnal Umum", "ubah"],
  ["jurnal.posting", "Jurnal Umum", "posting"],
  ["ledger.lihat", "Buku Besar", "lihat"],
  ["coa.lihat", "Bagan Akun", "lihat"],
  ["coa.ubah", "Bagan Akun", "ubah"],
  ["mitra.lihat", "Mitra", "lihat"],
  ["mitra.ubah", "Mitra", "ubah"],
  ["kas.lihat", "Kas & Bank", "lihat"],
  ["kas.ubah", "Kas & Bank", "ubah"],
  ["rekon.lihat", "Rekonsiliasi", "lihat"],
  ["rekon.ubah", "Rekonsiliasi", "ubah"],
  ["laporan.lihat", "Laporan", "lihat"],
  ["periode.tutup", "Tutup Periode", "tutup"],
  ["approval.putuskan", "Persetujuan", "putuskan"],
  ["pengguna.kelola", "Pengguna & Akses", "kelola"],
  ["setelan.kelola", "Setelan Sistem", "kelola"],
  ["audit.lihat", "Jejak Audit", "lihat"],
];

const ROLES: Array<{ code: string; name: string; description: string; permissions: string[] }> = [
  {
    code: "ADMIN",
    name: "Administrator",
    description: "Akses penuh ke seluruh modul dan setelan sistem",
    permissions: PERMISSIONS.map(([code]) => code),
  },
  {
    code: "AKUNTAN",
    name: "Akuntan",
    description: "Membukukan transaksi dan menyusun laporan",
    permissions: [
      "jurnal.lihat", "jurnal.ubah", "jurnal.posting", "ledger.lihat", "coa.lihat",
      "mitra.lihat", "mitra.ubah", "kas.lihat", "kas.ubah", "rekon.lihat", "rekon.ubah", "laporan.lihat",
    ],
  },
  {
    code: "REVIEWER",
    name: "Reviewer",
    description: "Memeriksa dan menyetujui pekerjaan akuntan",
    permissions: ["jurnal.lihat", "ledger.lihat", "coa.lihat", "laporan.lihat", "rekon.lihat", "approval.putuskan", "audit.lihat"],
  },
  {
    code: "DIREKSI",
    name: "Direksi",
    description: "Melihat ringkasan kinerja dan menyetujui pengeluaran",
    permissions: ["laporan.lihat", "ledger.lihat", "approval.putuskan"],
  },
  {
    code: "STAF",
    name: "Staf",
    description: "Mengajukan klaim dan melihat data dasar",
    permissions: ["jurnal.lihat", "mitra.lihat", "kas.lihat"],
  },
];

const LEGAL_FORMS: Array<[string, string]> = [
  ["PT", "Perseroan Terbatas"],
  ["PT (PERSERO)", "PT milik negara (BUMN)"],
  ["PT (PERSERODA)", "Perusahaan Perseroan Daerah (BUMD berbentuk PT)"],
  ["PERUM", "Perusahaan Umum (BUMN tanpa saham)"],
  ["PERUMDA", "Perusahaan Umum Daerah"],
  ["KOPERASI", "Koperasi"],
  ["YAYASAN", "Yayasan"],
  ["BUM DESA", "Badan Usaha Milik Desa"],
  ["CV", "Commanditaire Vennootschap / Persekutuan Komanditer"],
  ["FIRMA (FA)", "Persekutuan Firma"],
  ["UD", "Usaha Dagang (usaha perseorangan)"],
  ["PD", "Perusahaan Dagang (usaha perseorangan)"],
  ["BUT", "Bentuk Usaha Tetap (perwakilan asing)"],
];

const NUMBERING: Array<[string, string]> = [
  ["JURNAL", "JU/{YYYY}/{MM}/{####}"],
  ["FAKTUR_PENJUALAN", "INV/{YYYY}/{MM}/{####}"],
  ["PURCHASE_ORDER", "PO/{YYYY}/{MM}/{####}"],
  ["KAS_KECIL", "KK/{YYYY}/{MM}/{####}"],
  ["HUTANG", "AP/{YYYY}/{MM}/{####}"],
  ["PIUTANG", "AR/{YYYY}/{MM}/{####}"],
];

function npwpFor(index: number) {
  const base = (91_234_567 + index * 137).toString().padStart(8, "0");
  return `${base.slice(0, 2)}.${base.slice(2, 5)}.${base.slice(5, 8)}.1-024.000`;
}

async function main() {
  console.log("Seeding FAT Program…");

  const permissionRecords = new Map<string, string>();
  for (const [code, moduleName, action] of PERMISSIONS) {
    const record = await db.permission.upsert({
      where: { code },
      update: { module: moduleName, action },
      create: { code, module: moduleName, action },
    });
    permissionRecords.set(code, record.id);
  }

  const roleRecords = new Map<string, string>();
  for (const role of ROLES) {
    const record = await db.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { code: role.code, name: role.name, description: role.description, isSystem: true },
    });
    roleRecords.set(role.code, record.id);
    await db.rolePermission.deleteMany({ where: { roleId: record.id } });
    await db.rolePermission.createMany({
      data: role.permissions.map((code) => ({ roleId: record.id, permissionId: permissionRecords.get(code)! })),
      skipDuplicates: true,
    });
  }

  const password = await bcrypt.hash("rahasia123", 12);
  const users: Array<[string, string, string, string]> = [
    ["kartika@kantor.id", "KARTIKA PUTRI WANGSA KUSUMA NINGRAT DIRAJA", "ADMIN", "Kepala Akuntansi"],
    ["bagus@kantor.id", "BAGUS PRASETYO", "AKUNTAN", "Akuntan Senior"],
    ["rina@kantor.id", "RINA MARLINA", "AKUNTAN", "Akuntan"],
    ["sigit@kantor.id", "SIGIT NUGROHO", "REVIEWER", "Reviewer"],
    ["dewi@kantor.id", "DEWI ANGGRAINI", "DIREKSI", "Direktur Keuangan"],
    ["yoga@kantor.id", "YOGA PRATAMA", "STAF", "Staf Administrasi"],
  ];

  const userRecords = new Map<string, string>();
  for (const [email, name, roleCode, jobTitle] of users) {
    const record = await db.user.upsert({
      where: { email },
      update: { name, jobTitle, roleId: roleRecords.get(roleCode)! },
      create: { email, name, jobTitle, passwordHash: password, roleId: roleRecords.get(roleCode)! },
    });
    userRecords.set(email, record.id);
  }

  for (const [index, [name, color, unitCount]] of COMPANIES.entries()) {
    const code = `CO${String(index + 1).padStart(3, "0")}`;
    const company = await db.company.upsert({
      where: { code },
      update: { name, colorTag: color },
      create: {
        code,
        name,
        colorTag: color,
        npwp: npwpFor(index),
        industry: INDUSTRIES[index % INDUSTRIES.length],
        legalForm: "PT",
        city: "Tangerang Selatan",
        address: "Jl. Raya Serpong No. 1",
      },
    });

    for (let unitIndex = 0; unitIndex < Math.min(unitCount, UNIT_POOL.length); unitIndex += 1) {
      const [unitCode, unitName, unitCity] = UNIT_POOL[unitIndex];
      await db.businessUnit.upsert({
        where: { companyId_code: { companyId: company.id, code: unitCode } },
        update: { name: unitName, address: unitCity },
        create: {
          companyId: company.id,
          code: unitCode,
          name: unitName,
          address: unitCity,
          needsWork: unitIndex % 5 === 1,
          hasVariance: unitIndex % 7 === 3,
        },
      });
    }

    for (const account of ACCOUNTS) {
      const data = {
        name: account.name,
        type: account.type,
        normalBalance: (account.type === "ASET" || account.type === "BEBAN" ? "DEBIT" : "KREDIT") as "DEBIT" | "KREDIT",
        isPostable: account.postable !== false,
        level: account.postable === false ? 1 : 2,
      };
      await db.account.upsert({
        where: { companyId_code: { companyId: company.id, code: account.code } },
        update: data,
        create: { companyId: company.id, code: account.code, ...data },
      });
    }

    for (let month = 1; month <= 12; month += 1) {
      await db.fiscalPeriod.upsert({
        where: { companyId_year_month: { companyId: company.id, year: 2026, month } },
        update: {},
        create: {
          companyId: company.id,
          year: 2026,
          month,
          status: month < 8 ? "DITUTUP" : "TERBUKA",
        },
      });
    }

    for (const [docType, pattern] of NUMBERING) {
      await db.documentNumbering.upsert({
        where: { companyId_docType: { companyId: company.id, docType } },
        update: { pattern },
        create: { companyId: company.id, docType, pattern },
      });
    }
  }

  // Grant the administrator access to every unit.
  const adminId = userRecords.get("kartika@kantor.id")!;
  const allUnits = await db.businessUnit.findMany({ select: { id: true } });
  await db.userUnitAccess.createMany({
    data: allUnits.map((unit) => ({ userId: adminId, unitId: unit.id, canApprove: true })),
    skipDuplicates: true,
  });

  for (const [name, status] of [
    ["e-Faktur DJP", "TERHUBUNG"],
    ["Bank BCA — Statement API", "TERHUBUNG"],
    ["Bank Mandiri — Statement API", "BELUM_DIATUR"],
    ["Coretax DJP", "TERPUTUS"],
  ] as const) {
    await db.integration.upsert({
      where: { name },
      update: { status },
      create: { name, status, lastSyncAt: status === "TERHUBUNG" ? new Date() : null },
    });
  }

  await db.systemSetting.upsert({
    where: { key: "legalForms" },
    update: { value: LEGAL_FORMS.map(([code, label]) => ({ code, label })) },
    create: { key: "legalForms", value: LEGAL_FORMS.map(([code, label]) => ({ code, label })) },
  });

  await db.systemSetting.upsert({
    where: { key: "pettyCashLimit" },
    update: { value: { perClaim: 5_000_000 } },
    create: { key: "pettyCashLimit", value: { perClaim: 5_000_000 } },
  });

  console.log(`Seeded ${COMPANIES.length} companies, ${ROLES.length} roles, ${users.length} users.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
