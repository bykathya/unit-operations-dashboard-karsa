# Skrip uji (ad-hoc)

Dijalankan manual terhadap server Ekosistem lokal (`127.0.0.1:3001`) dan database lokal; masing-masing membuat akun/data uji
sementara lalu menghapusnya. Lokasi repo Management Dashboard dibaca dari env `DASHBOARD_DIR` (bawaan: folder saudara `../management-dashboard`, lihat `_jalur.mjs`).

- `uji-mesin.mjs` — mesin alur murni (tanpa database/server)
- `uji-alur-api.mjs` — API alur: templat, gerbang QC, opsional, penyuntingan, order lama
- `uji-circle.mjs` — alur dasar + isolasi antar circle + freelancer
- `uji-fungsi.mjs` — tebakan fungsi kerja (murni)
- `uji-tim-api.mjs` — API Tim: tebakan, konfirmasi, izin, batas studio
- `uji-marketing.mjs` — logika murni marketing (katalog 15 aktivitas, KPI, aturan wajib isi, corong)
- `uji-marketing-api.mjs` — API marketing: akses per peran, penugasan akun, aktivitas, rencana, prospek→order, antrean klien, insight
- `uji-keamanan.mjs` — jalur masuk, token circle, talent, batas permintaan (jalankan server dengan `AKSES_DASHBOARD_MIN_ROLE=KOORDINATOR`)

- `uji-tambahan-api.mjs`, `uji-gelombang3-api.mjs` — modul adaptasi OGS tambahan (setoran, timeline, jenis order, dll.)
- `uji-order-api.mjs`, `uji-usd-audit-api.mjs` — detail order, item & termin, audit perubahan, order USD + kurs + fee
- `uji-penugasan-api.mjs`, `uji-laporan-api.mjs`, `uji-kebersihan-api.mjs` — penugasan tahap, laporan task, penutupan tugas basi
- `uji-admin-market-api.mjs` — akses Admin Market per unit
- `uji-pantau-adminmarket-api.mjs` — marketer: Produksi mode pantau (uang hanya order miliknya); wakil freelance (tahap kerja order freelance miliknya, QC tetap koordinator — 9 Nov); marketer pindah unit hilang dari unit lama (9 Nov); Admin Market tanpa data SDM anggota (27 Okt)
- `uji-kendala-marketer-api.mjs` — perbaikan laporan marketer 9 Nov: wakil freelance tanpa talent internal, prospek USD → order USD, marketer mengubah data/item/termin order miliknya, antrean klien, angka Selesai = kolom Done
- `uji-batal-ltk-alur-api.mjs` — batalkan/pulihkan order, hapus LTK salah isi, ganti jenis langkah alur yang dipakai order (templat dikembalikan), platform WhatsApp
- `uji-langit-api.mjs` — masukan tim Langit: bank data pihak LTK, LTK Lempar → hubungkan ke order, penerbit invoice (rekening Ekosistem tidak bocor)
- `uji-masukan-tim-9nov-api.mjs` — lembur per project, freelance cukup nama, LTK langsung Deal, tombol order untuk pemilik unit
- `uji-korporasi-api.mjs` — unit di bawah Korporasi masuk alamat Circle Ekosistem (jalankan server lokal dengan `WEB_KORPORASI_SLUG=utama`)
- `uji-akun-api.mjs`, `uji-penjualan-api.mjs` — akun jualan, target per akun, penjualan vs target
- `uji-marketing-dashboard.mjs`, `uji-ltk-tagihan-api.mjs`, `uji-ops-api.mjs` — dasbor marketing, LTK & tagihan, pembayaran/pipeline/riwayat login/pengingat
- `uji-kehadiran-api.mjs`, `uji-refleksi-api.mjs`, `uji-lembur-aturan.mjs`, `uji-lembur-payroll-api.mjs` — presensi/izin/check-in, refleksi, aturan lembur unit, lembur → Payroll
- `uji-keuangan-api.mjs`, `uji-kas-api.mjs`, `uji-buku-api.mjs`, `uji-laba-rugi-api.mjs`, `uji-omset-bayangan.mjs`, `uji-payroll-api.mjs` — keuangan bayangan, biaya & kas, buku besar & tutup bulan, laba rugi, omzet bayangan, payroll
- `uji-kaizen-api.mjs`, `uji-analitik-api.mjs`, `uji-diskusi-api.mjs`, `uji-mulai-api.mjs` — Evaluasi & Perbaikan (kaizen), analitik, diskusi, "Mulai di sini" (koordinator + panduan marketer/talent, 11 Nov)
- `uji-pemilik-api.mjs`, `uji-perbaikan-audit-api.mjs` — pemilik unit lihat saja; perbaikan audit (wewenang per unit, talent tanpa uang)

