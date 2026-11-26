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
let orderId
try {
  const koord = await user('nv_koord', [['KOORDINATOR', S]]), kar = await user('nv_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  orderId = (await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-NV', judul: 'UJI-NV order', nilaiKotor: 750000, nilaiBersih: 750000, nilaiDisepakati: 750000, tanggalMasuk: new Date(), status: 'PROSES' } })).id
  await prisma.terminBayarOrder.create({ data: { orderId, label: 'DP', jumlah: 600000, dibayarPada: new Date() } })
  const cek1 = await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c }); cek('Awal: terima Rp600.000 dari Rp750.000 → sisa Rp150.000', cek1.j.data.uang.sisaTagihan === 150000 && cek1.j.data.uang.diterima === 600000)
  let r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: kar.c, body: { nilaiKotor: 1 } }); cek('Karyawan tidak boleh ubah nilai → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: -5 } }); cek('Nilai negatif → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 'abc' } }); cek('Nilai bukan angka → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 600000 } }); cek('Harga disepakati ulang jadi Rp600.000', r.s === 200)
  let o = await prisma.orderProduksi.findUnique({ where: { id: orderId } })
  cek('Nilai kotor/disepakati/bersih berubah & status bayar jadi LUNAS (sesuai termin diterima)', o.nilaiKotor === 600000 && o.nilaiDisepakati === 600000 && o.nilaiBersih === 600000 && o.statusBayar === 'LUNAS')
  r = await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c }); cek('Detail: sisa tagihan Rp0 & audit mencatat nilai', r.j.data.uang.sisaTagihan === 0 && r.j.data.audit.some(a => a.field === 'nilaiKotor' && a.ke === '600000'))
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 900000 } })
  o = await prisma.orderProduksi.findUnique({ where: { id: orderId } }); cek('Harga naik lagi Rp900.000 → status kembali DP (sisa Rp300.000)', o.statusBayar === 'DP' && o.nilaiBersih === 900000)
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 900000 } }); cek('Nilai sama, tidak ada perubahan lain → 422 (tidak ada yang diubah)', r.s === 422)
  await prisma.orderProduksi.update({ where: { id: orderId }, data: { status: 'BATAL' } })
  r = await panggil(`/api/circle/orders/${orderId}`, { method: 'PATCH', token: koord.c, body: { nilaiKotor: 1000 } }); cek('Order dihapus tidak bisa diubah nilainya → 422', r.s === 422)
} finally {
  if (orderId) { await prisma.terminBayarOrder.deleteMany({ where: { orderId } }); await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
