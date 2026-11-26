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
let stu, ids = []
try {
  stu = await prisma.studio.create({ data: { nama: 'UJI-TPL studio', tipe: 'STUDIO', circleId: keiko.circleId } })
  const S = stu.id
  const koord = await user('tp_koord', [['KOORDINATOR', S]]), kar = await user('tp_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  let r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); cek('Papan terbuka, templat bawaan "sederhana" terbentuk', r.s === 200 && r.j.data.tahap.length > 0)
  const t0 = r.j.data.tahap; const kerja0 = t0.find(t => t.jenis === 'KERJA')
  const buat = async (judul, tahapId, status, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-TPL', judul, nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), tahapId, subStatus: t0.find(t => t.id === tahapId)?.nama, status, ...extra } }); ids.push(o.id); return o }
  const inbox0 = t0.find(t => t.jenis === 'MASUK'), selesai0 = t0.find(t => t.jenis === 'SELESAI')
  const oMasuk = await buat('UJI-TPL masuk', inbox0.id, 'MASUK'), oKerja = await buat('UJI-TPL kerja', kerja0.id, 'PROSES'), oDone = await buat('UJI-TPL done', selesai0.id, 'SELESAI', { tanggalSelesai: new Date() }), oBatal = await buat('UJI-TPL batal', kerja0.id, 'BATAL')
  await prisma.riwayatTahapOrder.create({ data: { orderId: oKerja.id, namaTahap: kerja0.nama, jenis: 'KERJA', mulai: new Date() } })
  await prisma.assignmentProduksi.create({ data: { orderId: oKerja.id, userId: kar.id } })
  r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: 'ilustrasi' } }); cek('Ganti templat tanpa persetujuan saat ada order → 409', r.s === 409)
  r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: kar.c, body: { preset: 'ilustrasi', pindahkanOrder: true } }); cek('Karyawan tidak boleh ganti templat → 403', r.s === 403)
  r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: 'ngawur', pindahkanOrder: true } }); cek('Preset tak dikenal → 422', r.s === 422)
  r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: 'ilustrasi', pindahkanOrder: true } }); cek('Ganti ke "ilustrasi" dengan memindahkan order', r.s === 200 && r.j.data.orderDipindah === 4, JSON.stringify(r.j).slice(0, 120))
  const baru = await prisma.tahapProduksi.findMany({ where: { studioId: S }, orderBy: { urutan: 'asc' } })
  cek('Templat baru terpasang, langkah lama hilang', baru.some(t => t.nama.includes('Sketch')) && !baru.some(t => t.nama.startsWith('__lama_')))
  const a = await prisma.orderProduksi.findMany({ where: { id: { in: ids } }, include: { tahap: true } }); const dari = (id) => a.find(x => x.id === id)
  cek('Order masuk → Inbox baru (status MASUK)', dari(oMasuk.id).tahap?.jenis === 'MASUK' && dari(oMasuk.id).status === 'MASUK')
  cek('Order kerja → langkah pengerjaan pertama (status PROSES, subStatus ikut nama baru)', dari(oKerja.id).tahap?.jenis === 'KERJA' && dari(oKerja.id).status === 'PROSES' && dari(oKerja.id).subStatus === dari(oKerja.id).tahap.nama)
  cek('Order selesai tetap Selesai (tanggal selesai utuh)', dari(oDone.id).tahap?.jenis === 'SELESAI' && dari(oDone.id).status === 'SELESAI' && !!dari(oDone.id).tanggalSelesai)
  cek('Order yang dihapus tetap BATAL', dari(oBatal.id).status === 'BATAL')
  const rw = await prisma.riwayatTahapOrder.findMany({ where: { orderId: oKerja.id }, orderBy: { mulai: 'asc' } })
  cek('Riwayat: tahap lama ditutup, entri tahap baru terbuka', rw.length === 2 && rw[0].selesai && !rw[1].selesai && rw[1].namaTahap === dari(oKerja.id).tahap.nama)
  const pt = await prisma.penugasanTahap.findMany({ where: { orderId: oKerja.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
  cek('Anggota tim mendapat tugas di langkah pengerjaan baru', pt.length === 1 && pt[0].userId === kar.id && pt[0].tahapId === dari(oKerja.id).tahapId)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); cek('Papan baru terbuka & memuat order di kolomnya', r.s === 200 && r.j.data.orders.length === 3 && r.j.data.orders.every(o => r.j.data.tahap.some(t => t.id === o.tahapId)))
  // ganti lagi ke templat 3d
  r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: '3d', pindahkanOrder: true } }); cek('Ganti lagi ke "3d" (mengubah pikiran) juga bisa', r.s === 200)
  const k2 = await prisma.orderProduksi.findUnique({ where: { id: oKerja.id }, include: { tahap: true } }); cek('Order tetap utuh di templat 3d', k2.tahap?.jenis === 'KERJA' && k2.status === 'PROSES')
} finally {
  if (stu) {
    const S = stu.id
    await prisma.penugasanTahap.deleteMany({ where: { order: { studioId: S } } }); await prisma.riwayatTahapOrder.deleteMany({ where: { order: { studioId: S } } }); await prisma.auditOrder.deleteMany({ where: { order: { studioId: S } } }); await prisma.assignmentProduksi.deleteMany({ where: { order: { studioId: S } } })
    await prisma.orderProduksi.deleteMany({ where: { studioId: S } }); await prisma.klienProduksi.deleteMany({ where: { studioId: S } }); await prisma.akunProduksi.deleteMany({ where: { studioId: S } }); await prisma.tahapProduksi.deleteMany({ where: { studioId: S } })
    for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
    await prisma.studio.delete({ where: { id: S } }).catch(e => console.log('studio sisa:', e.message.slice(0, 120)))
  }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
