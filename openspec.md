# Unit Operations Dashboard — openspec

> **Repo template.** Jangan dikerjakan langsung; buat repo sendiri dulu (lihat `KLON.md`).
> Dokumen ini menjelaskan produk dan aturannya. Kalau berbeda dengan kode, kode yang benar — perbaiki dokumen ini.
> Backend web ini ada di repo Management Dashboard; dokumen pasangannya: `openspec.md` di repo itu.

## Gambaran

Web kerja harian per unit: **produksi** (order, tugas, QC, revisi, preview/delivery, penugasan), **marketing**
(aktivitas, rencana, prospek, analisis), **SDM harian** (kehadiran, izin, lembur, check-in, refleksi, penggajian unit),
dan **keuangan unit** (biaya, pendapatan, buku besar, tutup bulan, penjualan vs target) dalam mode bayangan.

Prinsip:
- **Memakai ulang entitas Management Dashboard** (Circle, Studio, peran, AkunProduksi, OrderProduksi, MarketingLead,
  WeeklyReport); proses produksi, marketing, SDM harian, dan keuangan unit diadaptasi dari sistem operasional studio
  (OGS).
- **Keuangan = mode bayangan:** berdiri sendiri, tidak menulis ke Laporan Omset/catatan bulanan Management Dashboard.
- **Semua nilai uang order tersimpan dalam Rupiah**; USD hanya metadata asal (`mataUang`, `kurs`, `nilaiUsd`).
- **Tanpa unggahan berkas.** **Talent hanya tugas sendiri.** **Antar-unit terisolasi.** Check-in harian dan log suasana
  hati bersifat pribadi.
- **Tidak menebak:** angka dari data; tanpa dasar ditampilkan kosong ("—") atau sebagai acuan.

## Teknologi

- Frontend (repo ini): React 19, Vite 5, CSS biasa dengan token (`tema.css`, `app.css`), tanpa router/state library,
  ikon `lucide-react`, Excel `write-excel-file` (dimuat saat dipakai). Realtime: Server-Sent Events. Port dev 5174.
- Backend (repo Management Dashboard): Node 20, Express 5, Prisma 5, PostgreSQL.
- Hosting: nginx menyajikan `dist/` statis untuk semua alamat unit dan meneruskan `/api/` ke `127.0.0.1:3001`.

## Alamat & etalase

- Satu kode untuk semua alamat. Tiap alamat = satu Circle atau Rumah Usaha (kolom `slug`). Nginx per alamat:
  `proxy_set_header X-Unit-Web <slug>;` (selalu ditimpa, tidak bisa dipalsukan klien). Blok aplikasi Management
  Dashboard memakai `X-Unit-Web app`.
- `GET /api/circle/identitas` (publik) → `{ aud, nama, slug, jenis, warna }` untuk halaman masuk dan warna aksen.
- `utils/web.js`: `cariLingkup(slug)`, `resolveWeb(req)` (`{ aud: 'app' }` | `{ aud: 'circle', lingkup }` | `{ galat }`),
  `izinLingkup`, `izinMasukLingkup`, `whereLingkup`.
- Boleh masuk alamat X: Super Admin/Kepala Ekosistem, atau punya peran kerja (bukan Dignity) di circle/rumah usaha itu
  (langsung atau lewat unitnya), atau pemilik unit di sana. Unit di bawah Korporasi dilayani di alamat yang diatur env
  `WEB_KORPORASI_SLUG`.
- Cookie refresh host-only: tiap alamat login sendiri.

## Peran & akses

**Token:** login di alamat unit menghasilkan JWT `{ id, aud: 'circle', cs: <slug> }`. Hanya diterima di `/api/circle`
dan `/api/auth`; token alamat lain → 403. Token menyamar membawa `imp` (id Super Admin), 30 menit, tanpa refresh.

**Batas permintaan:** global per akun dan per IP tanpa login; login menghitung percobaan gagal; kode Telegram dibatasi
per akun.

