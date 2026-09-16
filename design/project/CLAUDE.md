# Instruksi proyek FAT PROGRAM

## Istilah pengguna
- **"bingkai" = "kartu"** (card). Saat pengguna menyebut "bingkai", yang dimaksud adalah kartu/panel di layar.
- **"tool" = elemen/kontrol UI sepaket** (tombol, kolom isian, dropdown, kotak centang, dsb). Mis. tombol "Masuk" = satu tool.
- **"Kolom Label" = pasangan label + kotak isian** (mis. label "Kata Sandi" beserta kotak isiannya).
- **"Label Checklist" = kotak centang + labelnya** (mis. "Lihat kata sandi").
- **"Tool Cari" = kotak pencarian** (kotak isian + ikon kaca pembesar, tanpa label).

## Kunci layar
- "Kunci Layar [No]" → semua perubahan hanya di layar itu, DAN tampilan awal setelah refresh selalu di layar itu (atur `LOCK_SCREEN` di `applyScreenLock`), sampai pengguna bilang "stop".
- "stop" → `LOCK_SCREEN = null`, tampilan awal kembali mulai dari login.

## Gaya kerja
- Jawab singkat dalam bahasa Indonesia.
- Ubah hanya yang diminta; jangan merapikan bagian lain tanpa diminta.
