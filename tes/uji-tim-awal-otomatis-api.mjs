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
  const koord = await user('ta_koord', [['KOORDINATOR', S]]), kar = await user('ta_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  let r = await panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, body: { studioId: S, judul: 'UJI-TA', klien: 'KLIEN-UJI-TA', tipeKlien: 'EKSTERNAL', nilaiDisepakati: 100000, talentUserId: kar.id, akunId: akun.id } })
  orderId = r.j.data?.id; cek('Order dibuat dengan talent anggota dari form', r.s === 201 && !!orderId, JSON.stringify(r.j).slice(0, 150))
  cek('Belum ada baris penugasan tahap saat masih di Inbox', (await prisma.penugasanTahap.count({ where: { orderId } })) === 0)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const kerja = r.j.data.tahap.find(t => t.jenis === 'KERJA')
  r = await panggil(`/api/circle/orders/${orderId}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: kerja.id } }); cek('Dipindah ke tahap kerja', r.s === 200)
  const p = await prisma.penugasanTahap.findMany({ where: { orderId } })
  cek('Anggota dari form otomatis dapat tugas di tahap kerja', p.length === 1 && p[0].userId === kar.id && ['MENUNGGU', 'DIKERJAKAN'].includes(p[0].status), JSON.stringify(p.map(x => [x.userId === kar.id, x.status])))
} finally {
  if (orderId) { await prisma.penugasanTahap.deleteMany({ where: { orderId } }); await prisma.riwayatTahapOrder.deleteMany({ where: { orderId } }); await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.assignmentProduksi.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
