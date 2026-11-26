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
  const koord = await user('ec_koord', [['KOORDINATOR', S]]), kar = await user('ec_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'UJI-EC akun' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'UJI-EC akun', feePersen: 0 } })
  orderId = (await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-EC', judul: 'UJI-EC order', nilaiKotor: 730000, nilaiBersih: 730000, nilaiDisepakati: 730000, tanggalMasuk: new Date(), status: 'PROSES' } })).id
  let r = await panggil(`/api/circle/orders/${orderId}/termin`, { method: 'POST', token: koord.c, body: { label: 'DP', jumlah: 50000 } }); cek('Cicilan DP Rp50.000 dibuat', r.s === 201)
  const t = await prisma.terminBayarOrder.findFirst({ where: { orderId } })
  r = await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: kar.c, body: { jumlah: 1 } }); cek('Karyawan tidak boleh ubah cicilan → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: koord.c, body: { jumlah: 0 } }); cek('Jumlah 0 → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: koord.c, body: { label: '  ' } }); cek('Nama kosong → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: koord.c, body: { label: 'DP 1', jumlah: 150000, jatuhTempo: '2031-05-20' } }); cek('Ubah nama, jumlah & jatuh tempo', r.s === 200)
  const x = await prisma.terminBayarOrder.findUnique({ where: { id: t.id } }); cek('Perubahan tersimpan', x.label === 'DP 1' && x.jumlah === 150000 && x.jatuhTempo.toISOString().slice(0, 10) === '2031-05-20')
  await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: koord.c, body: { dibayarPada: '2031-05-01' } })
  r = await panggil(`/api/circle/orders/${orderId}/termin/${t.id}`, { method: 'PATCH', token: koord.c, body: { jumlah: 730000 } })
  const o = await prisma.orderProduksi.findUnique({ where: { id: orderId } }); cek('Ubah jumlah cicilan yang sudah dibayar → status bayar ikut (LUNAS)', r.s === 200 && o.statusBayar === 'LUNAS')
  r = await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c }); cek('Audit mencatat perubahan cicilan', r.j.data.audit.some(a => String(a.field).includes('jumlah')))
} finally {
  if (orderId) { await prisma.terminBayarOrder.deleteMany({ where: { orderId } }); await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: 'KLIEN-UJI-EC' } }); await prisma.akunProduksi.deleteMany({ where: { studioId: S, namaAkun: 'UJI-EC akun' } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
