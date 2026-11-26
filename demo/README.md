# Skenario demo lokal

Mengisi satu unit contoh dengan koordinator, marketer, dan artist fiktif: order di berbagai tahap, prospek, aktivitas,
dan rencana. Hanya untuk database **lokal**. Skrip **tidak membuat unitnya**: buat dulu studio bernama `Sekartaji` di
sebuah circle lewat Management Dashboard (Unit Usaha), atau ganti nama studio di bagian atas `seed-demo.mjs`.

- Pasang/perbarui: `node demo/seed-demo.mjs` (lokasi repo Management Dashboard dari env `DASHBOARD_DIR`, bawaan
  `../management-dashboard`)
- Hapus: `node demo/seed-demo.mjs hapus`
- Akun & kata sandi demo: komentar di kepala `seed-demo.mjs`.
- Jalankan server Management Dashboard + `npm run dev` di repo ini → http://127.0.0.1:5174