| Mode | Siapa | Boleh |
|---|---|---|
| `kelola` | Koordinator ke atas di unit ini (`kelolaStudio`), atau Admin Market | papan penuh, nilai uang, QC & Preview klien, Tim, Alur, Penugasan, Freelancer, Akun jualan, Keuangan, laporan tim. **Admin Market** = orang terpercaya Koordinator untuk produksi & market: mengubah akun jualan yang ia pegang, menugaskan akun ke marketer, menetapkan marketer pemegang order (menambah & menghapus akun jualan tetap Koordinator/Pendamping). Tanpa menu khusus Koordinator (Mulai di sini, Keuangan, Biaya & Kas, Tutup bulan, Evaluasi & Perbaikan), tanpa data SDM anggota, tanpa Alur, dan tidak memberi fungsi Marketer/Admin. Fungsi "Admin" di Tim = label; akses ditandai per orang |
| `kurasiQc` | fungsi PM/QC | Kurasi QC di atas antrean kerjanya sendiri, tanpa bagian invoice |
| `marketing` | fungsi MARKETER terkonfirmasi | Produksi mode pantau (lihat saja; uang & detail hanya order miliknya; tombol hanya aksi yang diizinkan mesin alur, termasuk wakil freelance), Marketing, fase Klien/Delivery/Selesai, Tugas saya, Setoran, Pembayaran miliknya |
| `tugas` | artist/anggota lain | tugas sendiri (mulai kerjakan, siap preview), kehadiran, slip, tanpa uang |
| `kelola` + `lihatSaja` | pemilik unit tanpa peran pengelola | melihat proses & uang unitnya; semua tulis ditolak; data pribadi orang lain tertutup |

- Peran `DIGNITY` disaring (`peranKerja`) di seluruh API (tanpa akses web unit; payroll-nya tetap sah).
- **Wewenang per unit** dan **Koordinator = CEO unit**: lihat `CLAUDE.md` § Aturan keras. Atasan lintas unit (Kepala
  Circle/Rumah Usaha ke atas): Manajemen, riwayat login, kalender acara, pengawas diskusi. Super Admin: hari libur,
  pasangan kategori biaya, menyamar, membuka lagi bulan.
- Keuangan: baca = Koordinator/Pendamping ke atas; tulis = `ROLE_KIRIM_LAPORAN`. Angka di luar wilayah disamarkan.

## Navigasi

Beranda tab pertama untuk semua mode. Sidebar dikelompokkan (Kerja harian / Penjualan & klien / Uang / Tim & kinerja /
Pengaturan) di `MenuSisi.jsx`.
- `kelola`: Beranda · Mulai di sini · Produksi · Marketing · Tagihan · Pembayaran · Penjualan · Klien · Keuangan ·
  Biaya & Kas · Tutup bulan · Penggajian · Analitik · Evaluasi & Perbaikan · Tugas saya · Laporan tim · Kehadiran ·
  Penugasan · Akun jualan · Tim · Alur · Freelancer · [Manajemen — atasan] · Slip saya · Diskusi
- `marketing`: Beranda · Mulai di sini · Marketing · Produksi (pantau) · Klien · Setoran · Pembayaran · Tugas saya ·
  Tugas selesai · Kehadiran · Kinerja saya · Slip saya · Diskusi
- `tugas`: Beranda · Mulai di sini · Tugas saya · Tugas selesai · Kehadiran · Kinerja saya · Slip saya · Diskusi

Pilih unit di sidebar (dikelompokkan per circle/korporasi). Koordinator yang belum menyelesaikan langkah wajib "Mulai di
sini" mendarat di sana. Perubahan dari orang lain muncul tanpa muat ulang (SSE). Menu LTK, Kas pusat, dan transfer ke
pusat disembunyikan (kode & data utuh).

## Modul

