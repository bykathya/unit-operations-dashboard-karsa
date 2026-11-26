# AGENTS.md — Aturan main AI (Unit Operations Dashboard)

> **Repo ini TEMPLATE.** Kalau `git remote get-url origin` masih `mellakamal/unit-operations-dashboard`, jangan
> mengubah apa pun: minta pengguna membuat repo sendiri dulu (`KLON.md`). Perbaikan template hanya lewat branch + pull
> request yang diminta pemilik template.

Baca di awal setiap sesi, bersama `CLAUDE.md` dan `openspec.md`.

## Identitas proyek

- **Nama:** Unit Operations Dashboard (kerja harian per unit)
- **Stack:** React 19 + Vite 5 (tampilan saja) · API & database = repo Management Dashboard (Express 5 + Prisma 5 + PostgreSQL)
- **Komunikasi:** Bahasa Indonesia. Tidak ada test framework: verifikasi lewat `tes/*.mjs`, dev server, dan cek visual.

## Konteks penting

- **Dua repo, satu produk.** Tampilan → repo ini. API/skema/aturan akses → Management Dashboard (commit terpisah di
  sana). Jangan menaruh logika bisnis atau rumus keuangan di frontend; lapisan circle di server membungkus handler
  Management Dashboard yang sudah ada, bukan menyalin rumus.
- **Mode per unit** (dihitung server, `peranStudio()`): `kelola` (Koordinator ke atas unit itu / Admin Market),
  `marketing` (fungsi MARKETER terkonfirmasi; Produksi mode pantau), `tugas` (artist/anggota lain). `peranStudio()`
  juga mengembalikan `pengelola` (= `kelolaStudio`), `adminMarket`, dan `lihatSaja` (pemilik unit).
- **Fungsi kerja** (`FungsiAnggota`): ARTIST (bidang: 3D, Rigging, Animasi, Ilustrasi, GFS, Desain), MARKETER, PM_QC,
  ADMIN. Ditebak dari posisi (`utils/fungsi.js`), dikonfirmasi koordinator di tab Tim.
- **Mesin alur** (`server/src/utils/alur.js`, murni): jenis langkah tetap (MASUK, KERJA, QC, REVISI_INTERNAL,
  PREVIEW_KLIEN, REVISI_KLIEN, MENUNGGU_KLIEN, FINALISASI, DELIVERY, HOLD, SELESAI); nama langkah = data per unit.

## Konvensi kode

- Komponen `PascalCase.jsx`, satu berkas per layar, state lokal (`useState`/`useEffect`); tanpa library state/router.
- Teks UI memakai diksi akrab (daftar di `CLAUDE.md`). id/endpoint kebab-case tidak ikut diganti.
- Warna hanya token di `tema.css` (`--accent`, `--bg-card`, `--bg-surface`, `--border`, `--text`, `--text-muted`,
  `--green`, `--red`, `--amber`, `*-subtle`, `--on-accent`, `--hover-strong`, `--track`, `--backdrop`, `--shadow`,
  `--radius`).
- Kelas umum: `.panel`, `.btn` (`.utama`, `.kecil`), `.chip`, `.lencana`, `.stat`/`.ringkasan`, `.toolbar`, `.dua`,
  `.kosong`, `.galat`, `.tab-mini`, `.modal`. Pakai ulang sebelum membuat baru.
- Layout: sidebar `.sisi` + `.isi`; ≤860px sidebar jadi menu geser (`.bar-ponsel`).
- Panggilan API selalu lewat `api()`; jangan menyimpan token di localStorage.
- Realtime: komponen memakai `useSegarkan(muat, ['bagian'])`; jangan membuka `EventSource` sendiri.
- Isian uang `type="number"`; validasi sah ada di server.

## Server (di repo Management Dashboard) — pola endpoint web unit baru

1. Route di `routes/circle.js`: `authenticate, populateRoles, handler`.
2. Handler: `studioBolehDilihat(req, studioId)`, lalu cek mode (`peranStudio` / `adalahManajer`).
3. Uang lewat `utils/lingkup.js` (`lingkupKeuangan`, `samarkan`); peran disaring `peranKerja(req)` (tanpa DIGNITY).
4. Wewenang per unit: `kelolaStudio`, `atasanStudio`, `atasanLingkup` (`utils/roles.js`).
5. Lingkup per alamat: `whereLingkup(web.lingkup)` (`utils/web.js`), termasuk unit di bawah Korporasi.
6. Daftar marketer: saring `masihDiUnit(studioId)` (`utils/fungsi.js`).
7. Data SDM orang lain: gerbang `peranStudio().pengelola`.
8. Pemilik hanya baca (`permintaanBaca`); handler tulis menolak `lihatSaja`.
9. Wakil freelance hanya lewat `wakilFreelance(order, userId)`.
10. Lembur hanya lewat `utils/lembur.js` (`hitungLembur`, aturan `PengaturanLembur`).
11. Tanggal = hari kalender WIB; hari libur di `HariLiburKerja` (diisi dari kalender resmi, jangan ditebak).
12. Menyamar tidak boleh menulis uang/presensi (`TULIS_TERLARANG_SAAT_MENYAMAR`).
13. Rekening hanya untuk pengelola unit; endpoint baru yang memuat rekening wajib digerbang `kelolaStudio` dan diuji.
14. Migrasi: ikuti aturan di `CLAUDE.md` repo Management Dashboard.

## Pengujian

Skrip `tes/uji-<fitur>-api.mjs` per endpoint baru (pola: `uji-keuangan-api.mjs`, `uji-akun-api.mjs`): hak per peran,
isolasi unit lain, validasi, data benar-benar tersimpan, pembersihan. Detail menjalankan: `tes/README.md`.

## Git

Commit kecil, awalan `feat:` / `fix:` / `refactor:` / `style:` / `docs:`. Jangan push atau deploy tanpa persetujuan
pengguna. Di repo template: hanya lewat pull request yang diminta pemilik template.

## Checklist sebelum lapor selesai

- [ ] `npm run build` lolos
- [ ] Endpoint baru punya uji `tes/uji-*.mjs` dan lulus (termasuk isolasi unit & peran Karyawan)
- [ ] Dicek di browser (desktop + lebar HP), tanpa galat konsol baru
- [ ] Tidak ada unggahan berkas, tidak ada uang di mode `tugas`, tidak ada rekening bocor
- [ ] Endpoint tulis menolak pemilik (`lihatSaja`) & pengelola unit lain; tidak menulis ke tabel keuangan Management
      Dashboard (mode bayangan)
- [ ] `openspec.md` diperbarui bila perilaku berubah

## Jika ragu

Tanya pengguna (singkat, dengan rekomendasi). Cek klaim penting ke kode. Hal yang sudah ditetapkan di "Aturan keras"
`CLAUDE.md` tidak perlu ditanyakan ulang.
