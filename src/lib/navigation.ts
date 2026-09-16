/** Module registry — mirrors the barcol menu and mega-menu of the prototype. */

export type ModuleEntry = {
  key: string;
  label: string;
  href: string;
  /** Screen number carried over from the prototype, for the search list. */
  screen: string;
  hint?: string;
};

export type ModuleGroup = {
  key: string;
  label: string;
  items: ModuleEntry[];
};

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    key: "beranda",
    label: "Beranda",
    items: [
      { key: "dash", label: "Dashboard", href: "/dashboard", screen: "06", hint: "Status pembukuan seluruh klien" },
      { key: "direksi", label: "Dashboard Direksi", href: "/dashboard-direksi", screen: "34", hint: "Ringkasan kinerja per unit bisnis" },
      { key: "approval", label: "Notifikasi & Persetujuan", href: "/persetujuan", screen: "33", hint: "Antrian persetujuan lintas modul" },
      { key: "hp", label: "Persetujuan di Ponsel", href: "/persetujuan-ponsel", screen: "37", hint: "Tampilan ringkas untuk ponsel" },
    ],
  },
  {
    key: "transaksi",
    label: "Transaksi",
    items: [
      { key: "jurnal", label: "Jurnal Umum", href: "/jurnal", screen: "15", hint: "Entri dan posting jurnal" },
      { key: "ledger", label: "Buku Besar", href: "/buku-besar", screen: "16", hint: "Mutasi dan saldo per akun" },
      { key: "import", label: "Import Mutasi", href: "/import-mutasi", screen: "17", hint: "Unggah mutasi rekening bank" },
      { key: "rekon", label: "Rekonsiliasi Bank", href: "/rekonsiliasi", screen: "18", hint: "Cocokkan mutasi dengan buku" },
      { key: "hutang", label: "Hutang Usaha", href: "/hutang", screen: "23", hint: "Tagihan vendor dan umur hutang" },
      { key: "piutang", label: "Piutang Usaha", href: "/piutang", screen: "24", hint: "Invoice pelanggan dan umur piutang" },
      { key: "kasbank", label: "Kas & Bank Harian", href: "/kas-bank", screen: "25", hint: "Mutasi harian dan transfer antar buku" },
      { key: "pajak", label: "Pajak", href: "/pajak", screen: "26", hint: "PPN, PPh, dan e-Faktur" },
      { key: "fakturjual", label: "Faktur Penjualan", href: "/faktur-penjualan", screen: "30", hint: "Faktur pajak keluaran" },
      { key: "po", label: "Pembelian & PO", href: "/pembelian", screen: "31", hint: "Purchase order dan penerimaan" },
      { key: "kaskecil", label: "Kas Kecil & Reimbursement", href: "/kas-kecil", screen: "32", hint: "Klaim staf dan penggantian" },
    ],
  },
  {
    key: "mitra",
    label: "Mitra",
    items: [
      { key: "vendor", label: "Vendor", href: "/vendor", screen: "13", hint: "Data master pemasok & vendor" },
      { key: "customer", label: "Customer", href: "/customer", screen: "14", hint: "Piutang dilacak per buku unit" },
    ],
  },
  {
    key: "laporan",
    label: "Laporan",
    items: [
      { key: "laporan", label: "Laporan Keuangan", href: "/laporan", screen: "19", hint: "Neraca, laba rugi, arus kas" },
      { key: "lapkhusus", label: "Laporan Khusus", href: "/laporan-khusus", screen: "10", hint: "Laporan fiskal dan direksi" },
      { key: "konsol", label: "Konsolidasi", href: "/konsolidasi", screen: "09", hint: "Gabungan seluruh entitas" },
      { key: "tutup", label: "Tutup & Kunci Periode", href: "/tutup-periode", screen: "20", hint: "Kunci periode pembukuan" },
      { key: "anggaran", label: "Anggaran & Realisasi", href: "/anggaran", screen: "29", hint: "Serapan anggaran per akun" },
    ],
  },
  {
    key: "manajemen",
    label: "Manajemen",
    items: [
      { key: "klien", label: "Perusahaan & Entitas", href: "/klien", screen: "07", hint: "Data master perusahaan" },
      { key: "cabang", label: "Unit Bisnis", href: "/unit-bisnis", screen: "08", hint: "Buku terpisah per unit" },
      { key: "coa", label: "Bagan Akun", href: "/bagan-akun", screen: "11", hint: "Struktur akun per entitas" },
      { key: "akses", label: "Pengguna & Akses", href: "/pengguna", screen: "21", hint: "Peran dan hak akses" },
      { key: "audit", label: "Jejak Audit", href: "/jejak-audit", screen: "22", hint: "Riwayat perubahan data" },
      { key: "aset", label: "Aset Tetap", href: "/aset-tetap", screen: "27", hint: "Penyusutan garis lurus" },
      { key: "stok", label: "Persediaan", href: "/persediaan", screen: "28", hint: "Stok dan HPP rata-rata" },
      { key: "setelan", label: "Setelan Sistem", href: "/setelan", screen: "35", hint: "Penomoran dokumen dan integrasi" },
    ],
  },
];

/** Extra destinations reachable from search or the rail but not in the barcol. */
export const EXTRA_MODULES: ModuleEntry[] = [
  { key: "beranda", label: "Beranda", href: "/beranda", screen: "03" },
  { key: "email", label: "Email", href: "/email", screen: "04", hint: "Kotak masuk tim akuntansi" },
  { key: "internet", label: "Browser", href: "/browser", screen: "05", hint: "Peramban untuk portal pajak dan bank" },
  { key: "entbaru", label: "Tambah Perusahaan / Entitas", href: "/klien/baru", screen: "07A" },
  { key: "coaimport", label: "Import Bagan Akun", href: "/bagan-akun/import", screen: "12" },
  { key: "profil", label: "Profil & Preferensi", href: "/profil", screen: "36" },
  { key: "setup", label: "Set Up", href: "/setup", screen: "01" },
  { key: "perusahaan", label: "Perusahaan", href: "/perusahaan", screen: "02" },
];

export const ALL_MODULES: ModuleEntry[] = [
  ...MODULE_GROUPS.flatMap((group) => group.items),
  ...EXTRA_MODULES,
];

export function findModuleByPath(pathname: string): ModuleEntry | undefined {
  return ALL_MODULES.filter((entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
