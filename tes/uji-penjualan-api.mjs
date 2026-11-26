import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.49.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const PJ = await import(DASH + '/server/src/utils/penjualan.js')
console.log('— periode closing (aturan Jumat + akhir bulan) —')
const ring = (t, b) => PJ.periodeBulan(t, b).map(p => `${p.mulai.slice(8)}-${p.akhir.slice(8)}`).join()
cek('Okt 2026: 1–9, 10–16, 17–23, 24–31 (Jumat 2 & 30 dilewati karena ≤3 hari dari akhir bulan)', ring(2026, 10) === '01-09,10-16,17-23,24-31', ring(2026, 10))
cek('Jan 2027: Jumat 1 & 29 dilewati → 1–8, 9–15, 16–22, 23–31', ring(2027, 1) === '01-08,09-15,16-22,23-31', ring(2027, 1))
cek('Periode menutup bulan tanpa celah/tumpang tindih (semua bulan 2026)', Array.from({ length: 12 }, (_, i) => PJ.periodeBulan(2026, i + 1)).every((ps, i) => ps[0].mulai.endsWith('-01') && ps.at(-1).akhir === new Date(Date.UTC(2026, i + 1, 0)).toISOString().slice(0, 10) && ps.every((p, j) => j === 0 || new Date(ps[j - 1].akhir + 'T00:00:00Z').getTime() + 86400000 === new Date(p.mulai + 'T00:00:00Z').getTime())))
const per = PJ.periodeBulan(2026, 10)
const rp = PJ.rincianPeriode({ periode: per, targetBulan: 400, aktualPerTanggal: new Map([['2026-10-05', 60], ['2026-10-12', 150]]), hariIni: '2026-10-20' })
cek('Target dasar 100/periode; periode 1 aktual 60 → kekurangan 40 dibawa ke periode 2 (efektif 140)', rp[0].dasar === 100 && rp[0].aktual === 60 && rp[1].efektif === 140 && rp[1].carry === 40)
cek('Periode 2 aktual 150 → kelebihan mengurangi periode 3 (efektif 100 + (40 − 50) = 90)', rp[2].efektif === 90)
cek('Periode berjalan/depan ditandai; periode depan tanpa status', rp[2].berjalan === true && rp[3].depan === true && rp[3].status === 'neutral')
cek('Tanpa target → status neutral', PJ.rincianPeriode({ periode: per, targetBulan: 0, aktualPerTanggal: new Map(), hariIni: '2026-10-30' }).every(p => p.status === 'neutral'))

