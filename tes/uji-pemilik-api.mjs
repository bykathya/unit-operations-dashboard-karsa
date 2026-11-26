import { DASH } from './_jalur.mjs'
// Uji PEMILIK UNIT — MODE LIHAT SAJA (21 Okt 2026): pemilik (StudioPemilik, penerima SHU) boleh masuk web circle & MELIHAT proses + uang
// unitnya, TIDAK bisa mengisi/mengubah apa pun; data pribadi orang lain tertutup; unit lain tetap tertutup. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.39.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const SANDI = 'uji-pemilik-' + Date.now(), hash = await bcrypt.hash(SANDI, 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, email: `uji.${kode}@uji.local`, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id
let orderId
const ekstraOrder = []
try {
  const pemilik = await user('pm_pemilik', [])                       // hanya pemilik, tanpa peran kerja
  const pemKar = await user('pm_kar', [['KARYAWAN', S]])             // pemilik yang juga bekerja di unit itu
  const koord = await user('pm_koord', [['KOORDINATOR', S]]), kar = await user('pm_kar2', [['KARYAWAN', S]])
  await prisma.studioPemilik.createMany({ data: [{ studioId: S, userId: pemilik.id, persenSaham: 10 }, { studioId: S, userId: pemKar.id, persenSaham: 5 }] })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: (await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })).id, tipeKlien: 'EKSTERNAL', klien: 'UJI-PM', judul: 'UJI-PM order', nilaiDisepakati: 500000, nilaiKotor: 500000, nilaiBersih: 500000, status: 'MASUK' } }); orderId = o.id

  console.log('— masuk —')
  let r = await panggil('/api/auth/login', { method: 'POST', body: { email: pemilik.email, password: SANDI } })
  cek('Pemilik (tanpa peran kerja) login di web Bloom → token circle', r.s === 200 && jwt.decode(r.j.data?.accessToken ?? '')?.cs === 'bloom', String(r.s))
  r = await panggil('/api/auth/login', { method: 'POST', web: 'naya', body: { email: pemilik.email, password: SANDI } }); cek('Pemilik login di alamat circle LAIN → 403', r.s === 403)
  r = await panggil('/api/circle/saya', { token: pemilik.c }); const st = r.j.data?.studios?.find(s => s.id === S)
  cek('Daftar unit: Keiko dengan mode lihat saja (bisaUbah=false)', r.s === 200 && st?.lihatSaja === true && st?.bisaUbah === false && r.j.data.studios.length === 1)

  console.log('— melihat proses & uang unitnya —')
  for (const [label, path] of [['Papan produksi', `/api/circle/papan?studioId=${S}`], ['Detail order (dengan uang)', `/api/circle/orders/${orderId}/detail`], ['Pipeline (nilai)', `/api/circle/pipeline?studioId=${S}`], ['Penjualan', `/api/circle/penjualan?studioId=${S}`], ['Biaya & kas', `/api/circle/kas/biaya?studioId=${S}`], ['Tutup bulan (ringkasan)', `/api/circle/buku/ringkasan?studioId=${S}&bulan=2031-01`], ['Kaizen', `/api/circle/kaizen/eksekutif?studioId=${S}`], ['Analitik', `/api/circle/analitik/nadi?studioId=${S}`], ['Roster kehadiran tim', `/api/circle/kehadiran/roster?studioId=${S}`], ['Bayangan omzet', `/api/circle/keuangan/bayangan?studioId=${S}&bulan=1&tahun=2031`]]) {
    r = await panggil(path, { token: pemilik.c }); cek(`Pemilik melihat: ${label}`, r.s === 200, String(r.s))
  }
  r = await panggil(`/api/circle/orders/${orderId}/detail`, { token: pemilik.c }); cek('Detail order memuat nilai uang, tanpa tombol kelola', r.j.data?.uang?.nilaiBersih === 500000)
  r = await panggil('/api/circle/keuangan/bulanan', { token: pemilik.c }); const ks = r.j.data?.studios?.find(s => s.id === S)
  cek('Laporan Omset bulanan: Keiko tampil dan angkanya TIDAK disamarkan', r.s === 200 && ks && ks.totalUsd !== null, String(r.s))

  console.log('— tidak bisa mengisi / mengubah —')
  for (const [label, path, method, body] of [
    ['Tambah order', '/api/circle/orders', 'POST', { studioId: S, judul: 'x', klien: 'x', akunId: 'INTERNAL' }],
    ['Pindah tahap', `/api/circle/orders/${orderId}/tahap`, 'PATCH', { tahapId: 'x' }],
    ['Ubah order', `/api/circle/orders/${orderId}`, 'PATCH', { judul: 'diubah' }],
    ['Catatan order', `/api/circle/orders/${orderId}/catatan`, 'POST', { isi: 'x' }],
    ['Catat biaya', '/api/circle/kas/biaya', 'POST', { studioId: S, kategori: 'x', tanggal: '2031-01-05', jumlah: 1 }],
    ['Isi Laporan Omset', '/api/circle/keuangan/laporan', 'POST', { studioId: S, periodeAwal: '2031-01-05', kurs: 16000 }],
    ['Atur target', '/api/circle/kaizen/target', 'PUT', { studioId: S, tahun: 2031, bulan: 1, targetUsd: 1 }],
    ['Buat tindakan Kaizen', '/api/circle/kaizen/tindakan', 'POST', { judul: 'x' }],
    ['Buat diskusi', '/api/circle/diskusi', 'POST', { studioId: S, judul: 'x', peserta: [koord.id] }],
    ['Atur aturan lembur', '/api/circle/lembur/aturan', 'PUT', { studioId: S, mode: 'TIDAK_DIBAYAR' }],
  ]) { r = await panggil(path, { method, body, token: pemilik.c }); cek(`Pemilik: ${label} → ditolak`, r.s === 403, String(r.s)) }
  cek('Order tidak berubah', (await prisma.orderProduksi.findUnique({ where: { id: orderId } })).judul === 'UJI-PM order')

  console.log('— data pribadi orang lain tetap tertutup —')
  for (const [label, path] of [['Alasan izin (kotak cuti)', `/api/circle/kehadiran/kotak-cuti?studioId=${S}`], ['Refleksi tim', `/api/circle/refleksi/tim?studioId=${S}`], ['Lembur per orang', `/api/circle/lembur/usulan?studioId=${S}&bulan=2031-01`], ['Profil SDM orang lain', `/api/circle/profil-sdm?userId=${kar.id}`], ['Riwayat login', '/api/circle/riwayat-login']]) {
    r = await panggil(path, { token: pemilik.c }); cek(`Pemilik tidak membuka: ${label}`, r.s === 403, String(r.s))
  }

  console.log('— unit lain & pemilik yang juga bekerja —')
  r = await panggil(`/api/circle/papan?studioId=${pibi.id}`, { token: pemilik.c }); cek('Pemilik membuka unit yang BUKAN miliknya → 403', r.s === 403)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: pemKar.c }); cek('Pemilik yang juga Karyawan: papan penuh (lihat) → 200', r.s === 200)
  r = await panggil('/api/circle/orders', { method: 'POST', token: pemKar.c, body: { studioId: S, judul: 'x', klien: 'x', akunId: 'INTERNAL' } }); cek('Pemilik yang juga Karyawan: tambah order → 403 (peran kerjanya Karyawan)', r.s === 403)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: kar.c }); cek('(kontrol) Karyawan biasa: papan penuh tetap → 403', r.s === 403)

  console.log('— pemilik yang juga MARKETER: tombol hanya yang boleh ia jalankan (laporan 9 Nov 2026) —')
  const pemMkt = await user('pm_mkt', [['KARYAWAN', S]])
  await prisma.studioPemilik.create({ data: { studioId: S, userId: pemMkt.id, persenSaham: 3 } })
  await prisma.fungsiAnggota.create({ data: { userId: pemMkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const akunI = await prisma.akunProduksi.findUnique({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } } })
  const oMilik = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunI.id, klien: 'KLIEN-UJI-PM', judul: 'UJI-PM milik pemilik-marketer', nilaiKotor: 1, nilaiBersih: 1, marketerId: pemMkt.id, tanggalMasuk: new Date() } })
  const oLain = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunI.id, klien: 'KLIEN-UJI-PM', judul: 'UJI-PM order orang lain', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } })
  ekstraOrder.push(oMilik.id, oLain.id)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: pemMkt.c })
  const pm1 = r.j.data?.orders?.find(x => x.id === oMilik.id), pm2 = r.j.data?.orders?.find(x => x.id === oLain.id)
  cek('Papan pemilik-marketer: terbatas, tanpa ubah koordinator, boleh tambah order', r.s === 200 && r.j.data.terbatas === true && r.j.data.bisaUbah === false && r.j.data.bisaTambah === true)
  cek('Order orang lain: TIDAK ada tombol tahap kerja (dulu muncul lalu ditolak)', pm2 && !pm2.aksi.some(a => a.aksi === 'lanjut'), JSON.stringify(pm2?.aksi))
  cek('Order miliknya tanpa talent internal: wakil + tombol "Mulai kerjakan"', pm1?.wakilFreelance === true && pm1.aksi.some(a => a.aksi === 'lanjut'))
  r = await panggil(`/api/circle/orders/${oMilik.id}/aksi`, { method: 'POST', token: pemMkt.c, body: { aksi: 'lanjut' } }); cek('Tombol yang tampil memang berhasil → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: pemilik.c }); cek('(kontrol) Pemilik murni: papan tanpa tombol aksi', r.s === 200 && r.j.data.terbatas === true && r.j.data.orders.every(x => x.aksi.length === 0) && r.j.data.bisaTambah === false)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  if (orderId) await prisma.orderProduksi.deleteMany({ where: { id: orderId } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: ekstraOrder } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.studioPemilik.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
