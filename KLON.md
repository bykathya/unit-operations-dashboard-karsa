# Menyiapkan Unit Operations Dashboard

## ⚠️ Aturan template: buat repo sendiri dulu

Repo `mellakamal/unit-operations-dashboard` (dan pasangannya `mellakamal/management-dashboard`) adalah **template**.
Template tidak dikerjakan langsung, tidak berisi data ekosistem mana pun, dan hanya berubah lewat pull request yang
disetujui pemilik template.

1. Di GitHub buka repo template → **Use this template** → **Create a new repository** (*Private*). Lakukan untuk kedua
   repo, simpan bersebelahan dalam satu folder (`management-dashboard/` dan `unit-operations-dashboard/`).
2. Kerjakan hanya di repo baru.
3. Perbaikan untuk semua ekosistem diajukan ke template lewat pull request, tanpa nama/domain/data ekosistem Anda.

Web ini hanya tampilan: semua data lewat `/api/circle/*` milik **Management Dashboard**; lihat `KLON.md` di repo itu untuk
env, database, dan admin pertama. Disalin dari sistem yang sudah berjalan pada 12 Nov 2026, tanpa riwayat git.

## Yang sudah dibersihkan

- Skrip slug dan pengumuman untuk tim lama; lima file nginx lama diganti satu contoh berisian kosong
  (`deploy/nginx-circle-contoh.conf`).
- Nama organisasi asal diganti netral, domain diganti `domain-anda.com`, IP server diganti `<IP-VPS>`.

## Memasang satu alamat unit

1. `npm install && npm run build` → hasilnya di `dist/`, salin ke server (contoh: `/var/www/<nama>/dist`).
2. Salin `deploy/nginx-circle-contoh.conf`, ganti `CIRCLE.DOMAIN-ANDA.com`, `SLUG-CIRCLE`, dan folder `root`.
   Header `X-Unit-Web` **wajib** ditulis di nginx (bukan dari browser), karena Management Dashboard memakainya untuk
   tahu unit mana yang dibuka.
3. Isi kolom `slug` circle itu di database (tabel `Circle` atau `RumahUsaha`) dengan nilai yang sama.
4. Pasang HTTPS (certbot), lalu pastikan header keamanan di contoh nginx ikut aktif.

Di laptop: `npm run dev` (Vite di `127.0.0.1:5174`, meneruskan `/api` ke `localhost:3001` dengan header
`X-Unit-Web` dari `VITE_CIRCLE`, bawaan `bloom`).

## Uji

Skrip `tes/uji-*.mjs` membaca lokasi repo Management Dashboard dari env `DASHBOARD_DIR`; bawaannya folder saudara
`../management-dashboard` (lihat `tes/_jalur.mjs`). Skrip yang memanggil API butuh server Management Dashboard lokal
di port 3001 dan data contoh dari instalasi asal (unit uji seperti Keiko, Pibi, Sekartaji), jadi siapkan data uji
sendiri dulu. Skrip logika murni (`uji-mesin`, `uji-fungsi`, `uji-marketing`) bisa langsung dijalankan.

## Riwayat sinkron dengan sistem asal

Repo ini tanpa riwayat git asal, jadi titik sinkron dicatat di sini. Cara memperbarui berikutnya: ambil selisih sistem asal
sejak titik terakhir, bersihkan nama/domain/path pribadi dengan aturan yang sama, gabungkan tiga arah (dasar = sistem asal pada titik
terakhir, milik kita = repo ini, tujuan = sistem asal terbaru), lalu `npm run build` dan jalankan skrip uji yang tidak butuh data.
Selalu sinkronkan bersama `management-dashboard` (backend), karena web ini hanya tampilan untuk `/api/circle/*`.

| Tanggal | Titik sistem asal | Isi |
|---|---|---|
| 12 Nov 2026 | `c6422f1` | Salinan awal |
| 16 Nov 2026 | `2aa9483` | Mengikuti backend (+13 migrasi): kas per rekening, bayar freelance, invoice per order, kolom khusus order, prospek seperti order, freelancer per unit, talent berhenti, Update klien lebih lengkap, tugas admin, QC semua, tunda antrean, dll.; +30 skrip uji baru. Pengumuman koordinator milik asal tidak dibawa. |
| 16 Nov 2026 (sore) | `5a9aab0` | Mengikuti backend 124 migrasi: Kehadiran › Jam kerja & lembur, ajuan bayar freelance + tab Bayar freelance, ubah kolom khusus + pilihan banyak, kartu Produksi pilih bulan, tanya antrean/tunda di Update klien & Kurasi QC, hapus prospek; +3 skrip uji (total 88 di asal). |
| 24 Nov 2026 | `40bbd06` | Mengikuti backend 130 migrasi: Pendapatan (kas dari cicilan, saldo platform, belum dibayar klien), pekerjaan internal & buka kembali untuk revisi, presensi WFO/WFA dari lokasi kantor, lembur dari tugas yang ditunda + lembur susulan, Admin terpercaya & marketer pemegang, Kurasi QC untuk PM/QC, Produksi per akun jualan, kolom Done urut terbaru, titik ribuan di isian rupiah, rincian aktivitas marketer, follow up klien lama; +11 skrip uji baru. |
