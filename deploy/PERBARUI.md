# Memperbarui tampilan di server

```bash
npm run build
rsync -az --delete dist/ <user>@<IP-VPS>:/var/www/<nama-web-unit>/dist/
```

Tidak perlu restart (nginx menyajikan berkas statis). Perubahan API di-deploy dari repo Management Dashboard lebih dulu.

**Menambah alamat unit:** salin `nginx-circle-contoh.conf`, ganti `server_name`, `X-Unit-Web` (slug), dan `root`;
isi kolom `slug` circle/rumah usaha itu di database dengan nilai yang sama; `nginx -t && systemctl reload nginx`;
pasang HTTPS (`certbot --nginx -d <alamat>`). Blok nginx aplikasi Management Dashboard wajib berisi baris di
`app-header.txt`. Simpan cadangan konfigurasi nginx sebelum mengubahnya.
