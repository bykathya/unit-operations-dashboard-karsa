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
let ids = []
try {
  const mkt = await user('mh_mkt', [['KADER', S]]), lain = await user('mh_lain', [['KADER', S]])
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER' } }); await prisma.fungsiAnggota.create({ data: { userId: lain.id, studioId: S, fungsi: 'MARKETER' } })
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'UJI-MH akun' } }, update: {}, create: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-MH akun', feePersen: 0.2 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-MH', judul: 'UJI-MH order', nilaiKotor: 50000, nilaiBersih: 40000, nilaiDisepakati: 50000, tanggalMasuk: new Date(), status: 'PROSES', marketerId: mkt.id } }); ids.push(o.id)
  let r = await panggil(`/api/circle/orders/${o.id}/detail`, { token: mkt.c }); cek('Marketer pemegang: detail memuat nilai & boleh ubah', r.s === 200 && r.j.data.bisaUbahOrder === true && r.j.data.uang?.nilaiKotor === 50000)
  r = await panggil(`/api/circle/orders/${o.id}`, { method: 'PATCH', token: mkt.c, body: { judul: 'UJI-MH order revisi' } }); cek('Marketer pemegang ubah judul', r.s === 200)
  r = await panggil(`/api/circle/orders/${o.id}`, { method: 'PATCH', token: mkt.c, body: { nilaiKotor: 75000 } }); const x = await prisma.orderProduksi.findUnique({ where: { id: o.id } })
  cek('Marketer pemegang ganti harga (Rp75.000 → bersih Rp60.000)', r.s === 200 && x.nilaiKotor === 75000 && x.nilaiBersih === 60000)
  r = await panggil(`/api/circle/orders/${o.id}`, { method: 'PATCH', token: lain.c, body: { nilaiKotor: 1 } }); cek('Marketer lain (bukan pemegang) tidak boleh → 403', r.s === 403)
} finally {
  for (const id of ids) { await prisma.auditOrder.deleteMany({ where: { orderId: id } }); await prisma.orderProduksi.delete({ where: { id } }).catch(() => {}) }
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: 'KLIEN-UJI-MH' } }); await prisma.akunProduksi.deleteMany({ where: { studioId: S, namaAkun: 'UJI-MH akun' } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
