import { DASH } from './_jalur.mjs'
// Uji ATURAN LEMBUR PER UNIT (21 Okt 2026): perhitungan murni (utils/lembur.js) + alur API (koordinator mengatur, lembur manual menunggu
// persetujuan, Payroll hanya mengklaim lembur DISETUJUI milik unitnya, dihitung dengan aturan unit). Data sementara dihapus di akhir.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.37.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }

let xff = 0
const S = keiko.id
let orderId, wdId, bulanUji
try {
  const koord = await user('um_koord', [['KOORDINATOR', S]]), kar = await user('um_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'UJI-UM etsy' } }, update: {}, create: { studioId: S, platform: 'Etsy', namaAkun: 'UJI-UM etsy', feePersen: 0.2 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-UM', judul: 'UJI-UM order', nilaiDisepakati: 100000, nilaiKotor: 100000, nilaiBersih: 80000, tanggalMasuk: new Date(), status: 'PROSES' } }); orderId = o.id
  bulanUji = new Date().toISOString().slice(0, 7)
  await prisma.terminBayarOrder.create({ data: { orderId, label: 'Pelunasan', jumlah: 75000, dibayarPada: new Date() } })
  let r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 100000, uangMasukRiil: undefined } })
  await prisma.orderProduksi.update({ where: { id: orderId }, data: { statusBayar: 'BELUM_LUNAS' } })
  r = await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c }); cek('Awal: terima Rp75.000 dari perkiraan Rp80.000 → sisa Rp5.000', r.j.data.uang.sisaTagihan === 5000 && r.j.data.uang.uangMasukRiil == null)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: kar.c, body: { uangMasukRiil: 1 } }); cek('Karyawan tidak boleh isi uang masuk → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: -1 } }); cek('Uang masuk negatif → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: 'abc' } }); cek('Uang masuk bukan angka → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: 75000 } }); cek('Isi uang masuk sebenarnya Rp75.000', r.s === 200)
  let x = await prisma.orderProduksi.findUnique({ where: { id: orderId } }); cek('Status jadi LUNAS mengikuti uang nyata; perkiraan nilaiBersih tidak berubah', x.statusBayar === 'LUNAS' && x.uangMasukRiil === 75000 && x.nilaiBersih === 80000)
  r = await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c }); cek('Detail: sisa Rp0, audit mencatat perubahan', r.j.data.uang.sisaTagihan === 0 && r.j.data.audit.some(a => a.field === 'uangMasukRiil' && a.ke === '75000'))
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: null } }); x = await prisma.orderProduksi.findUnique({ where: { id: orderId } })
  cek('"Pakai perkiraan lagi" → kembali DP (sisa Rp5.000)', x.uangMasukRiil === null && x.statusBayar === 'DP')
  await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: 75000 } })
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 200000 } }); x = await prisma.orderProduksi.findUnique({ where: { id: orderId } })
  cek('Harga order diubah → koreksi uang masuk lama dilepas (nilai bersih Rp160.000)', x.uangMasukRiil === null && x.nilaiBersih === 160000)
  // pembanding di tab Pendapatan
  await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 100000 } })
  await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { uangMasukRiil: 75000 } })
  const awal = await panggil(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${bulanUji}`, { token: koord.c }); const w0 = awal.j.data.ringkasan
  cek('Pendapatan: omzet bersih order memakai uang masuk sebenarnya (Rp75.000 termasuk)', awal.s === 200 && w0.omzetBersihOrder >= 75000, JSON.stringify(w0).slice(0, 160))
  r = await panggil(`/api/circle/kas/penarikan`, { method: 'POST', token: koord.c, body: { studioId: S, tanggal: new Date().toISOString().slice(0, 10), jumlah: 50000, dariPlatform: 'etsy', bankTujuan: 'BCA', atasNama: 'UJI-UM' } }); wdId = r.j.data?.id
  const sesudah = await panggil(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${bulanUji}`, { token: koord.c }); const w1 = sesudah.j.data.ringkasan
  cek('Selisih = omzet − WD − tertahan (WD Rp50.000 mengurangi selisih Rp50.000)', w1.ditarik - w0.ditarik === 50000 && w0.selisih - w1.selisih === 50000)
  r = await panggil(`/api/circle/kas/pendapatan?studioId=${S}`, { token: koord.c }); cek('Tanpa bulan: pembanding tidak dihitung (null)', r.s === 200 && r.j.data.ringkasan.omzetBersihOrder === null)
} finally {
  if (wdId) await prisma.penarikanPendapatan.delete({ where: { id: wdId } }).catch(() => {})
  await prisma.penarikanPendapatan.deleteMany({ where: { studioId: S, atasNama: 'UJI-UM' } })
  if (orderId) { await prisma.terminBayarOrder.deleteMany({ where: { orderId } }); await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'KLIEN-UJI-UM' } } })
  await prisma.akunProduksi.deleteMany({ where: { studioId: S, namaAkun: 'UJI-UM etsy' } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
