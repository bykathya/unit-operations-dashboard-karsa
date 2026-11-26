# CLAUDE.md

> ## ⚠️ Repo ini TEMPLATE — jangan dikerjakan langsung
> `mellakamal/unit-operations-dashboard` adalah template. Setiap ekosistem membuat **repo sendiri** dari template ini
> (GitHub: **Use this template**, atau salin tanpa riwayat), lalu bekerja di repo barunya. Langkahnya di `KLON.md`.
> - **Untuk AI:** cek `git remote get-url origin`. Kalau masih `mellakamal/unit-operations-dashboard`, JANGAN mengubah
>   kode atau dokumen. Berhenti dan ingatkan pengguna untuk membuat repo sendiri dulu. Pengecualian: pemilik template
>   meminta perbaikan template secara tegas — kerjakan di branch terpisah dan ajukan pull request, jangan langsung ke `main`.
> - Perbaikan yang berguna untuk semua ekosistem diajukan ke template lewat pull request dan disetujui pemilik.

Panduan untuk Claude Code di repo ini. Bahasa komunikasi: **Bahasa Indonesia**.

## Project Context

**Unit Operations Dashboard** — web kerja harian per unit (circle / rumah usaha dan studio di dalamnya): produksi,
marketing, kehadiran & lembur, keuangan unit (mode bayangan), tim. Repo ini **hanya tampilan**: semua data lewat API
`/api/circle/*` di repo pasangannya, **Management Dashboard** (`server/src/controllers/circle*.js`,
`routes/circle.js`, `utils/alur.js`, `utils/fungsi.js`, `utils/marketing.js`, `utils/web.js`). Perubahan API, skema,
dan aturan akses dikerjakan DI SANA.

- Dokumen: `openspec.md` (spesifikasi & aturan), `AGENTS.md` (aturan kode), `KLON.md` (memasang untuk ekosistem baru).
  Kalau dokumen dan kode berbeda, kode yang benar.
- Arsitektur alamat: **satu kode untuk banyak alamat**. Tiap alamat (mis. `nama-circle.domain-anda.com`) disajikan nginx
  dari `dist/` yang sama; nginx menimpa header `X-Unit-Web: <slug>` untuk `/api/`. Server menentukan etalase (nama,
  warna, lingkup data) dari `Circle.slug` / `RumahUsaha.slug`.

## Development Commands

```bash
npm install
npm run dev      # Vite di http://127.0.0.1:5174, proxy /api → 127.0.0.1:3001 dengan header X-Unit-Web dari VITE_CIRCLE (bawaan 'bloom')
npm run build    # hasil di dist/
```

Server Management Dashboard lokal harus berjalan (`cd ../management-dashboard/server && node src/app.js`, port 3001;
tidak auto-reload). Alamat lain di lokal: `VITE_CIRCLE=<slug> npm run dev`. Skrip uji di `tes/` (lihat
`tes/README.md`), skenario demo di `demo/`.

## Deploy

- **Tampilan (repo ini):** `npm run build`, lalu salin `dist/` ke folder yang disajikan nginx (contoh di
  `deploy/PERBARUI.md`). Tidak perlu restart.
- **API:** deploy di repo Management Dashboard. Perubahan API harus sudah tayang sebelum/bersamaan dengan tampilan
  yang memakainya.
- **Alamat baru:** salin `deploy/nginx-circle-contoh.conf`, isi domain, slug, dan folder; isi `slug` di tabel
  `Circle`/`RumahUsaha`; pasang HTTPS. Blok nginx aplikasi Management Dashboard memakai `deploy/app-header.txt`.
- Selalu minta persetujuan pengguna sebelum deploy.

## Architecture

```
src/
├── App.jsx          kerangka: sidebar kiri (menu geser di HP), menu per peran & unit, tema, menyamar
├── MenuSisi.jsx     kelompok menu + ikon (tab baru WAJIB didaftarkan di IKON & KELOMPOK)
├── api.js           klien API: token akses di MEMORI, refresh = cookie httpOnly
├── realtime.js      SSE untuk tab yang terlihat saja (useSegarkan)
├── api-util.js      hariIniLokal, NAMA_BULAN, bulanSekarang, geserBulan, unduhCsv, unduhXlsx
├── format.js        formatRp, tanggalPendek, lewatDeadline
├── <Layar>.jsx      satu berkas per layar (Papan, TugasSaya, Kehadiran, KasBiaya, BukuBesar, ...)
├── marketing/       Marketing.jsx + MkAntrean/MkAktivitas/MkProspek/MkRencana/MkInsight/MkProfil
└── tema.css app.css token warna (aksen per unit dari data) + gaya
```

Navigasi berbasis state (tanpa router). Menu mengikuti mode peran dari server (`kelola` / `marketing` / `tugas`),
lihat `openspec.md` § Navigasi.

## Key Conventions

- **Gaya:** CSS biasa dengan token di `tema.css` (`--accent`, `--bg-card`, `--border`, ...); jangan hardcode warna. Aksen
  per unit ditimpa dari `identitas.warna`. Mode terang (krem, bawaan)/gelap (`data-theme`); menu kiri selalu hitam. Huruf Unbounded (judul) + Space Grotesk (isi). Karakter kru di `public/maskot/` lewat `Stiker.jsx`.