### Mulai di sini (`Mulai.jsx`, `controllers/circleMulai.js`)
Kesiapan dihitung server dari data. Koordinator: **wajib** (tim terkonfirmasi semua anggota, ≥1 akun jualan selain
"Order Internal", alur kerja disetujui), **disarankan** (keahlian penugasan, target omset, akun↔marketer, kas awal &
biaya rutin, aturan lembur, penggajian bulan ini, penerbit invoice, posisi SDM, Telegram bila pengingat aktif), dan
untuk atasan **pengaturan circle** + tabel kesiapan semua unit. Marketer & talent: panduan pribadi yang dicentang dari
datanya sendiri. Tampilan: cincin progres, kartu "Langkah berikutnya", tiga tahap yang bisa dilipat.

### Produksi (`utils/alur.js`, murni)
- Jenis langkah tetap (lihat `AGENTS.md`); nama langkah = data per unit (`TahapProduksi`). Fase makro: Antrian,
  Produksi, QC, Revisi, Klien, Finalisasi, Delivery, Hold, Selesai. Fase Klien/Delivery/Selesai dipegang marketer.
- Gerbang QC per tahap kerja; revisi internal kembali ke QC; Preview/Revisi klien opsional; tahap opsional per order
  (`OrderProduksi.tahapAktif`).
- Preset templat: `sederhana`, `layanan`, `ilustrasi`, `3d`. Editor di tab Alur. Templat boleh diganti walau sudah ada
  order: order dipindah ke langkah paling mirip (`petakanTahapLama`). Jenis langkah "tengah" boleh diganti; Inbox,
  Selesai, dan gerbang QC terkunci.
- `aksiTersedia(...)` = satu pintu aksi untuk papan dan tugas. Riwayat (`RiwayatTahapOrder`) menyimpan nama tahap + waktu.
- Tambah order: satu-satu atau tempel banyak (pemisah Tab, `|`, `;`, dua spasi; tanggal & Rp dikenali) dengan pratinjau.
  Akun jualan wajib. Talent freelance cukup nama.
- Order: ubah data dasar (`PATCH /orders/:id`), ubah nilai, **uang masuk sebenarnya** (`uangMasukRiil`), batalkan
  (BATAL + alasan; ditolak bila ada cicilan dibayar/sudah selesai) & pulihkan, **cancel klien** (SELESAI + tanda, tetap
  dihitung), tanda status bayar di kartu, audit perubahan (`AuditOrder`).
- **Antrean talent:** definisi tunggal `JENIS_KERJA` (KERJA, REVISI_*, FINALISASI). Tim bisa dibagi per tahap
  (`AssignmentProduksi.tahapKerjaIds`). Inbox dimulai admin/koordinator (atau wakil freelance).
- **Pekerjaan internal** (Porto / Persiapan, `OrderProduksi.pekerjaanInternal`): tanpa klien & uang, tetap di papan &
  antrean talent, tidak dihitung sebagai order klien (`ORDER_KLIEN`). "Jadikan order klien" dari detail order.
- **Buka kembali untuk revisi:** order Done/arsip bisa dibuka lagi dari detail order (order yang sama, omset tetap sekali).
- **Marketer pemegang** order (`OrderProduksi.marketerId`): ditetapkan Koordinator/Admin Market; kosong = fase klien boleh
  digerakkan marketer unit mana pun. Hapus order ditolak bila fee freelance-nya sudah dibayar.
- Papan & ringkasan Produksi bisa dilihat per akun jualan; kolom Done & Cancel urut paling baru selesai.

### Detail order (`controllers/circleOrder.js`, `DetailOrder.jsx`)
Info, tim (fee per orang), riwayat tahap, item/add-on, catatan proyek. Pengelola (dan marketer pemegang untuk ordernya):
harga item ("samakan nilai order" eksplisit), **cicilan** (DP/Cicilan N/Pelunasan, jumlah yang diterima unit, jatuh
tempo, tanggal bayar) yang menyelaraskan status bayar order. Tabel `ItemOrder`, `TerminBayarOrder`, `CatatanOrder`.

