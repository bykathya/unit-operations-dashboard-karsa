import { DASH } from './_jalur.mjs'
// Uji (12 Nov 2026, laporan tim): order dipindah ke HOLD → penugasan tahap kerja DITUTUP (bukan SELESAI, tidak masuk Tugas selesai);
// dilanjutkan → penugasan dibuat lagi; maju ke tahap berikut (bukan Hold) → tetap SELESAI seperti biasa. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { sinkronPenugasanTahap } = await import(DASH + '/server/src/utils/penugasanDb.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const tahap = await prisma.tahapProduksi.findMany({ where: { studioId: S } })
const kerja = tahap.find(t => t.jenis === 'KERJA'), hold = tahap.find(t => t.jenis === 'HOLD'), lain = tahap.find(t => ['QC', 'PREVIEW_KLIEN', 'DELIVERY'].includes(t.jenis))
const akun = await prisma.akunProduksi.findFirst({ where: { studioId: S } })
const u = await prisma.user.create({ data: { nama: 'Uji hold', email: `uji.hold.${Date.now()}@uji.local`, passwordHash: 'x', statusAktif: true } })
let o
try {
  if (!kerja || !hold || !lain) throw new Error('Templat Keiko tidak punya tahap KERJA/HOLD/lanjutan')
  o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-HOLD', judul: 'UJI-HOLD order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), tahapId: kerja.id } })
  await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: u.id } })
  const p = 'Uji hold', baris = () => prisma.penugasanTahap.findMany({ where: { orderId: o.id }, orderBy: { id: 'asc' } })
  await sinkronPenugasanTahap({ order: o, tujuan: kerja, pengguna: p })
  let b = await baris(); cek('Masuk tahap kerja → 1 penugasan aktif', b.length === 1 && ['MENUNGGU', 'DIKERJAKAN'].includes(b[0].status))
  await sinkronPenugasanTahap({ order: o, tujuan: hold, pengguna: p })
  b = await baris(); cek('Dipindah ke Hold → DITUTUP, bukan SELESAI (tidak masuk Tugas selesai)', b[0].status === 'DITUTUP' && !b[0].selesaiPada, b[0].status)
  await sinkronPenugasanTahap({ order: o, tujuan: kerja, pengguna: p })
  b = await baris(); cek('Dilanjutkan → penugasan baru aktif lagi', b.length === 2 && ['MENUNGGU', 'DIKERJAKAN'].includes(b[1].status))
  await sinkronPenugasanTahap({ order: o, tujuan: lain, pengguna: p })
  b = await baris(); cek(`Maju ke ${lain.nama} → penugasan kerja SELESAI seperti biasa`, b[1].status === 'SELESAI' && !!b[1].selesaiPada, b[1].status)
} finally {
  if (o) { await prisma.penugasanTahap.deleteMany({ where: { orderId: o.id } }); await prisma.orderProduksi.delete({ where: { id: o.id } }) }
  await prisma.user.delete({ where: { id: u.id } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
