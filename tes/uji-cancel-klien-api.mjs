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
  const koord = await user('cx_koord', [['KOORDINATOR', S]]), kar = await user('cx_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const buat = async (judul, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-CX', judul, nilaiKotor: 500000, nilaiBersih: 500000, nilaiDisepakati: 500000, tanggalMasuk: new Date(), status: 'PROSES', ...extra } }); ids.push(o.id); return o }
  const o1 = await buat('UJI-CX satu'), o2 = await buat('UJI-CX dua', { status: 'SELESAI' })
  await panggil(`/api/circle/orders/${o1.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: 'Frel UJI' } })
  let r = await panggil(`/api/circle/orders/${o1.id}/cancel-klien`, { method: 'POST', token: kar.c, body: { alasan: 'x' } }); cek('Karyawan tidak boleh Cancel → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${o1.id}/cancel-klien`, { method: 'POST', token: koord.c, body: {} }); cek('Tanpa alasan → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o1.id}/cancel-klien`, { method: 'POST', token: koord.c, body: { alasan: 'klien batal', nilaiRiil: -1 } }); cek('Nilai riil negatif → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o2.id}/cancel-klien`, { method: 'POST', token: koord.c, body: { alasan: 'klien batal' } }); cek('Order sudah Selesai tidak bisa di-Cancel → 409', r.s === 409)
  r = await panggil(`/api/circle/orders/${o1.id}/cancel-klien`, { method: 'POST', token: koord.c, body: { alasan: 'klien batal di tengah jalan', nilaiRiil: 200000 } }); cek('Cancel klien dengan nilai riil Rp200.000', r.s === 200)
  const o = await prisma.orderProduksi.findUnique({ where: { id: o1.id } })
  cek('Status SELESAI + ditandai Cancel + nilai riil + tanggal selesai terisi', o.status === 'SELESAI' && o.cancelKlien && o.alasanCancel.includes('tengah jalan') && o.nilaiKotor === 200000 && o.nilaiBersih === 200000 && !!o.tanggalSelesai)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const k = r.j.data?.orders?.find(x => x.id === o1.id)
  cek('Papan memuat kartu dengan cancelKlien=true', r.s === 200 && k?.cancelKlien === true)
  r = await panggil(`/api/circle/orders/${o1.id}/detail`, { token: koord.c }); cek('Detail memuat alasan cancel + audit CANCEL', r.j.data.cancelKlien && r.j.data.alasanCancel.includes('tengah jalan') && r.j.data.audit.some(a => a.aksi === 'CANCEL'))
  r = await panggil(`/api/circle/orders/${o1.id}/cancel-klien`, { method: 'POST', token: koord.c, body: { alasan: 'lagi' } }); cek('Cancel dua kali → 409', r.s === 409)
  // buka kembali dari Selesai → tanda Cancel lepas
  const tahap = await prisma.tahapAlur?.findMany?.({ where: { studioId: S } }).catch(() => null)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const kerja = r.j.data.tahap.find(t => t.jenis === 'KERJA')
  r = await panggil(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: kerja.id } }); cek('Dibuka kembali ke tahap kerja', r.s === 200)
  const o3 = await prisma.orderProduksi.findUnique({ where: { id: o1.id } })
  cek('Tanda Cancel dilepas saat dibuka kembali', !o3.cancelKlien && o3.alasanCancel === null && o3.status === 'PROSES')
} finally {
  for (const id of ids) { await prisma.penugasanTahap.deleteMany({ where: { orderId: id } }); await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: id } }); await prisma.auditOrder.deleteMany({ where: { orderId: id } }); await prisma.assignmentProduksi.deleteMany({ where: { orderId: id } }); await prisma.orderProduksi.delete({ where: { id } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
