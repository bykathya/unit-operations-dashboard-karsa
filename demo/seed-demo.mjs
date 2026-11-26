import { DASH } from '../tes/_jalur.mjs'
// SKENARIO DEMO LOKAL — studio Sekartaji (Bloom Circle) dengan koordinator, marketer, dan artist FIKTIF.
// Hanya untuk database LOKAL (dihentikan bila DATABASE_URL bukan localhost).
//   node demo/seed-demo.mjs          → buat / perbarui skenario
//   node demo/seed-demo.mjs hapus    → hapus semuanya (akun, order, prospek, aktivitas, templat studio)
// Akun demo (kata sandi sama untuk semuanya, hanya berlaku di database lokal):
//   demo.koordinator@demo.uji.local   → Koordinator (papan penuh, Marketing tim, Tim, Alur)
//   demo.marketer@demo.uji.local      → Marketer (Marketing pribadi + Tugas saya)
//   demo.artist@demo.uji.local        → Artist (Tugas saya saja)
//   Kata sandi: Demo-Lokal-2026
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) throw new Error('BUKAN database lokal — dihentikan')
const bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { bangunPreset } = await import(DASH + '/server/src/utils/alur.js')
const DOMAIN = '@demo.uji.local', SANDI = 'Demo-Lokal-2026', TANDA = 'DEMO-SEKARTAJI'
const studio = await prisma.studio.findFirst({ where: { nama: 'Sekartaji' } })

async function hapus() {
  const u = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } }); const ids = u.map(x => x.id)
  await prisma.orderProduksi.deleteMany({ where: { OR: [{ catatan: { startsWith: TANDA } }, { marketerId: { in: ids } }] } })
  await prisma.marketingLead.deleteMany({ where: { studioId: studio.id, OR: [{ marketerId: { in: ids } }, { catatan: { startsWith: TANDA } }] } })
  for (const m of ['aktivitasMarketer', 'targetMarketing', 'penugasanAkunMarketer', 'profilSosialMarketer', 'logHarianMarketer', 'fungsiAnggota', 'userRole']) await prisma[m].deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
  await prisma.akunProduksi.deleteMany({ where: { studioId: studio.id, namaAkun: { startsWith: 'DEMO ' } } })
  await prisma.tahapProduksi.deleteMany({ where: { studioId: studio.id } })
  console.log('skenario demo dihapus')
}
if (process.argv[2] === 'hapus') { await hapus(); await prisma.$disconnect(); process.exit(0) }
await hapus()

const hash = await bcrypt.hash(SANDI, 10)
const mk = async (kode, nama, role, posisi, fungsi) => {
  const u = await prisma.user.create({ data: { nama, email: `demo.${kode}${DOMAIN}`, passwordHash: hash, statusAktif: true, posisi } })
  await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId: studio.id } })
  for (const f of fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: studio.id, fungsi: f.fungsi, bidang: f.bidang ?? null, terkonfirmasi: true } })
  return u
}
const koord = await mk('koordinator', 'Demo Koordinator', 'KOORDINATOR', 'Koordinator', [{ fungsi: 'PM_QC' }])
const mkt = await mk('marketer', 'Demo Marketer', 'KARYAWAN', 'Admin', [{ fungsi: 'MARKETER' }])
const art = await mk('artist', 'Demo Artist', 'KARYAWAN', 'Rigger', [{ fungsi: 'ARTIST', bidang: 'Rigging' }])

// Templat "layanan" (taksonomi Daily Chat Sekartaji)
await bangunPreset('layanan', (b) => prisma.tahapProduksi.create({ data: { studioId: studio.id, ...b } }).then(x => x.id))
const T = Object.fromEntries((await prisma.tahapProduksi.findMany({ where: { studioId: studio.id } })).map(t => [t.nama, t]))

// Akun marketplace studio + penugasan ke marketer
const etsy = await prisma.akunProduksi.create({ data: { studioId: studio.id, platform: 'Etsy', namaAkun: 'DEMO Etsy Sekartaji', feePersen: 0.15 } })
const vgen = await prisma.akunProduksi.create({ data: { studioId: studio.id, platform: 'Vgen', namaAkun: 'DEMO VGen Gucyluci', feePersen: 0.1 } })
for (const a of [etsy, vgen]) await prisma.penugasanAkunMarketer.create({ data: { userId: mkt.id, akunId: a.id } })