### Tim, Penugasan, Freelancer, Klien
- **Tim** (`FungsiAnggota`): fungsi per anggota per unit, dikonfirmasi koordinator.
- **Penugasan** (`utils/penugasan*.js`): penugasan per tahap, antrean per orang, keahlian tahap/genre + kesulitan order,
  penugasan otomatis (keahlian ≥ kesulitan, beban terendah), "isi keahlian dari riwayat", tanda mendesak.
- **Freelancer** = data induk (nama, HP, bank, keahlian, portofolio), rekening hanya 4 digit akhir; hanya pengelola.
- **Klien** (`circleKlien.js`): direktori per unit, repeat order, ganti nama, gabung entri ganda (`OrderProduksi.klienId`).
- **Kategori order** (`utils/kategori.js`): pilihan per unit, satu order boleh beberapa kategori.

### Marketing (`utils/marketing.js`, `controllers/circleMarketing.js`)
Tab: Antrean klien, Aktivitas (15 jenis: Unggah konten/Interaksi/Jejaring/Optimasi), Prospek (`MarketingLead`, boleh
USD × kurs; "Jadikan order"), Rencana bulanan (`TargetMarketing`), Ringkasan, Analisis (tahapan penjualan; peringkat
hanya manajer), Profil & catatan harian (log suasana hati pribadi). Di Ringkasan, Koordinator bisa membuka rincian
aktivitas per marketer (judul, link postingan, akun target, hasil). Prospek bisa diurutkan terbaru masuk atau paling lama
belum di-follow-up. **Follow up klien lama** dicatat dari menu Klien (aktivitas tertaut `AktivitasMarketer.klienId`,
kolom Terakhir di-follow-up). Marketer hanya memakai akun yang ditugaskan
(`PenugasanAkunMarketer`); daftar marketer selalu `masihDiUnit`.

### Kehadiran, lembur, refleksi, penggajian
- **Kehadiran** (`utils/kehadiran.js`): presensi WFO/WFA, keluar-kembali, pulang, istirahat dipotong otomatis, lupa
  presensi pulang (tidak dihitung sampai dikoreksi koordinator), izin/cuti + persetujuan (Koordinator ke atas unit
  pemohon, bukan diri sendiri), roster, rekap, terlambat, kalender (libur & acara). **Lokasi kantor unit**
  (`utils/lokasiKantor.js`): di dalam radius = WFO otomatis, di luar = WFA; titik lokasi anggota tidak disimpan. Check-in harian pribadi: atasan hanya
  melihat partisipasi + agregat (≥3 orang).
- **Lembur** = fee pekerjaan (`LemburKehadiran`, `PengaturanLembur`, `LevelLembur`, `TahapLembur`): per project (nilai
  diisi saat disetujui) atau per level & progres; status MENUNGGU/DISETUJUI/DITOLAK; perhitungan murni
  `utils/lembur.js`. Slip hanya mengklaim lembur DISETUJUI milik unit itu, sekali, lewat `lemburUntukSlip`, termasuk
  **lembur susulan** dari bulan sebelumnya.
- **Lembur dari tugas yang ditunda** (setelan unit `lemburDariTunda`, Koordinator): catat manual ditutup; tugas DITUNDA
  yang diselesaikan talent di luar jam kerja jadi calon lembur 🌙 (sumber TUNDA, status CALON), dinilai Admin
  Market/Koordinator di Tugas saya (level × bagian tahap).
- **Refleksi mingguan** (`utils/refleksi.js`): hambatan per orang; Koordinator unit membaca & berkomentar.
- **Penggajian** (tab, koordinator): THP dari Bio Studio dipecah jadi rincian tetap, slip bulanan disiapkan otomatis
  (+ lembur), Final → Dibayar, slip PDF. **Slip saya**: hanya milik sendiri, FINAL/DIBAYAR.
- **Profil SDM** + **Susunan tim** (direktori unit).

### Keuangan unit (mode bayangan)
- **Keuangan** (`circleKeuangan.js`): membungkus handler Management Dashboard (laporan mingguan, pengeluaran, rekening,
  data bulanan) dengan pagar unit; tab Minggu ini, Rekap & peringkat, Riwayat, Kas & dana (ubah saldo saja).
