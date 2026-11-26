import { DASH } from './_jalur.mjs'
// Uji LAPORAN HARIAN MARKET OTOMATIS KE TOPIK GRUP (12 Nov 2026): teks (order masuk + nilai, deliver, complete, aktivitas per marketer, HTML aman),
// unit tanpa kegiatan & tanpa marketer dilewati; pengumpul data membaca order/riwayat/aktivitas HARI ITU (WIB) per unit; mati bila
// TELEGRAM_GRUP_ORDER kosong; terkirim lewat antrean grup (fetch Telegram DIGANTI penangkap — tanpa pesan sungguhan). Keiko lokal, bulan uji.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { pesanLaporanHarian, susunLaporanSemuaUnit, kirimLaporanHarianGrup } = await import(DASH + '/server/src/utils/laporanGrup.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const terkirim = []
globalThis.fetch = async (url, opsi) => { terkirim.push(JSON.parse(opsi.body)); return { ok: true, text: async () => '' } }
const HARI = '2031-08-13' // hari uji (Rabu) — jauh dari data nyata
const T = Date.now(), orderIds = [], dibuat = [], aktIds = []
try {
  const t = pesanLaporanHarian({ unit: 'Keiko', lingkup: 'Bloom Circle', hari: '2026-11-12', masuk: [{ klien: 'alberto_tog', judul: 'Marin', nilai: 1500000 }, { klien: 'b<x>', judul: 'Emote', nilai: 500000 }], deliver: [{ klien: 'cumi', judul: 'Figur' }], complete: [], marketer: [{ nama: 'Marketer A', aktivitas: [{ label: 'Post', jumlah: 3 }, { label: 'Reply', jumlah: 5 }], belumSelesai: 1 }, { nama: 'Anggota A', aktivitas: [], belumSelesai: 0 }] })
  cek('Teks: judul, unit · circle, tanggal panjang', t.startsWith('📋 <b>Laporan Harian Market</b>') && t.includes('🏢 Keiko · Bloom Circle') && t.includes('📅 Kamis, 12 Nov 2026'), t)
  cek('Teks: order masuk (jumlah · total Rp) + daftar, deliver, tanpa bagian Complete kosong', t.includes('🛒 <b>Order masuk</b> (2 · Rp 2.000.000)') && t.includes('1. alberto_tog — Marin (Rp 1.500.000)') && t.includes('2. b&lt;x&gt; — Emote') && t.includes('📦 <b>Deliver</b>') && !t.includes('Complete'), t)
  cek('Teks: aktivitas per marketer (urut terbanyak), yang kosong ditandai, belum selesai', t.indexOf('👤 Marketer A · 8: 3 Post, 5 Reply · ⚠ 1 belum selesai') > 0 && t.indexOf('👤 Anggota A · 0 (belum ada aktivitas)') > t.indexOf('Marketer A'), t)
  cek('Unit tanpa kegiatan & tanpa marketer → tidak dikirim', pesanLaporanHarian({ unit: 'X', hari: HARI, masuk: [], deliver: [], complete: [], marketer: [] }) === null)
  const sepi = pesanLaporanHarian({ unit: 'X', hari: HARI, masuk: [], deliver: [], complete: [], marketer: [{ nama: 'A', aktivitas: [], belumSelesai: 0 }] })
  cek('Unit punya marketer tapi sepi → tetap dikirim dengan keterangan', !!sepi && sepi.includes('Tidak ada order & aktivitas tercatat hari ini'), sepi)

  // data nyata lokal: Keiko, hari uji
  const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const jam = (h) => new Date(`${HARI}T${h}:00+07:00`)
  const ord = async (judul, data) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-LG klien', judul: `${judul} ${T}`, nilaiKotor: 300000, nilaiBersih: 300000, status: 'MASUK', ...data } }); orderIds.push(o.id); return o }
  await ord('UJI-LG masuk pagi', { tanggalMasuk: jam('00:30') }) // 00:30 WIB = masih hari uji
  await ord('UJI-LG masuk kemarin', { tanggalMasuk: jam('00:30').getTime ? new Date(jam('00:30').getTime() - 3600000) : null }) // 23:30 WIB hari sebelumnya
  const od = await ord('UJI-LG deliver', { tanggalMasuk: new Date('2031-08-01T10:00:00+07:00'), status: 'PROSES' })
  await prisma.riwayatTahapOrder.create({ data: { orderId: od.id, namaTahap: 'Delivery', jenis: 'DELIVERY', mulai: jam('15:00') } })
  await ord('UJI-LG selesai', { tanggalMasuk: new Date('2031-08-01T10:00:00+07:00'), status: 'SELESAI', tanggalSelesai: jam('16:00') })
  const u = await prisma.user.create({ data: { nama: 'Uji LG Marketer', email: `uji.lg.${T}@uji.local`, passwordHash: 'x', statusAktif: true } }); dibuat.push(u.id)
  await prisma.userRole.create({ data: { userId: u.id, roleType: 'KARYAWAN', studioId: S } })
  await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  aktIds.push((await prisma.aktivitasMarketer.create({ data: { userId: u.id, studioId: S, tanggal: new Date(HARI + 'T00:00:00.000Z'), jenis: 'publish_post', jumlah: 2, selesai: true } })).id)

  const semua = await susunLaporanSemuaUnit(HARI), k = semua.find(x => x.studioId === S)?.teks ?? ''
  cek('Pengumpul: Keiko punya laporan hari uji', !!k)
  cek('Pengumpul: order masuk hanya hari itu (WIB), bukan kemarin', k.includes(`UJI-LG masuk pagi ${T}`) && !k.includes(`UJI-LG masuk kemarin ${T}`), k)
  cek('Pengumpul: deliver & complete hari itu', k.includes(`UJI-LG deliver ${T}`) && k.includes('✅ <b>Complete</b>') && k.includes(`UJI-LG selesai ${T}`), k)
  cek('Pengumpul: aktivitas marketer dari menu Marketing', k.includes('👤 Uji LG Marketer · 2: 2 Post'), k)

  const lama = process.env.TELEGRAM_GRUP_ORDER, topikLama = process.env.TELEGRAM_TOPIK_ORDER
  delete process.env.TELEGRAM_GRUP_ORDER
  cek('TELEGRAM_GRUP_ORDER kosong → tidak mengirim', (await kirimLaporanHarianGrup(HARI)).terkirim === 0 && terkirim.length === 0)
  process.env.TELEGRAM_GRUP_ORDER = '-100123'; process.env.TELEGRAM_TOPIK_ORDER = '2216'; process.env.TELEGRAM_BOT_ORDER_TOKEN = process.env.TELEGRAM_BOT_ORDER_TOKEN || 'TOKEN-UJI'
  const r = await kirimLaporanHarianGrup(HARI); await new Promise(x => setTimeout(x, 500))
  cek('Aktif → laporan masuk antrean grup (pesan pertama langsung ke topik)', r.terkirim >= 1 && terkirim.length >= 1 && terkirim[0].message_thread_id === 2216 && terkirim[0].parse_mode === 'HTML', JSON.stringify({ r, n: terkirim.length }))
  if (lama) process.env.TELEGRAM_GRUP_ORDER = lama; else delete process.env.TELEGRAM_GRUP_ORDER
  if (topikLama) process.env.TELEGRAM_TOPIK_ORDER = topikLama; else delete process.env.TELEGRAM_TOPIK_ORDER
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.aktivitasMarketer.deleteMany({ where: { id: { in: aktIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