// Order di berbagai tahap (klien fiktif)
const hari = (n) => new Date(Date.now() + n * 86400000)
const orders = [
  ['Chibi Vtuber — Karakter Alfa', 'Klien Alfa', 450000, 'Queue', hari(6), mkt, art], ['Rigging advance — Karakter Bravo', 'Klien Bravo', 1500000, 'Menunggu Client', hari(12), mkt, null],
  ['Toggle outfit — Karakter Charlie', 'Klien Charlie', 100000, 'Progress', hari(3), mkt, art], ['Half body rig — Karakter Delta', 'Klien Delta', 750000, 'Progress', hari(-1), mkt, art],
  ['Animasi YCH — Karakter Echo', 'Klien Echo', 150000, 'Preview', hari(2), mkt, art], ['Overlay rig — Karakter Foxtrot', 'Klien Foxtrot', 300000, 'Preview', hari(4), mkt, null],
  ['Anime illustration — Karakter Golf', 'Klien Golf', 300000, 'Revision', hari(5), mkt, art], ['Toggle hair — Karakter Hotel', 'Klien Hotel', 80000, 'Done', hari(-3), mkt, art],
]
for (const [judul, klien, nilai, tahap, deadline, pemasar, talent] of orders) {
  const t = T[tahap], selesai = t.jenis === 'SELESAI'
  await prisma.orderProduksi.create({ data: {
    studioId: studio.id, akunId: etsy.id, tipeKlien: 'EKSTERNAL', klien, judul, nilaiDisepakati: nilai, nilaiKotor: nilai, nilaiBersih: Math.round(nilai * 0.85),
    status: selesai ? 'SELESAI' : t.jenis === 'MASUK' ? 'MASUK' : 'PROSES', subStatus: t.nama, tahapId: t.id, tahapAktif: ['-'], marketerId: pemasar.id, deadline,
    tanggalSelesai: selesai ? hari(-3) : null, revisiKe: t.jenis === 'REVISI_KLIEN' ? 1 : 0, catatan: TANDA,
    ...(talent ? { assignments: { create: { userId: talent.id } } } : {}),
    riwayatTahap: { create: { namaTahap: t.nama, jenis: t.jenis, namaPengguna: 'demo', mulai: hari(-2) } },
  } })
}

// Prospek (lead) di berbagai status
for (const [klien, status, platform, akun, nilai] of [['Streamer India', 'DISCUSSING', 'X', etsy, 350000], ['Streamer Juliet', 'FOLLOW_UP', 'IG', vgen, 600000], ['Studio Kilo', 'NEGO', 'Discord', etsy, 1200000], ['Streamer Lima', 'LOST', 'X', vgen, 200000]]) {
  await prisma.marketingLead.create({ data: { studioId: studio.id, klien, status, platform, akunId: akun.id, estimasiNilai: nilai, marketerId: mkt.id, catatan: `${TANDA} · contoh prospek`, tanggalFollowUpTerakhir: status === 'DISCUSSING' ? null : hari(-1) } })
}

// Aktivitas harian sebulan berjalan (sebagian selesai) + log suasana hati
const jenisAktif = [['publish_post', 'Post promo emote', 'X', etsy, { jamPosting: '10:00' }], ['engage_reply', 'Balas komunitas', 'X', etsy, { targetAkun: '@komunitas', pengikut: 800 }], ['optimize_seo', 'Perbarui judul listing', 'Etsy', etsy, {}], ['publish_post', 'Showcase rigging', 'IG', vgen, { jamPosting: '15:30' }], ['network_dm', 'DM kolaborasi', 'X', vgen, {}]]
const sekarang = new Date(Date.now() + 7 * 3600e3); const hariKe = sekarang.getUTCDate()
for (let h = 1; h <= hariKe; h++) {
  const tanggal = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), h))
  for (const [i, [jenis, judul, platform, akun, ekstra]] of jenisAktif.entries()) {
    if ((h + i) % 3 === 0) continue
    await prisma.aktivitasMarketer.create({ data: { userId: mkt.id, studioId: studio.id, tanggal, jenis, judul, platform, akunId: akun.id, link: `https://example.com/demo/${h}-${i}`, jumlah: jenis === 'engage_reply' ? 5 : 1, selesai: h < hariKe || i < 2, selesaiPada: h < hariKe ? tanggal : null, dibuatOleh: mkt.id, ...ekstra } })
  }
  if (h % 2 === 0) await prisma.logHarianMarketer.create({ data: { userId: mkt.id, tanggal, mood: ['semangat', 'bahagia', 'biasa', 'capek'][h % 4] } })
}
await prisma.profilSosialMarketer.createMany({ data: [{ userId: mkt.id, platform: 'X', link: 'https://x.com/demo_sekartaji', label: 'Akun studio' }, { userId: mkt.id, platform: 'Etsy', link: 'https://etsy.com/shop/demo', label: 'Toko Etsy' }] })
console.log('skenario demo siap — lihat komentar di kepala berkas ini untuk akun & kata sandi demo')
await prisma.$disconnect()