- **Biaya & Kas** (`circleKas.js`): biaya dengan persetujuan (terpisah dari pembayaran), kunci, kategori; penarikan
  pendapatan `WD-…` (langsung jadi pemasukan buku besar), dana tertahan `HD-…`; **kas dari cicilan**: cicilan order akun
  Komunitas/Internal otomatis jadi Pendapatan; Pendapatan merinci saldo platform & belum dibayar klien; perbandingan bulanan omset bersih order −
  WD − tertahan; saldo platform per bulan.
- **Buku besar & Tutup bulan** (`circleBuku.js`): ringkasan, rincian + entri manual, biaya rutin (`ItemTetap`), status
  semua unit, atur kategori (Super Admin). Bulan terbuka dihitung langsung; tutup bulan menyimpan snapshot terkunci +
  kas akhir (`StatusBulan`) dan mengunci sumber bulan itu; buka lagi = Super Admin, tidak bila bulan berikutnya sudah
  ditutup. Laba rugi 12 bulan + proyeksi 3 bulan; Rencana keuangan (3 skenario, tidak disimpan).
- **Penjualan & target** (`circlePenjualan.js`): target per akun (`TargetOmsetAkun`), periode closing tiap Jumat + akhir
  bulan dengan kekurangan/kelebihan dibawa; omset = nilai bersih order dalam USD. **Manajemen** (atasan): peringkat unit,
  piutang + umur, laba rugi per rentang.
- **Tagihan** (`circleTagihan.js`): gabung beberapa order satu klien → `INV-…`; Draft → Ditagih → Lunas; cetak invoice
  dari **Penerbit invoice** (`PengaturanInvoice`, diisi pengelola unit). **Pembayaran**: sisa per order + umur piutang.
- **Setoran marketer** (`SetoranMarketer`): dicatat kapan saja; ringkasan per marketer.
- **Cek omset** (`utils/omsetBayangan.js`, hanya baca): omset dari order berdampingan dengan Laporan Omset per periode.

### Analitik & evaluasi
- **Analitik** (`utils/analitik.js`, `utils/jamKerja.js`): Kondisi hari ini (bisa diklik), Kinerja (waktu produksi/QC/
  revisi/antre dalam jam kerja bersih, tepat waktu), Revisi, Tren, Kalender kerja. Tanpa uang.
- **Evaluasi & Perbaikan** (id `kaizen`, `utils/kaizen.js`): omset vs target, CPM, kecepatan & ketepatan waktu, SDM dari
  Penilaian Kader, rencana perbaikan.
- **Laporan tim** (`utils/laporanOgs.js`): tugas selesai, progres harian, kontribusi nilai per orang (Koordinator ke atas),
  beban kerja.

### Platform
- **Realtime SSE** (`GET /stream`, `utils/realtime.js`): server hanya menyiarkan "bagian X berubah"; klien mengambil ulang
  lewat API. Stream hanya untuk tab yang terlihat; maks 20 koneksi per orang.
- **Menyamar** (Super Admin, `POST /impersonasi`): alasan wajib, 30 menit, tidak berantai, tidak bisa meniru Super Admin,
  tercatat di `LogImpersonasi`; aksi uang/presensi ditolak; audit order menandai "(disamar oleh …)".
- **Diskusi & otomatisasi** (`utils/otomasi*.js`): thread keputusan, peringatan deadline & QC macet. **Pengingat
  Telegram** (6 jenis, `utils/pengingat*.js`) hanya dikirim bila `OTOMASI_AKTIF=1`; tautan Telegram bisa dari web ini.
- **Tutup penugasan basi** (sapuan harian di bot): order selesai/batal menutup penugasan yang menggantung.
- **Ekspor:** CSV, Excel, dan Cetak/PDF lewat `TombolUnduh`.

## Integrasi dengan Management Dashboard