**Butuh data contoh.** Banyak skrip API mencari unit uji tertentu (mis. studio bernama "Keiko", "Pibi", atau skenario demo
"Sekartaji") di database lokal. Di ekosistem baru, siapkan dulu data uji serupa atau sesuaikan nama unit di skripnya.
Skrip yang membersihkan templat/fungsi unit jangan dijalankan saat skenario demo terpasang (`node demo/seed-demo.mjs hapus` dulu).

Beberapa skrip butuh server dijalankan dengan env khusus: `uji-keamanan.mjs` → `AKSES_DASHBOARD_MIN_ROLE=KOORDINATOR`;
`uji-korporasi-api.mjs` → `WEB_KORPORASI_SLUG=<slug circle utama lokal>`.

Jalankan semua: `for f in tes/uji-*.mjs; do node "$f"; done` (setiap skrip mencetak `gagal: N` di akhir).

**Ditambahkan 9–12 Nov 2026:**
- `uji-lembur-level.mjs` — lembur per level & progres (rumus unit + alur API)
- `uji-cancel-klien-api.mjs`, `uji-ubah-nilai-order-api.mjs`, `uji-uang-masuk-riil-api.mjs`, `uji-marketer-ubah-harga-api.mjs` — cancel klien, ubah nilai order, uang masuk sebenarnya, marketer pemegang mengubah harga ordernya
- `uji-tim-fee-api.mjs`, `uji-tim-awal-otomatis-api.mjs`, `uji-antrean-talent-api.mjs` — fee talent/freelance di Tim order, tim awal dari form order, antrean talent satu definisi + tim per tahap
- `uji-kategori-api.mjs`, `uji-klien-api.mjs`, `uji-freelancer-induk-api.mjs`, `uji-edit-cicilan-api.mjs`, `uji-ganti-templat-api.mjs` — kategori pilihan, direktori klien, data induk freelancer, ubah cicilan, ganti templat alur saat ada order
- `uji-update-klien-api.mjs` — tab Update klien (kapan terakhir dikabari, terlewat, akses per peran)
- `uji-gaji-api.mjs` — Penggajian: rincian tetap dari THP Bio, slip, Final → Dibayar, tanggal gajian/SHU, akses per peran
- `uji-lupa-pulang-api.mjs` — lupa presensi pulang tidak dihitung sampai sekarang; koreksi jam pulang oleh koordinator (11 Nov)
- `uji-rekening-kas-api.mjs` — kas per rekening (rekening dari Bio Ekosistem): saldo awal, penarikan/biaya/entri memilih rekening, pindah dana, saldo hari ini, tutup bulan → bulan berikutnya, tombol Perbarui saldo Bio (pengaman saldo awal, jejak), nomor rekening tidak bocor (12 Nov)
- `uji-admin-per-akun-api.mjs` — Admin Market per akun jualan: papan/detail/aksi/ubah/buat order/tagihan/pembayaran/update klien/analitik/beranda hanya order akunnya; kosong = semua (12 Nov)
- `uji-biaya-rutin-hapus-api.mjs` — hapus (nonaktifkan) biaya rutin: koordinator unit boleh, talent & item semua unit ditolak, bulan ditutup tetap (12 Nov)
- `uji-biaya-bio-api.mjs` — biaya rutin, gaji (THP/slip), SHU & Dignity dari Bio studio dibaca buku besar; pengaman dobel (12 Nov)
- `uji-bayar-rutin-api.mjs` — tandai biaya rutin dibayar (tanggal + rekening), slip dibayar otomatis (12 Nov)
- `uji-bayar-freelance-api.mjs`, `uji-hapus-freelancer-api.mjs` — Bayar freelance (DP/lunas → biaya otomatis), freelance dari order masuk data induk, hapus freelancer (riwayat aman) (12 Nov)
- `uji-ringkasan-web-circle-api.mjs` — halaman Web Circle di Management Dashboard: wewenang (talent/token circle ditolak, Koordinator unitnya, Super Admin semua) & angka per unit sama dengan papan, Belum dibayar klien, Kondisi hari ini, Tutup bulan (14 Nov)
- `uji-masukan-14nov-api.mjs` — talent Berhenti (antrean, papan, Tugas selesai, tahap berikutnya, Aktifkan lagi, ✕ menutup tugas, freelance dibayar tak bisa ✕), satu rumus belum ditagih (DP tanpa invoice, Pelunasan = sisa, Perlu invoice), kartu sudah Delivery (14 Nov)
- `uji-masukan-13nov-sore-api.mjs` — masukan tim 13 Nov sore: Tambah order dengan kategori & fee (fee hanya pengelola), prospek yang ordernya dihapus kembali ke Nego, Admin Market mengatur fungsi tim produksi (tanpa Marketer/Admin), order ditunda di atas pilihan lembur, klien terakhir dikabari
- `uji-freelancer-per-unit-api.mjs` — freelancer per unit: bawaan hanya unit pencatat, "Bagikan ke unit lain" (tanpa rekening/catatan, tidak bisa ubah/hapus), Order & Total fee per unit, nama sama tidak tertaut ke data unit lain (13 Nov)
- `uji-invoice-order-api.mjs`, `uji-hold-penugasan.mjs` — invoice DP/pelunasan per order + lunas = cicilan; Hold tidak dihitung tugas selesai (12 Nov)
- `uji-pilihan-talent-api.mjs`, `uji-ubah-kas-api.mjs` — pilihan talent order (peran kerja + Artist); ubah biaya & penarikan (bulan ditutup ditolak) (12 Nov)
- `uji-qc-semua-api.mjs` — pengaturan unit "Hasil talent selalu dicek admin (QC) dulu": akses, alur tanpa QC ditolak, Revisi klien → QC → QC lolos → Preview (12 Nov)
- `uji-tunda-antrean-api.mjs` — tunda antrean: pindah kartu dengan antrean:false → tugas ditunda (tidak di Antreanku, tetap di Tugas saya), masukkan/tunda dari Penugasan, talent ditolak (12 Nov); folder proyek (tautan pertama) terkirim di Antreanku & Tugas saya
- `uji-kolom-khusus-api.mjs` — kolom khusus order: atur (Ya/Tidak, pilihan, teks), isi per order, label di papan & antrean talent, talent tidak bisa mengisi, validasi nilai, unit lain ditolak (12 Nov)
- `uji-pendapatan-klien-api.mjs` — penarikan "Dari klien / keterangan" tampil di Rincian; pemasukan manual Rincian tampil di Pendapatan & ikut perbandingan omset (12 Nov)
- `uji-susunan-tim-api.mjs` — Susunan tim: Pendamping/Penasihat ditandai tidak perlu fungsi kerja (12 Nov)
- `uji-ubah-update-klien-api.mjs` — ubah catatan Update klien; hapus hanya catatan manual; talent ditolak (12 Nov)
- `uji-tugas-admin-api.mjs` — Tugas saya admin: baris QC tahap–order–talent + daftar tahap untuk dropdown, ✓ Lolos (aksi) & ↺ Revisi (pindah ke tahap kerja, +1 revisi), perlu invoice hanya Done ≤ 30 hari (berkurang setelah DP, hilang setelah pelunasan), talent ditolak, admin per akun (12 Nov)
- `uji-update-klien-pindah-api.mjs` — Update klien: nama panggilan, centang Preview/Kata/Deliver manual & lepas, pindah tahap dari tabel (→ kartu pindah & antrean talent), marketer hanya aksi mesin, talent ditolak (12 Nov)
- `uji-notif-grup.mjs` — kabar order baru ke grup Telegram: teks pesan, mati bila env kosong, jeda antar pesan; fetch Telegram diganti penangkap (tanpa server, tanpa pesan sungguhan) (12 Nov)
- `uji-laporan-grup.mjs` — Laporan Harian Market otomatis ke topik grup: teks per unit (order masuk + nilai, deliver, complete, aktivitas marketer), batas hari WIB, unit sepi, mati bila env kosong; fetch Telegram diganti penangkap (tanpa server) (12 Nov)
- `uji-kas-cicilan-api.mjs` — kas dari cicilan (Komunitas/Internal → Pendapatan otomatis; marketplace & cicilan lama tidak; ikut ubah/lepas/hapus; terkunci di Biaya & Kas; bulan ditutup 409; relasi), rincian Pendapatan (saldo platform, belum dibayar, belum terjelaskan), pengingat Tutup bulan & Beranda (21)
- `uji-lembur-susulan-api.mjs` — lembur susulan (disetujui/dicatat setelah slip bulannya Final → masuk slip berikutnya, per bulan asal, batas jam bulanan, tidak dobel), lembur menunggu semua bulan (Admin Market & talent 403), Beranda & peringatan Penggajian (14)
- `uji-masukan-16nov-api.mjs` — masukan tim 16 Nov: akun jualan (sejak 18 Nov: Admin boleh mengubah), antrean/tunda di Update klien & Kurasi QC, catatan diteruskan ke talent, hapus prospek, arsip Order selesai (36)
- `uji-jam-kerja-unit-api.mjs` — jam kerja per unit (Koordinator), presensi/terlambat/lembur otomatis memakai jadwal unit, pulang otomatis tanpa lembur (29)
- `uji-masukan-13nov-api.mjs` — masukan 13 Nov: pindah manual mundur = DITUTUP (bukan Tugas selesai), maju tetap selesai; fungsi kerja hanya Koordinator; prospek berisian seperti order + bisa diubah + Jadikan order membawa isian; catatan langsung di Update klien; aktivitas Lainnya; kurs form = kurs Laporan Mingguan terbaru (talent ditolak) — 23 pemeriksaan
- `uji-akun-studio-sosmed-api.mjs` — akun sosmed/marketplace studio dari Ekosistem di Marketing → Profil: koordinator, marketer, admin unit melihat; talent & unit lain ditolak; sosmed pribadi tidak ikut (12 Nov)
- `uji-masukan-16nov-sore-api.mjs` — masukan 16 Nov petang: kolom khusus bisa diubah + pilihan lebih dari satu (tetap Koordinator), kartu nilai Produksi per bulan, Admin hanya mengatur fungsi tim produksi, ajuan bayar freelance → Koordinator di Tugas saya (34)
- `uji-masukan-17nov-api.mjs` — masukan 17 Nov: batalkan invoice Ditagih (Lunas tidak), Cancel klien nilai 0 membatalkan invoice belum dibayar (gabungan ditolak, nilai < uang diterima ditolak, partial refund tidak menyentuh invoice), tanda biaya Bayar freelance di Rincian, order dihapus dengan fee freelance terbayar (23)
- `uji-admin-terpercaya-api.mjs` — 18 Nov: Admin mengubah akun jualan yang dipegang & menugaskan akun ke marketer (tambah/hapus tetap Koordinator), label Admin vs akses Admin Market, marketer pemegang order (Koordinator/Admin; order tanpa pemegang), PM/QC = Kurasi QC saja (33)
- `uji-masukan-20nov-api.mjs` — masukan tim 20 Nov: pekerjaan internal (porto/persiapan) tanpa klien & uang, tidak dihitung order masuk/Update klien/laporan grup, Jadikan order klien, tandai order Rp0; buka kembali order Done untuk revisi (order yang sama, tanggal masuk tetap); hapus klien yang semua ordernya batal; kartu Fee freelance (talent internal & porto tidak dihitung, marketer tanpa uang); papan mengirim tanggal selesai untuk urutan kolom Done; lihat per akun jualan (pilihan akun, ringkasan satu akun, admin per akun tidak keluar akunnya)
- `uji-lembur-tunda-api.mjs` — 22 Nov: lembur dari tugas yang ditunda — rumus level × bagian tahap, jam kerja unit, catat manual ditutup, CALON otomatis (di luar jam kerja), tugas biasa bukan lembur, 🌙 Tandai lembur, usulan admin (PM/QC & talent ditolak), Koordinator setuju/ubah nilai, slip hanya yang disetujui
- `uji-rincian-aktivitas-api.mjs` — 22 Nov: rincian aktivitas marketer (isi, link, target, hasil) untuk Koordinator; jumlah = tabel Aktivitas per marketer; saring jenis & belum selesai; marketer hanya miliknya, admin per akun, pemilik baca, talent & unit lain ditolak; link non-http tidak jadi tautan
- `uji-followup-klien-api.mjs` — 24 Nov: follow up klien lama — klien wajib & dari unit sendiri, kolom Terakhir di-follow-up (hanya selesai), dihitung di Jejaring & rincian aktivitas, gabung klien memindahkan, jadikan prospek; pemilik & talent ditolak
- `uji-lokasi-kantor-api.mjs` — 20 Nov: lokasi kantor unit → WFO otomatis di dalam radius, WFA wajib di luar, tak terbaca/akurasi kasar = pilihan sendiri bertanda; titik anggota tidak disimpan; Admin Market & talent ditolak; tanda di Kehadiran tim; hapus lokasi
- `_isolasi-bio.mjs` — helper (bukan uji): menolkan sementara angka Bio (biaya rutin/THP/SHU) unit uji agar hitungan buku besar eksak; dipakai `uji-buku-api`, `uji-laba-rugi-api`, `uji-biaya-bio-api`

**Jangan jalankan saat skenario demo terpasang** (beberapa tes membersihkan templat/fungsi studio Sekartaji): hapus demo (`node demo/seed-demo.mjs hapus`), jalankan tes, lalu pasang demo lagi.
Total: **95 skrip** (run penuh terakhir: 95 skrip lulus, 2.379 pemeriksaan, 20 Nov 2026), server lokal dijalankan dengan `WEB_KORPORASI_SLUG=utama`. Catatan: beberapa skrip bergantung pada templat alur unit uji (Keiko lokal tanpa tahap QC). Beberapa skrip lama masih berbaris pembuka salinan ("Uji ATURAN LEMBUR PER UNIT…") — isi sebenarnya sesuai daftar di atas.
