import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { token } = {}) => { const r = await fetch('http://localhost:3001' + path, { headers: { 'X-Forwarded-For': `172.32.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: keiko.id, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const ordersId = []
try {
  const koord = await user('md_koord', [['KOORDINATOR', keiko.id]])
  const koordLain = await user('md_koord_lain', [['KOORDINATOR', pibi.id]])
  const m1 = await user('md_m1', [['KARYAWAN', keiko.id]], 'MARKETER'), m2 = await user('md_m2', [['KARYAWAN', keiko.id]], 'MARKETER')
  const art = await user('md_art', [['KARYAWAN', keiko.id]], 'ARTIST')
  const akun = (await prisma.akunProduksi.findFirst({ where: { studioId: keiko.id } })) ?? await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  // data Okt 2026 (bulan uji) + satu di Nov (tak boleh ikut tampilan Okt)
  const akt = (u, jenis, tgl, jumlah = 1) => prisma.aktivitasMarketer.create({ data: { userId: u.id, studioId: keiko.id, tanggal: new Date(tgl), jenis, jumlah, selesai: true } })
  await akt(m1, 'publish_post', '2031-10-05', 3); await akt(m1, 'engage_reply', '2031-10-05', 5); await akt(m2, 'optimize_seo', '2031-10-06', 2); await akt(m1, 'publish_post', '2031-11-02', 9)
  await prisma.marketingLead.create({ data: { studioId: keiko.id, klien: 'UJI-MD lead1', marketerId: m1.id, tanggalMasuk: new Date('2031-10-05T03:00:00Z') } })
  await prisma.marketingLead.create({ data: { studioId: keiko.id, klien: 'UJI-MD lead2', marketerId: m2.id, tanggalMasuk: new Date('2031-10-06T03:00:00Z') } })
  const ord = async (judul, marketer, masuk, rw) => { const o = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akun.id, klien: 'KLIEN-UJI-MD', judul, nilaiKotor: 1, nilaiBersih: 1, marketerId: marketer.id, tanggalMasuk: new Date(masuk) } }); ordersId.push(o.id); for (const r of rw) await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: r[0], jenis: r[0], mulai: new Date(r[1]) } }); return o }
  await ord('UJI-MD o1', m1, '2031-10-05T03:00:00Z', [['PREVIEW_KLIEN', '2031-10-08T03:00:00Z'], ['DELIVERY', '2031-10-10T03:00:00Z']])
  await ord('UJI-MD o2', m1, '2031-10-06T03:00:00Z', [['PREVIEW_KLIEN', '2031-10-09T03:00:00Z']])
  await ord('UJI-MD o3', m2, '2031-10-07T03:00:00Z', [])
  const U = (extra = '') => `/api/circle/marketing/dashboard?studioId=${keiko.id}&bulan=10&tahun=2031${extra}`

  console.log('— akses —')
  let r = await panggil(U(), { token: art.t }); cek('Artist (bukan marketer/manajer) → 403', r.s === 403)
  r = await panggil(U(), { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)

  console.log('— tampilan bulan (manajer) —')
  r = await panggil(U(), { token: koord.t }); const d = r.j.data
  cek('Cakupan tim, 31 titik harian', r.s === 200 && d.cakupan === 'tim' && d.seri.length === 31 && d.tampilan === 'bulan')
  cek('KPI: effort 10 (3+5+2), chat 2, order 3, preview 2, delivery 1', d.kpi.effort === 10 && d.kpi.chat === 2 && d.kpi.order === 3 && d.kpi.preview === 2 && d.kpi.delivery === 1, JSON.stringify(d.kpi))
  cek('Aktivitas November tidak ikut', d.kpi.publish === 3)
  cek('Per tahap: publish 3, engage 5, optimize 2', d.kpi.publish === 3 && d.kpi.engage === 5 && d.kpi.optimize === 2 && d.kpi.network === 0)
  cek('Seri harian: order di tgl 5, preview di tgl 8, delivery di tgl 10', d.seri[4].order === 1 && d.seri[7].preview === 1 && d.seri[9].delivery === 1 && d.seri[4].publish === 3)
  cek('Corong 5 tahap + laju Effort→Order 30%', d.corong.length === 5 && d.lajuEffortKeOrder === 30)
  cek('Peringkat memuat m1 & m2; m1 lebih unggul (laju 20% vs 50%?) urut sesuai laju', d.peringkat.length === 2 && d.peringkat[0].peringkat === 1, JSON.stringify(d.peringkat.map(p => [p.nama, p.laju])))
  cek('Per marketer memuat effort tiap orang', d.perMarketer.find(p => p.userId === m1.id).effort === 8 && d.perMarketer.find(p => p.userId === m2.id).effort === 2)
  cek('Tanpa kunci uang', ![...(() => { const k = new Set(); JSON.stringify(d, (a, v) => { k.add(a); return v }); return k })()].some(k => /^fee|^rp$|omset|harga|uang|rupiah|nilaiBersih|nilaiKotor/i.test(k)))

  console.log('— filter marketer —')
  r = await panggil(U(`&marketerId=${m2.id}`), { token: koord.t })
  cek('Filter m2: effort 2, order 1, cakupan marketer', r.j.data.cakupan === 'marketer' && r.j.data.kpi.effort === 2 && r.j.data.kpi.order === 1)
  r = await panggil(U(`&marketerId=${art.id}`), { token: koord.t }); cek('Filter bukan-marketer diabaikan (angka tak bocor) → cakupan tim', r.j.data.cakupan === 'tim' && r.j.data.kpi.effort === 10)

  console.log('— marketer biasa: hanya miliknya —')
  r = await panggil(U(`&marketerId=${m2.id}`), { token: m1.t }); const s = r.j.data
  cek('Marketer m1: cakupan "saya", effort 8, order 2, tanpa peringkat/daftar marketer', r.s === 200 && s.cakupan === 'saya' && s.kpi.effort === 8 && s.kpi.order === 2 && !s.peringkat && s.marketer.length === 0, JSON.stringify(s.kpi))
  cek('Parameter marketerId milik orang lain diabaikan', s.marketerId === null)

  console.log('— tampilan tahun —')
  r = await panggil(`/api/circle/marketing/dashboard?studioId=${keiko.id}&tahun=2031&tampilan=tahun`, { token: koord.t }); const t = r.j.data
  cek('Tahun: 12 titik bulanan, Okt effort 10 + Nov 9', r.s === 200 && t.tampilan === 'tahun' && t.seri.length === 12 && t.seri[9].publish + t.seri[9].engage + t.seri[9].optimize === 10 && t.seri[10].publish === 9)
  cek('Konversi tahunan: 12 bulan; Okt laju 30%', t.konversiTahunan.bulan.length === 12 && t.konversiTahunan.bulan[9].laju === 30 && t.konversiTahunan.bulan[9].effort === 10 && t.konversiTahunan.bulan[9].order === 3)
  cek('Rata-rata laju dihitung dari bulan ber-laju', t.konversiTahunan.rataRata != null)
  r = await panggil(`/api/circle/marketing/dashboard?studioId=${keiko.id}&bulan=13&tahun=2031`, { token: koord.t }); cek('Bulan tidak valid → 422', r.s === 422)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.aktivitasMarketer.deleteMany({ where: { studioId: keiko.id, tanggal: { gte: new Date('2031-01-01'), lt: new Date('2032-01-01') } } })
  await prisma.marketingLead.deleteMany({ where: { klien: { startsWith: 'UJI-MD' } } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-MD' } })
  for (const id of dibuat) { await prisma.fungsiAnggota.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