| Data | Arah |
|---|---|
| `User`, `UserRole`, `Studio`, `Circle`, `RumahUsaha` | satu sumber; login & peran dari Management Dashboard. Web ini hanya menulis kolom Telegram + `LogLogin` di User |
| `OrderProduksi`, `AkunProduksi`, `AssignmentProduksi`, `MarketingLead`, `ProduksiAdminMarket` | ditulis web ini; dibaca Management Dashboard di Unduh Laporan (Weekly) dan Payroll (`GET /api/payroll/order-opsi`) |
| `WeeklyReport`, `StudioRekening`, CPM, `PenilaianKader` | dibaca web ini (evaluasi, kurs, kas) |
| `Penggajian` (FINAL/DIBAYAR) | dibaca untuk Slip saya |
| `LemburKehadiran` → `Penggajian.lembur` | ditulis web ini, diklaim Payroll menurut aturan lembur unit |
| `Studio.hitungDiEkosistem=false` | dikecualikan dari semua total |

Sengaja **belum** tersambung (bisa membuat dua sumber angka): omset order vs Laporan Omset (lihat Cek omset), keuangan
bayangan vs Laporan Omset, biaya unit vs pengeluaran rutin, presensi/refleksi vs penilaian. Tidak terhubung sama
sekali: Dana Pengembangan, Koperasi, Rekrutmen, Raport, Aset.

## Belum dibangun / perlu keputusan pemilik

1. **Pipeline keuangan ke Management Dashboard** (urutan usulan): biaya → Pengeluaran, Payroll FINAL → biaya rutin
   "Gaji", penarikan ↔ saldo rekening, omset order → Laporan Omset.
2. Acuan omset: nilai kotor atau bersih, dan kapan Laporan Omset boleh diisi otomatis dari order.
3. Tagihan "Lunas" vs cicilan: "Lunas" menandai order lunas tanpa menandai cicilan.
4. Portal login pihak luar (komunitas/freelance) untuk LTK & tagihan.
5. Menyalakan pengingat Telegram (`OTOMASI_AKTIF=1`) setelah sebagian besar anggota menautkan Telegram.
6. Order "cancel klien" dihitung seperti Selesai; pisahkan di laporan bila perlu.

## Database

Skema penuh: `server/prisma/schema.prisma` di repo Management Dashboard (lampiran model di `openspec.md` repo itu).
Migrasi selalu dibuat di repo itu; jangan memakai `--shadow-database-url` ke database berisi data.

## API

<!-- api-circle:mulai -->
_Dibangkitkan dari `routes/circle.js` repo Management Dashboard: 276 rute. Semua memakai `authenticate` + `populateRoles`; otorisasi akhir di controller._

