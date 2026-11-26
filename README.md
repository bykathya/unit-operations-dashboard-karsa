# Unit Operations Dashboard

> **⚠️ Ini repo TEMPLATE. Jangan dikerjakan langsung.** Buat repo sendiri dulu: tombol **Use this template** di
> GitHub (atau salin tanpa riwayat), lalu kerjakan di repo baru itu. Langkah lengkap: **`KLON.md`**.

Web kerja harian per unit: produksi (order, tugas, QC, revisi, delivery), marketing, kehadiran & lembur, penggajian
unit, dan keuangan unit (mode bayangan). **Tampilan saja** — semua data lewat API `/api/circle/*` milik
**Management Dashboard** (repo pasangannya). Satu kode melayani banyak alamat (satu alamat per circle/rumah usaha).

- **Dokumen:** `KLON.md` (mulai di sini) · `openspec.md` (spesifikasi & aturan) · `CLAUDE.md` / `AGENTS.md`
  (panduan kerja & aturan kode) · `tes/README.md` (uji)

## Menjalankan di laptop

1. Jalankan server Management Dashboard: `cd ../management-dashboard/server && node src/app.js` (port 3001).
2. Di repo ini: `npm install && npm run dev` → http://127.0.0.1:5174. Alamat unit lain: `VITE_CIRCLE=<slug> npm run dev`.
3. Masuk dengan akun Management Dashboard, atau akun demo (`demo/README.md`).

## Deploy tampilan

`npm run build`, lalu salin `dist/` ke folder yang disajikan nginx (contoh: `deploy/PERBARUI.md`). Perubahan API
di-deploy dari repo Management Dashboard.
