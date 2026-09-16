/* GENERATED — do not edit by hand.
 * Rebuild with:
 *   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/schema.sql
 * then re-run `npm run build:schema-sql`.
 *
 * Embedded so /api/setup can create the schema at runtime, where DATABASE_URL
 * is always present — the build has no database access on Vercel.
 */

export const SCHEMA_SQL = `-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('AKTIF', 'NONAKTIF', 'DIKUNCI');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ID', 'EN');

-- CreateEnum
CREATE TYPE "CompanyKind" AS ENUM ('PERUSAHAAN', 'ENTITAS');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASET', 'KEWAJIBAN', 'EKUITAS', 'PENDAPATAN', 'BEBAN');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'KREDIT');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('TERBUKA', 'DITUTUP', 'DIKUNCI');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAF', 'DIPOSTING', 'BATAL');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('MANUAL', 'IMPOR', 'FAKTUR_PENJUALAN', 'PEMBELIAN', 'KAS_KECIL', 'PENYUSUTAN', 'PENYESUAIAN');

-- CreateEnum
CREATE TYPE "BankAccountKind" AS ENUM ('KAS', 'BANK');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('DIPROSES', 'SELESAI', 'GAGAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('BELUM_COCOK', 'COCOK', 'DIABAIKAN');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('BERJALAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('AKTIF', 'NONAKTIF');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAF', 'TERBUKA', 'SEBAGIAN', 'LUNAS', 'JATUH_TEMPO', 'BATAL');

-- CreateEnum
CREATE TYPE "EfakturStatus" AS ENUM ('BELUM', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAF', 'MENUNGGU_PERSETUJUAN', 'DISETUJUI', 'DITOLAK', 'DIKIRIM', 'DITERIMA', 'DITUTUP', 'BATAL');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAF', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DIBAYAR');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('GARIS_LURUS', 'SALDO_MENURUN');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AKTIF', 'DIJUAL', 'DIHAPUS', 'HABIS_SUSUT');

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('MASUK', 'KELUAR', 'PENYESUAIAN');

-- CreateEnum
CREATE TYPE "TaxKind" AS ENUM ('PPN_KELUARAN', 'PPN_MASUKAN', 'PPH_21', 'PPH_22', 'PPH_23', 'PPH_25', 'PPH_4_2');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('DRAF', 'DILAPORKAN', 'DIBAYAR', 'TERLAMBAT');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('JURNAL', 'PURCHASE_ORDER', 'KAS_KECIL', 'FAKTUR_PENJUALAN', 'TUTUP_PERIODE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('TERHUBUNG', 'TERPUTUS', 'BELUM_DIATUR');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'AKTIF',
    "locale" "Locale" NOT NULL DEFAULT 'ID',
    "phone" TEXT,
    "jobTitle" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserUnitAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT true,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserUnitAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "device" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CompanyKind" NOT NULL DEFAULT 'PERUSAHAAN',
    "parentId" TEXT,
    "npwp" TEXT,
    "industry" TEXT,
    "legalForm" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "colorTag" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Director" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nik" TEXT,
    "npwp" TEXT,
    "address" TEXT,
    "startDate" TIMESTAMP(3),

    CONSTRAINT "Director_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUnit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "needsWork" BOOLEAN NOT NULL DEFAULT false,
    "hasVariance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isPostable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'TERBUKA',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "periodId" TEXT,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAF',
    "source" "JournalSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineNo" INTEGER NOT NULL,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BankAccountKind" NOT NULL DEFAULT 'BANK',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementImport" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'DIPROSES',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "runningBalance" DECIMAL(18,2),
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'BELUM_COCOK',
    "journalLineId" TEXT,
    "reconciliationId" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "bookBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statementBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'BERJALAN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "npwp" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "paymentTerm" INTEGER NOT NULL DEFAULT 30,
    "status" "PartnerStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "npwp" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "paymentTerm" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PartnerStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'TERBUKA',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'TERBUKA',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dpp" DECIMAL(18,2) NOT NULL,
    "ppnRate" DECIMAL(5,2) NOT NULL DEFAULT 11,
    "ppn" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "efaktur" "EfakturStatus" NOT NULL DEFAULT 'BELUM',
    "efakturNo" TEXT,
    "termDays" INTEGER NOT NULL DEFAULT 30,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAF',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "billedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAF',
    "stage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitName" TEXT,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "receiptName" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,2) NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "method" "DepreciationMethod" NOT NULL DEFAULT 'GARIS_LURUS',
    "status" "AssetStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "expense" DECIMAL(18,2) NOT NULL,
    "accumulated" DECIMAL(18,2) NOT NULL,
    "bookValue" DECIMAL(18,2) NOT NULL,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "minimum" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PartnerStatus" NOT NULL DEFAULT 'AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "MovementKind" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "note" TEXT,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "budget" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kind" "TaxKind" NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "dpp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "TaxStatus" NOT NULL DEFAULT 'DRAF',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'MENUNGGU',
    "escalateNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentNumbering" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentNumbering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'BELUM_DIATUR',
    "lastSyncAt" TIMESTAMP(3),
    "config" JSONB,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'masuk',
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserUnitAccess_userId_unitId_key" ON "UserUnitAccess"("userId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenId_key" ON "Session"("tokenId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Director_companyId_idx" ON "Director"("companyId");

-- CreateIndex
CREATE INDEX "BusinessUnit_companyId_idx" ON "BusinessUnit"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUnit_companyId_code_key" ON "BusinessUnit"("companyId", "code");

-- CreateIndex
CREATE INDEX "Account_companyId_idx" ON "Account"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_companyId_code_key" ON "Account"("companyId", "code");

-- CreateIndex
CREATE INDEX "FiscalPeriod_companyId_idx" ON "FiscalPeriod"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_companyId_year_month_key" ON "FiscalPeriod"("companyId", "year", "month");

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_date_idx" ON "JournalEntry"("companyId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_unitId_idx" ON "JournalEntry"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_companyId_number_key" ON "JournalEntry"("companyId", "number");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE INDEX "BankAccount_unitId_idx" ON "BankAccount"("unitId");

-- CreateIndex
CREATE INDEX "StatementImport_bankAccountId_idx" ON "StatementImport"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_journalLineId_key" ON "BankStatementLine"("journalLineId");

-- CreateIndex
CREATE INDEX "BankStatementLine_bankAccountId_date_idx" ON "BankStatementLine"("bankAccountId", "date");

-- CreateIndex
CREATE INDEX "BankStatementLine_importId_idx" ON "BankStatementLine"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_bankAccountId_periodYear_periodMonth_key" ON "Reconciliation"("bankAccountId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Vendor_companyId_idx" ON "Vendor"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_companyId_code_key" ON "Vendor"("companyId", "code");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE INDEX "ApInvoice_companyId_dueDate_idx" ON "ApInvoice"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "ApInvoice_vendorId_idx" ON "ApInvoice"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ApInvoice_companyId_number_key" ON "ApInvoice"("companyId", "number");

-- CreateIndex
CREATE INDEX "ArInvoice_companyId_dueDate_idx" ON "ArInvoice"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "ArInvoice_customerId_idx" ON "ArInvoice"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ArInvoice_companyId_number_key" ON "ArInvoice"("companyId", "number");

-- CreateIndex
CREATE INDEX "SalesInvoice_companyId_invoiceDate_idx" ON "SalesInvoice"("companyId", "invoiceDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_customerId_idx" ON "SalesInvoice"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_companyId_number_key" ON "SalesInvoice"("companyId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_orderDate_idx" ON "PurchaseOrder"("companyId", "orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_number_key" ON "PurchaseOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "PettyCashClaim_companyId_claimDate_idx" ON "PettyCashClaim"("companyId", "claimDate");

-- CreateIndex
CREATE INDEX "PettyCashClaim_requesterId_idx" ON "PettyCashClaim"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashClaim_companyId_number_key" ON "PettyCashClaim"("companyId", "number");

-- CreateIndex
CREATE INDEX "FixedAsset_companyId_idx" ON "FixedAsset"("companyId");

-- CreateIndex
CREATE INDEX "FixedAsset_unitId_idx" ON "FixedAsset"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_companyId_code_key" ON "FixedAsset"("companyId", "code");

-- CreateIndex
CREATE INDEX "DepreciationEntry_assetId_idx" ON "DepreciationEntry"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_assetId_periodYear_periodMonth_key" ON "DepreciationEntry"("assetId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_companyId_code_key" ON "InventoryItem"("companyId", "code");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_date_idx" ON "InventoryMovement"("itemId", "date");

-- CreateIndex
CREATE INDEX "BudgetLine_companyId_year_idx" ON "BudgetLine"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_companyId_unitId_accountId_year_month_key" ON "BudgetLine"("companyId", "unitId", "accountId", "year", "month");

-- CreateIndex
CREATE INDEX "TaxRecord_companyId_periodYear_periodMonth_idx" ON "TaxRecord"("companyId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "ApprovalRequest_companyId_status_idx" ON "ApprovalRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requesterId_idx" ON "ApprovalRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ApprovalDecision_requestId_idx" ON "ApprovalDecision"("requestId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNumbering_companyId_docType_key" ON "DocumentNumbering"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_name_key" ON "Integration"("name");

-- CreateIndex
CREATE INDEX "MailMessage_folder_receivedAt_idx" ON "MailMessage"("folder", "receivedAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitAccess" ADD CONSTRAINT "UserUnitAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnitAccess" ADD CONSTRAINT "UserUnitAccess_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Director" ADD CONSTRAINT "Director_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "StatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "Reconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApInvoice" ADD CONSTRAINT "ApInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApInvoice" ADD CONSTRAINT "ApInvoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApInvoice" ADD CONSTRAINT "ApInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArInvoice" ADD CONSTRAINT "ArInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashClaim" ADD CONSTRAINT "PettyCashClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashClaim" ADD CONSTRAINT "PettyCashClaim_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashClaim" ADD CONSTRAINT "PettyCashClaim_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "BusinessUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentNumbering" ADD CONSTRAINT "DocumentNumbering_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

`;