`GET /identitas`, `GET /tugas-saya`, `GET /tugas-admin`, `GET /tim`, `POST /tim/terima-saran`, `PUT /tim/:userId`, `GET/PUT /templat`, `PUT /templat/qc-semua`, `POST /orders/:id/aksi`, `PATCH /orders/:id/opsional`, `POST /tugas/:id/aksi`, `GET /saya`, `GET /papan`, `GET /papan/ringkasan`, `GET /gaji`, `PUT /gaji/rincian`, `POST /gaji/siapkan`, `POST /gaji/final-semua`, `DELETE/PATCH /gaji/baris/:barisId`, `GET /gaji/:id/slip`, `PATCH /gaji/:id`, `POST /gaji/:id/baris`, `PATCH /gaji/:id/tanggal`, `POST /gaji/:id/final`, `POST /gaji/:id/buka`, `POST /gaji/:id/dibayar`, `GET/POST /update-klien`, `POST /update-klien/feedback`, `GET /update-klien/:orderId/riwayat`, `DELETE/PATCH /update-klien/catatan/:id`, `GET/POST /klien`, `DELETE/PATCH /klien/:id`, `POST /klien/:id/gabung`, `GET/POST /freelancer`, `DELETE/PATCH /freelancer/:id`, `POST /orders`, `PATCH /orders/:id/tahap`, `GET /mulai`, `POST /mulai/alur`, `DELETE/GET /telegram`, `POST /telegram/kode`, `GET/POST /akun-jualan`, `DELETE/PATCH /akun-jualan/:id`, `GET /analitik/nadi`, `GET /analitik/kinerja`, `GET /analitik/kinerja-saya`, `GET /analitik/revisi`, `GET /analitik/tren`, `GET/POST /kalender/libur`, `DELETE /kalender/libur/:id`, `PATCH /orders/:id`, `GET /orders/:id/detail`, `POST /orders/:id/batal`, `POST /orders/:id/cancel-klien`, `POST /orders/:id/pulihkan`, `GET /orders-batal`, `GET /orders-selesai`, `PUT /orders/:id/item`, `POST /orders/:id/samakan-nilai`, `PATCH /orders/:id/isian-khusus`, `POST /orders/:id/termin`, `DELETE/PATCH /orders/:id/termin/:terminId`, `POST /orders/:id/catatan`, `DELETE /orders/:id/catatan/:catatanId`, `GET /piutang`, `GET /antrean`, `PUT /antrean/urutan`, `GET /antrean-saya`, `POST /penugasan/:id/tunda`, `POST /keahlian/dari-riwayat`, `PATCH /penugasan/:id`, `POST /orders/:id/tim`, `DELETE/PATCH /orders/:id/tim/:assignmentId`, `POST /orders/:id/tim/:assignmentId/berhenti`, `POST /orders/:id/tim/:assignmentId/aktifkan`, `POST /orders/:id/tugaskan-otomatis`, `GET /orders/:id/saran`, `PATCH /orders/:id/profil`, `GET/PUT /keahlian`, `DELETE /keahlian/:id`, `PUT /pengaturan-penugasan`, `GET /diskusi/opsi`, `GET /diskusi/belum-dibaca`, `GET/POST /diskusi`, `GET/PATCH /diskusi/:id`, `POST /diskusi/:id/pesan`, `DELETE /diskusi/:id/pesan/:pesanId`, `POST /diskusi/:id/putuskan`, `POST /diskusi/:id/batalkan`, `POST /diskusi/:id/peserta`, `DELETE /diskusi/:id/peserta/:userId`, `GET /otomasi/peringatan`, `POST /otomasi/eskalasi`, `GET /kaizen/eksekutif`, `GET /kaizen/omzet`, `GET /kaizen/siklus`, `GET /kaizen/keterlambatan`, `GET /kaizen/ketepatan`, `GET/PUT /kaizen/target`, `GET/POST /kaizen/tindakan`, `PATCH /kaizen/tindakan/:id`, `GET /kehadiran/hari-ini`, `POST /kehadiran/catat`, `POST /kehadiran/lembur`, `GET /kehadiran/order-lembur`, `GET /kehadiran/riwayat`, `GET/POST /kehadiran/cuti`, `POST /kehadiran/cuti/:id/batal`, `GET /kehadiran/kotak-cuti`, `POST /kehadiran/cuti/:id/setujui`, `POST /kehadiran/cuti/:id/tolak`, `GET/PUT /lembur/aturan`, `GET/PUT /kehadiran/jam-kerja`, `DELETE/GET/PUT /kehadiran/lokasi-kantor`, `GET/PUT /lembur/level`, `GET/PUT /lembur/tahap`, `GET /lembur/usulan`, `GET /lembur/menunggu`, `GET/POST /lembur/calon`, `POST /lembur/:id/usul`, `POST /lembur/:id/setujui`, `POST /lembur/:id/tolak`, `GET /kehadiran/roster`, `GET /kehadiran/rekap`, `GET /kehadiran/lupa-pulang`, `POST /kehadiran/koreksi-pulang`, `GET /kehadiran/terlambat`, `GET /checkin/hari-ini`, `POST /checkin`, `POST /checkin/lewati`, `GET /checkin/tim`, `GET /kalender`, `POST /kalender/acara`, `DELETE/PATCH /kalender/acara/:id`, `POST /kalender/acara/:id/hentikan`, `GET /refleksi/saya`, `POST /refleksi`, `PATCH /refleksi/:id`, `GET /refleksi/tim`, `GET /refleksi/orang/:userId`, `POST /refleksi/:id/komentar`, `DELETE /refleksi/komentar/:id`, `GET /ltk/opsi`, `GET/POST /kategori-order`, `DELETE/PATCH /kategori-order/:id`, `GET/POST /ltk`, `DELETE/GET/PATCH /ltk/:id`, `POST /ltk/:id/ajukan`, `POST /ltk/:id/negosiasi`, `POST /ltk/:id/deal`, `POST /ltk/:id/tolak`, `POST /ltk/:id/batal`, `POST /ltk/:id/catatan`, `POST /ltk/:id/konversi`, `GET /ltk/:id/order-lempar`, `POST /ltk/:id/hubungkan`, `GET /tagihan/klien`, `GET/PUT /tagihan/penerbit`, `GET /tagihan/layak`, `GET/POST /tagihan`, `GET/PATCH /tagihan/:id`, `POST /tagihan/:id/tagih`, `POST /tagihan/:id/draft`, `POST /tagihan/:id/batal`, `POST /tagihan/:id/aktifkan`, `POST /tagihan/:id/lunas`, `GET/POST /orders/:id/invoice`, `GET /analitik/timeline`, `GET /analitik/jenis-order`, `GET /marketing/laporan-harian`, `GET/POST /setoran`, `DELETE /setoran/:id`, `GET /beranda`, `POST /penugasan/:id/mendesak`, `GET /tugas-selesai`, `POST /penugasan/:id/batal-selesai`, `GET /progres-harian`, `GET /kontribusi`, `GET /kontribusi/detail`, `GET /beban-kerja`, `GET /pembayaran`, `GET/POST /kolom-khusus`, `DELETE/PATCH /kolom-khusus/:id`, `GET /bayar-freelance`, `POST /bayar-freelance/:id/bayar`, `POST /bayar-freelance/:id/batal`, `POST /bayar-freelance/:id/ajukan`, `POST /bayar-freelance/:id/batal-ajuan`, `PUT /orders/:id/tautan`, `POST /orders/:id/selesaikan-semua`, `GET /pipeline`, `GET /riwayat-login`, `GET /pengingat/pratinjau`, `GET/POST /admin-market`, `DELETE /admin-market/:id`, `PUT /admin-market/:id/akun`, `GET /penjualan`, `GET /kurs`, `GET/PUT /penjualan/target`, `GET /peta-alur`, `GET /rekap-kerja`, `GET /slip-saya`, `GET /manajemen`, `GET /stream`, `GET /impersonasi/kandidat`, `GET /impersonasi/log`, `POST /impersonasi`, `GET/PUT /profil-sdm`, `GET /manpower`, `GET/POST /kategori`, `GET /ringkasan`, `GET /rincian`, `GET /laba-rugi`, `GET /rentang`, `GET /rencana`, `GET /ringkasan-circle`, `POST /entri`, `DELETE /entri/:id`, `GET/POST /item-tetap`, `PATCH /item-tetap/:id`, `PUT /item-tetap/:id/bulan`, `PUT /kas-awal`, `GET /rekening`, `PUT /saldo-awal-rekening`, `POST /pindah`, `DELETE /pindah/:id`, `POST /bayar-rutin`, `POST /bayar-rutin/batal`, `POST /samakan-bio`, `POST /tutup`, `POST /buka-lagi`
<!-- api-circle:selesai -->

## Pengujian

Skrip di `tes/` (lihat `tes/README.md`). Murni: `uji-mesin`, `uji-fungsi`, `uji-marketing`. Lainnya memanggil API
server lokal, membuat akun & data sementara, lalu menghapusnya. Jalankan semua sebelum deploy perubahan API.
