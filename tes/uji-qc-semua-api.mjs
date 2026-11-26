import { DASH } from './_jalur.mjs'
// Uji pengaturan unit "Hasil talent selalu dicek admin (QC) dulu" (12 Nov 2026, masukan tim): hanya Koordinator/admin yang mengatur;
// ditolak bila alur belum punya QC; bila aktif, talent yang menandai "Revisi klien" selesai → kartu masuk QC (bukan langsung Preview), lalu
// admin "QC lolos" → kembali ke Preview. Memakai Keiko lokal: langkah "QC: Pengerjaan" ditambahkan SEMENTARA (urutan dipulihkan). Data dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.45.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-qc-' + T, 4)
const dibuat = [], orderIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
const urutanAsli = (await pastikanTahap(S)).map(t => ({ id: t.id, urutan: t.urutan }))
const aturAsli = await prisma.pengaturanPenugasan.findUnique({ where: { studioId: S } })
let qcId = null
try {
  const koord = await user('qc_koord', [['KOORDINATOR', S]]), tal = await user('qc_tal', [['KARYAWAN', S]])
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const tahap0 = await pastikanTahap(S)
  const adaQc = tahap0.some(t => t.jenis === 'QC')
  if (!adaQc) {
    let r = await K('/api/circle/templat/qc-semua', { method: 'PUT', body: { studioId: S, aktif: true } }); cek('Alur tanpa langkah QC → 422 (minta tambah gerbang QC dulu)', r.s === 422, `${r.s} ${r.j.message ?? ''}`)
    // tambah sementara QC: Pengerjaan sesudah Pengerjaan
    const kerja = tahap0.find(t => t.jenis === 'KERJA')
    for (const t of [...tahap0].filter(t => t.urutan > kerja.urutan).sort((a, b) => b.urutan - a.urutan)) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan + 1 } })
    qcId = (await prisma.tahapProduksi.create({ data: { studioId: S, nama: `QC: ${kerja.nama}`, jenis: 'QC', indukId: kerja.id, urutan: kerja.urutan + 1 } })).id
  }
  let r = await panggil('/api/circle/templat/qc-semua', { method: 'PUT', token: tal.t, body: { studioId: S, aktif: true } }); cek('Talent mengatur → 403', r.s === 403, String(r.s))
  r = await K('/api/circle/templat/qc-semua', { method: 'PUT', body: { studioId: S, aktif: true } }); cek('Koordinator menyalakan → 200', r.s === 200 && r.j.data?.qcSemua === true, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/templat?studioId=${S}`); cek('Templat menampilkan qcSemua: true', r.j.data?.qcSemua === true)

  const tahap = await pastikanTahap(S)
  const revisi = tahap.find(t => t.jenis === 'REVISI_KLIEN' || t.jenis === 'REVISI'), preview = tahap.find(t => t.jenis === 'PREVIEW_KLIEN' || t.jenis === 'PREVIEW'), qc = tahap.find(t => t.jenis === 'QC')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-QC klien', judul: `UJI-QC ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId: revisi.id, status: 'PROSES', tanggalMasuk: new Date() } }); orderIds.push(o.id)
  await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } })
  await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: preview.nama, jenis: 'PREVIEW_KLIEN', userId: koord.id, namaPengguna: 'x', mulai: new Date(Date.now() - 3600000), selesai: new Date(Date.now() - 1800000) } })
  await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: revisi.nama, jenis: 'REVISI_KLIEN', userId: koord.id, namaPengguna: 'x', mulai: new Date(Date.now() - 1800000) } })
  r = await panggil(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', token: tal.t, body: { aksi: 'lanjut' } })
  let skr = await prisma.orderProduksi.findUnique({ where: { id: o.id }, select: { tahapId: true } })
  cek('Talent menandai Revisi klien selesai → kartu masuk QC (bukan langsung Preview)', r.s === 200 && skr.tahapId === qc.id, `${r.s} ${r.j.message ?? ''}`)
  r = await panggil(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', token: tal.t, body: { aksi: 'lanjut' } }); cek('Talent tidak bisa meloloskan QC sendiri', r.s !== 200, String(r.s))
  r = await K(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } })
  skr = await prisma.orderProduksi.findUnique({ where: { id: o.id }, select: { tahapId: true } })
  cek('Koordinator "QC lolos" → kembali ke Preview klien', r.s === 200 && skr.tahapId === preview.id, `${r.s} ${r.j.message ?? ''}`)
  r = await K('/api/circle/templat/qc-semua', { method: 'PUT', body: { studioId: S, aktif: false } }); cek('Dimatikan lagi → 200', r.s === 200 && r.j.data?.qcSemua === false)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  if (qcId) await prisma.tahapProduksi.delete({ where: { id: qcId } }).catch(() => {})
  for (const t of urutanAsli) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan } }).catch(() => {})
  if (aturAsli) await prisma.pengaturanPenugasan.update({ where: { studioId: S }, data: { qcSemua: aturAsli.qcSemua } }); else await prisma.pengaturanPenugasan.deleteMany({ where: { studioId: S } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
