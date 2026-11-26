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
  const koord = await user('tm_koord', [['KOORDINATOR', S]]), kar = await user('tm_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  orderId = (await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-TM', judul: 'UJI-TM order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } })).id
  let r = await panggil(`/api/circle/orders/${orderId}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: 'Zefan UJI' } }); cek('Tambah freelance', r.s === 201)
  r = await panggil(`/api/circle/orders/${orderId}/tim`, { method: 'POST', token: koord.c, body: { userId: kar.id } }); cek('Tugaskan anggota', r.s === 201)
  let d = (await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c })).j.data
  const fl = d.timFee.find(x => x.nama === 'Zefan UJI'), ag = d.timFee.find(x => x.nama === 'Uji tm_kar')
  cek('Koordinator melihat daftar tim + fee kosong', !!fl && !!ag && fl.feeTalent == null)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'PATCH', token: koord.c, body: { feeTalent: 150000 } }); cek('Isi fee freelance Rp150.000', r.s === 200)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${ag.id}`, { method: 'PATCH', token: koord.c, body: { feeTalent: 80000 } }); cek('Isi fee anggota Rp80.000', r.s === 200)
  d = (await panggil(`/api/circle/orders/${orderId}/detail`, { token: koord.c })).j.data
  cek('Fee tersimpan di detail', d.timFee.find(x => x.id === fl.id).feeTalent === 150000 && d.timFee.find(x => x.id === ag.id).feeTalent === 80000)
  cek('Audit mencatat perubahan fee', d.audit.some(a => String(a.field).includes('feeTalent') && a.ke === '150000'))
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'PATCH', token: koord.c, body: { feeTalent: -5 } }); cek('Fee negatif → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'PATCH', token: koord.c, body: { feeTalent: 'abc' } }); cek('Fee bukan angka → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'PATCH', token: kar.c, body: { feeTalent: 1 } }); cek('Karyawan tidak boleh ubah fee → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'PATCH', token: koord.c, body: { feeTalent: null } }); cek('Fee dikosongkan → null', r.s === 200 && (await prisma.assignmentProduksi.findUnique({ where: { id: fl.id } })).feeTalent === null)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'DELETE', token: kar.c }); cek('Karyawan tidak boleh hapus anggota tim → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${orderId}/tim/${fl.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus freelance dari tim', r.s === 200 && !(await prisma.assignmentProduksi.findUnique({ where: { id: fl.id } })))
  r = await panggil(`/api/circle/orders/${orderId}/tim/${ag.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus anggota dari tim', r.s === 200)
} finally {
  if (orderId) { await prisma.penugasanTahap.deleteMany({ where: { orderId } }); await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.assignmentProduksi.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('order sisa:', e.message.slice(0, 90))) }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