const orderIds = []
let akun1, akun2
try {
  const koord = await user('pj_koord', [['KOORDINATOR', S]]), kepala = await user('pj_kepala', [['KEPALA_CIRCLE', null]]), mk = await user('pj_mk', [['KARYAWAN', S]]), kar = await user('pj_kar', [['KARYAWAN', S]]), lain = await user('pj_lain', [['KOORDINATOR', pibi.id]])
  await prisma.userRole.updateMany({ where: { userId: kepala.id }, data: { circleId: keiko.circleId } })
  await prisma.fungsiAnggota.create({ data: { userId: mk.id, studioId: S, fungsi: 'MARKETER' } })
  akun1 = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-PJ A', feePersen: 0 } })
  akun2 = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: 'UJI-PJ B', feePersen: 0 } })
  await prisma.penugasanAkunMarketer.create({ data: { userId: mk.id, akunId: akun1.id } })
  const O = async (akun, judul, tgl, data) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-PJ k', judul, nilaiKotor: 0, nilaiBersih: 0, tanggalMasuk: new Date(tgl + 'T10:00:00+07:00'), ...data } }); orderIds.push(o.id); return o }
  await O(akun1, 'UJI-PJ a1', '2031-03-05', { mataUang: 'USD', kurs: 16000, nilaiUsd: 100, nilaiKotor: 1600000, nilaiBersih: 1600000 })
  await O(akun1, 'UJI-PJ a2', '2031-03-20', { mataUang: 'USD', kurs: 16000, nilaiUsd: 50, nilaiKotor: 800000, nilaiBersih: 800000 })
  await O(akun2, 'UJI-PJ b1', '2031-03-12', { mataUang: 'USD', kurs: 15000, nilaiUsd: 40, nilaiKotor: 600000, nilaiBersih: 600000 })
  await O(akun2, 'UJI-PJ batal', '2031-03-12', { mataUang: 'USD', kurs: 15000, nilaiUsd: 999, nilaiKotor: 1, nilaiBersih: 1, status: 'BATAL' })
  const P = '/api/circle/penjualan'
  console.log('— target per akun —')
  let r = await panggil(`${P}/target?studioId=${S}&tahun=2031&bulan=3`, { token: kar.t }); cek('Karyawan biasa → 403', r.s === 403)
  r = await panggil(`${P}/target`, { method: 'PUT', token: koord.t, body: { akunId: akun1.id, tahun: 2031, bulan: 3, targetUsd: 100 } }); cek('Koordinator (CEO unit) mengatur target akun unitnya → 200', r.s === 200)
  r = await panggil(`${P}/target`, { method: 'PUT', token: lain.t, body: { akunId: akun1.id, tahun: 2031, bulan: 3, targetUsd: 1 } }); cek('Koordinator unit LAIN mengatur target → 403', r.s === 403)
  r = await panggil(`${P}/target`, { method: 'PUT', token: kar.t, body: { akunId: akun1.id, tahun: 2031, bulan: 3, targetUsd: 1 } }); cek('Karyawan mengatur target → 403', r.s === 403)
  r = await panggil(`${P}/target`, { method: 'PUT', token: kepala.t, body: { akunId: akun1.id, tahun: 2031, bulan: 3, targetUsd: -1 } }); cek('Target negatif → 422', r.s === 422)
  r = await panggil(`${P}/target`, { method: 'PUT', token: kepala.t, body: { akunId: akun1.id, tahun: 2031, bulan: 3, targetUsd: 200 } }); cek('Target akun A $200 → 200', r.s === 200)
  r = await panggil(`${P}/target`, { method: 'PUT', token: kepala.t, body: { akunId: akun2.id, tahun: 2031, bulan: 3, targetUsd: 100 } })
  r = await panggil(`${P}/target?studioId=${S}&tahun=2031&bulan=3`, { token: koord.t }); console.log('TGT', r.s, JSON.stringify(r.j).slice(0,200)); cek('Target unit = jumlah target akun ($300), ditandai dari akun', r.s === 200 && r.j.data.targetUnit === 300 && r.j.data.targetUnitDariAkun === true)
  console.log('— dashboard penjualan —')
  r = await panggil(`${P}?studioId=${S}&tahun=2031&bulan=3`, { token: kar.t }); cek('Karyawan non-marketer → 403', r.s === 403)
  r = await panggil(`${P}?studioId=${S}&tahun=2031&bulan=3`, { token: lain.t }); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${P}?studioId=${S}&tahun=2031&bulan=13`, { token: koord.t }); cek('Bulan 13 → 422', r.s === 422)
  r = await panggil(`${P}?studioId=${S}&tahun=2031&bulan=3`, { token: koord.t }); const d = r.j.data ?? {}; if (!r.j.data) console.log('RESP', r.s, JSON.stringify(r.j))
  cek('Total bulan: $190 (100 + 50 + 40; order BATAL tak dihitung), target $300, 63,3%', r.s === 200 && d.total.aktualUsd === 190 && d.total.targetUsd === 300 && d.total.persen === 63.3 && d.total.order === 3)
  cek('Per akun: A $150 dari $200 (75%), B $40 dari $100 (40%)', d.akun.find(a => a.nama === 'UJI-PJ A')?.aktualUsd === 150 && d.akun.find(a => a.nama === 'UJI-PJ A')?.persen === 75 && d.akun.find(a => a.nama === 'UJI-PJ B')?.persen === 40)
  cek('Periode Maret 2031 (masa depan relatif hari ini): semua "depan"; jumlah aktual periode = $190', d.periode.every(p => p.depan) && Math.round(d.periode.reduce((a, p) => a + p.aktual, 0)) === 190)
  cek('12 bulan: Maret berisi $190 dengan target $300; bulan lain kosong', d.tahunan.length === 12 && d.tahunan[2].aktualUsd === 190 && d.tahunan[2].targetUsd === 300 && d.tahunan[0].aktualUsd === 0)
  r = await panggil(`${P}?studioId=${S}&tahun=2031&bulan=3`, { token: mk.t })
  cek('Marketer (talent) TIDAK membuka Penjualan/omzet akun → 403 (keputusan user 21 Okt 2026)', r.s === 403)
  console.log('— kaizen memakai target akun —')
  r = await panggil(`/api/circle/kaizen/target?tahun=2031&bulan=3`, { token: koord.t }); cek('Kaizen/target menampilkan unit dari akun', r.s === 200 && r.j.data.unit.find(u => u.studioId === S)?.targetUsd === 300 && r.j.data.unit.find(u => u.studioId === S)?.dariAkun === true)
} finally {
  await prisma.targetOmsetAkun.deleteMany({ where: { akunId: { in: [akun1?.id, akun2?.id].filter(Boolean) } } })
  await prisma.penugasanAkunMarketer.deleteMany({ where: { akunId: { in: [akun1?.id, akun2?.id].filter(Boolean) } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: [akun1?.id, akun2?.id].filter(Boolean) } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
