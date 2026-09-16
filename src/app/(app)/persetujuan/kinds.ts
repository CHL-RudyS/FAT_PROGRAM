/** Kind labels and chip tones of the prototype's approval rows (screens 33 and 37). */
export const KIND_LABEL: Record<string, string> = {
  PURCHASE_ORDER: "Purchase order",
  KAS_KECIL: "Klaim reimbursement",
  JURNAL: "Jurnal penyesuaian",
  FAKTUR_PENJUALAN: "Faktur penjualan",
  TUTUP_PERIODE: "Tutup periode",
};

export const KIND_CHIP: Record<string, string> = {
  PURCHASE_ORDER: "chip chip-info",
  KAS_KECIL: "chip chip-warn",
  JURNAL: "chip chip-lock",
  FAKTUR_PENJUALAN: "chip chip-open",
  TUTUP_PERIODE: "chip chip-lock",
};

/** The dropdown list of the prototype's "Semua jenis" filter. */
export const KIND_FILTERS = [
  "Purchase order",
  "Klaim reimbursement",
  "Jurnal penyesuaian",
  "Tutup periode",
];