- **Uang:** `formatRp()` dari `format.js` atau `rp()` / `usd()` lokal di `Keuangan.jsx` (`null` → "—").
- **API:** `{ success, data }` / `{ success: false, message }`; `api()` melempar `Error` dengan `.status`, `.galat`.
- **Otorisasi SELALU di server.** Frontend hanya menyembunyikan menu.
- **Diksi akrab** untuk tim (bukan istilah manajemen). Padanan yang dipakai di tampilan (id/endpoint di kode tetap):
  Kondisi hari ini (papan nadi) · Order per tahap (peta alur) · Nilai order aktif (pipeline) · Jadwal order (timeline) ·
  Ringkasan kinerja (skor eksekutif) · Kecepatan & ketepatan waktu · Rencana perbaikan · Ringkasan/Analisis (dashboard/
  insight marketing) · Profil & catatan harian · Biaya rutin (item tetap) · Atur kategori (pemetaan) · Cek omset
  (bayangan omset) · Tugas selesai · Lempar-Terima (LTK) · Aktivitas (effort) · Tahapan penjualan (corong) · Unggah
  konten/Interaksi/Jejaring/Optimasi · Waktu … biasanya (median) · Tahap paling lama (bottleneck) · Lama pengerjaan
  (lead time) · Peringkat (leaderboard) · Perkiraan (forecast) · Kehadiran tim (roster) · Susunan tim (manpower) ·
  Jadi order (%) · Biaya harian (variabel) / Biaya rutin (tetap) · Acuan CPM · Nilai kotor. Istilah kerja harian yang
  sudah biasa (QC, Preview, Delivery, Inbox, Done, Check-in, Post/Reply/SEO, CPM, Admin Market) tetap. Ejaan "Omset".

## Aturan keras (jangan dilanggar tanpa keputusan pemilik)

1. **Tanpa unggahan berkas** (foto, lampiran, bukti transfer). Hanya teks, angka, tautan http(s).
2. **Talent** (Kader/Karyawan/Magang) hanya melihat tugasnya sendiri, tanpa nilai uang. **Marketer** hanya melihat uang
   order/prospek miliknya, dan boleh mengubah data dasar, item, dan cicilan order miliknya (bukan tim, fee talent,
   atau pindah tahap manual).
3. **Antar-unit terisolasi** di server (token terikat slug alamat; `studioBolehDilihat`). Peran `DIGNITY` tidak memberi
   akses.
4. **Keuangan = mode bayangan:** tidak menulis ke Laporan Omset/catatan bulanan/Pengeluaran Management Dashboard. Web
   ini tempat semua proses dicatat; Management Dashboard tempat data akhir. Pipeline tulis baru disambung atas keputusan
   pemilik.
5. **Tiap unit mandiri, tanpa kas pusat:** pemasukan buku besar = penarikan (WD). Kas pusat, transfer ke pusat,
   checklist setoran berperiode, dan menu LTK disembunyikan (kode & data utuh).
6. **Rekening** (`StudioRekening`) hanya dikirim ke pengelola unit itu, di `GET /tagihan/penerbit`, untuk invoice. Data
   bank freelancer tidak pernah dikirim utuh (4 digit akhir).
7. **Wewenang per unit:** pengelola harus berperan di unit itu sendiri (`kelolaStudio` / `atasanStudio` /
   `atasanLingkup`). **Koordinator = CEO unitnya** (target, kas awal, biaya tetap, persetujuan biaya, tutup bulan,
   aturan lembur); membuka lagi bulan = Super Admin.
8. **Admin Market** = pengelola ORDER saja: bukan keuangan unit, tutup bulan, target, aturan lembur, atau data SDM
   anggota. Marketer yang hanya memantau memakai Produksi mode pantau.
9. **Wakil freelance:** freelance tidak diberi akun. Order tanpa talent internal digerakkan tahap kerjanya oleh marketer
   pemegang order; QC tetap Koordinator/Admin.
10. **Akun jualan wajib** untuk order baru (`akunId` atau `INTERNAL`).
11. **Lembur = fee pekerjaan**, bukan upah per jam: dicatat kapan saja, jam opsional; aturan, nilai, dan persetujuan
    ditentukan koordinator unit (mode per jam/bertingkat/per hari disembunyikan dari pilihan).
12. **Pemilik unit** (`StudioPemilik`) = lihat saja; data pribadi orang lain (gaji/lembur per orang, refleksi, izin,
    profil SDM, riwayat login) tetap tertutup.
13. **Tugas saya** hanya berisi tugas yang sedang menjadi giliran orang itu (`JENIS_KERJA`: KERJA, REVISI_*,
    FINALISASI). Daftar "ordermu di tahap lain" tidak ditampilkan.
14. **Tidak menebak:** angka diturunkan dari data; bila tak ada dasar, tampilkan kosong ("—") atau acuan, lalu tanyakan.
