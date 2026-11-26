import { DASH } from './_jalur.mjs'
// Uji HALAMAN "WEB CIRCLE" DI Ekosistem DASHBOARD (14 Nov 2026): GET /api/web-circle/ringkasan — (1) wewenang: talent & token web circle ditolak,
// Koordinator hanya unitnya, Super Admin semua; (2) SATU DEFINISI: angka per unit SAMA dengan yang tampil di web circle (kartu papan Produksi,
// Belum dibayar klien, Analitik › Kondisi hari ini, Tutup bulan). Hanya membaca; memakai data lokal Keiko + order uji sementara.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { headers: { 'X-Forwarded-For': `172.52.3.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), S = keiko.id, T = Date.now()
const hash = await bcrypt.hash('uji-rwc-' + T, 4)
const dibuat = [], orderIds = [], akunIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, utama: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }), circle: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const unitDari = (d, id) => d?.kelompok?.flatMap(k => k.unit).find(u => u.studioId === id)
try {
  const koord = await user('rwc_koord', [['KOORDINATOR', S]]), tal = await user('rwc_tal', [['KARYAWAN', S]]), eko = await user('rwc_eko', [['KEPALA_EKOSISTEM', null]])
  // order uji agar angka tidak nol semua
  const akun = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: `UJI-RWC ${T}`, feePersen: 0 } })).id; akunIds.push(akun)
  const tahap = await prisma.tahapProduksi.findMany({ where: { studioId: S } })
  const masuk = tahap.find(t => t.jenis === 'MASUK'), selesai = tahap.find(t => t.jenis === 'SELESAI')
  for (const [j, extra] of [['inbox lewat', { status: 'MASUK', tahapId: masuk.id, deadline: new Date(Date.now() - 3 * 86400000) }], ['done', { status: 'SELESAI', tahapId: selesai.id, tanggalSelesai: new Date() }]]) {
    const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'uji_klrwc', judul: `UJI-RWC ${j} ${T}`, nilaiKotor: 300000, nilaiBersih: 300000, nilaiDisepakati: 300000, tanggalMasuk: new Date(), ...extra } }); orderIds.push(o.id)
  }

  // ── (1) wewenang ──
  let r = await panggil('/api/web-circle/ringkasan', { token: tal.utama })
  cek('Talent (Karyawan) → 403', r.s === 403, String(r.s))
  r = await panggil('/api/web-circle/ringkasan', { token: koord.circle })
  cek('Token web circle tidak bisa membuka halaman Ekosistem → 403', r.s === 403, String(r.s))
  r = await panggil('/api/web-circle/ringkasan')
  cek('Tanpa login → 401', r.s === 401, String(r.s))
  r = await panggil('/api/web-circle/ringkasan', { token: koord.utama }); const dk = r.j.data
  const unitK = dk?.kelompok?.flatMap(k => k.unit) ?? []
  cek('Koordinator hanya melihat unitnya sendiri', r.s === 200 && unitK.length === 1 && unitK[0].studioId === S && dk.semuaWilayah === false, unitK.map(u => u.nama).join(','))
  r = await panggil('/api/web-circle/ringkasan', { token: eko.utama }); const de = r.j.data
  const semuaUnit = await prisma.studio.count({ where: { statusAktif: true, tipe: { not: 'KORPORASI' }, OR: [{ circleId: { not: null } }, { rumahUsahaId: { not: null } }, { indukId: { not: null } }] } })
  cek('Super Admin (Kepala Ekosistem) melihat semua unit web circle', r.s === 200 && de.semuaWilayah === true && de.total.unit === semuaUnit, `${de?.total?.unit}/${semuaUnit}`)
  cek('Setiap kelompok punya alamat web circle', de.kelompok.every(k => k.alamat?.startsWith('https://')))
  cek('Tidak ada unit yang gagal dimuat', !de.kelompok.flatMap(k => k.unit).some(u => u.galat))

  // ── (2) satu definisi: bandingkan dengan layar web circle (Koordinator unit yang sama) ──
  const u = unitDari(dk, S)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.circle, web: 'bloom' }); const rg = r.j.data?.ringkasan
  cek('Nilai bulan ini = kartu papan Produksi', rg && u.nilai.total === Math.round(rg.total * 100) / 100 && u.nilai.done === Math.round(rg.done * 100) / 100 && u.nilai.delivery === Math.round(rg.delivery * 100) / 100, JSON.stringify({ k: u.nilai, p: { t: rg?.total, d: rg?.done } }))
  r = await panggil(`/api/circle/pembayaran?studioId=${S}`, { token: koord.circle, web: 'bloom' })
  cek('Belum dibayar klien = menu Belum dibayar klien', r.s === 200 && u.belumDibayar.sisa === r.j.data.totalSisa && u.belumDibayar.jumlah === r.j.data.baris.length, `${u.belumDibayar.sisa} vs ${r.j.data?.totalSisa}`)
  r = await panggil(`/api/circle/analitik/nadi?studioId=${S}`, { token: koord.circle, web: 'bloom' })
  cek('Antrean & macet = Analitik › Kondisi hari ini', r.s === 200 && u.produksi.macet === r.j.data.nadi.macet && JSON.stringify(u.produksi.alir.map(a => a.jumlah)) === JSON.stringify(r.j.data.alir.map(a => a.jumlah)), JSON.stringify(u.produksi.alir.map(a => a.jumlah)))
  const bulan = de.bulan
  r = await panggil(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${bulan}`, { token: koord.circle, web: 'bloom' })
  cek('Laba rugi & kas = Tutup bulan', r.s === 200 && u.buku.hasil === Math.round(r.j.data.hasil * 100) / 100 && u.buku.kasAkhir === Math.round(r.j.data.kasAkhir * 100) / 100, `${u.buku.hasil} vs ${r.j.data?.hasil}`)
  cek('Order lewat deadline ikut terhitung', u.produksi.lewatDeadline >= 1, String(u.produksi.lewatDeadline))
  // satu arti piutang (14 Nov 2026): Manajemen web circle = Belum dibayar klien
  r = await panggil(`/api/circle/manajemen`, { token: eko.circle, web: 'bloom' })
  const pk = (r.j.data?.piutang?.baris ?? []).filter(b => b.unit === keiko.nama).reduce((a, b) => a + b.sisa, 0)
  cek('Piutang Keiko di Manajemen = Belum dibayar klien (hanya yang sudah Delivery/Done)', r.s === 200 && Math.round(pk) === Math.round(u.belumDibayar.sisa) && r.j.data.piutang.masihDikerjakan != null, `${pk} vs ${u.belumDibayar.sisa} (${r.s})`)
  cek('Koordinator & Super Admin melihat angka unit yang sama', JSON.stringify(unitDari(de, S).nilai) === JSON.stringify(u.nilai))
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_klrwc' } } }).catch(() => {})
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
