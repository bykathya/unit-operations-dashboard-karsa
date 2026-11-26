import { DASH } from './_jalur.mjs'
// Uji OMZET BAYANGAN (21 Okt 2026): omzet dari order vs Laporan Omset per periode — perhitungan murni + API circle & Ekosistem (hanya baca).
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { periodeBulan, susunBayangan, kolomDariPlatform } = await import(DASH + '/server/src/utils/omsetBayangan.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }

console.log('— murni —')
const pOkt = periodeBulan(10, 2026)
cek('Periode Okt 2026 dipotong di batas bulan (1–4, 5–11, …, 26–31)', pOkt[0].periodeAwal === '2026-10-01' && pOkt[0].periodeAkhir === '2026-10-04' && pOkt[1].periodeAwal === '2026-10-05' && pOkt.at(-1).periodeAkhir === '2026-10-31', JSON.stringify(pOkt.map(p => p.periodeAwal.slice(8) + '–' + p.periodeAkhir.slice(8))))
cek('Platform → kolom: Vgen→omsetVgen, Internal→null, tak dikenal→Lainnya', kolomDariPlatform('Vgen') === 'omsetVgen' && kolomDariPlatform('Internal') === null && kolomDariPlatform('Kofi') === 'omsetLainnya')
const t = (s) => new Date(s + 'T10:00:00+07:00')
const fiv = { platform: 'Fiverr', feePersen: 0.2 }, intl = { platform: 'Internal', feePersen: 0 }
const h = susunBayangan({
  periode: [{ periodeAwal: '2031-07-07', periodeAkhir: '2031-07-13' }, { periodeAwal: '2031-07-14', periodeAkhir: '2031-07-20' }],
  laporan: [{ periodeAwal: new Date('2031-07-07T00:00:00Z'), totalUsd: 90, kurs: 16000, omsetFiverr: 90 }],
  orders: [
    { tanggalMasuk: t('2031-07-08'), mataUang: 'USD', kurs: 15000, nilaiUsd: 100, nilaiKotor: 1500000, nilaiBersih: 1200000, akun: fiv },
    { tanggalMasuk: t('2031-07-09'), mataUang: 'IDR', nilaiKotor: 320000, nilaiBersih: 256000, akun: fiv },
    { tanggalMasuk: t('2031-07-10'), mataUang: 'IDR', nilaiKotor: 160000, nilaiBersih: 160000, akun: intl },
    { tanggalMasuk: t('2031-07-15'), mataUang: 'USD', kurs: 16000, nilaiUsd: 50, nilaiKotor: 800000, nilaiBersih: 640000, akun: fiv },
  ],
})
const p1 = h.periode[0], p2 = h.periode[1]
cek('Periode 1: order USD pakai nilai USD/kurs ordernya, Rupiah pakai kurs laporan (100 + 20 = $120 kotor)', p1.orderKotorUsd === 120 && p1.kurs === 16000, String(p1.orderKotorUsd))
cek('Periode 1: bersih = 1.200.000/15.000 + 256.000/16.000 = $96', p1.orderBersihUsd === 96, String(p1.orderBersihUsd))
cek('Periode 1: selisih vs laporan $90 → kotor +30, bersih +6', p1.selisihKotor === 30 && p1.selisihBersih === 6)
cek('Order internal dipisah, tidak dibandingkan', p1.internal.jumlah === 1 && p1.jumlahOrder === 2)
cek('Periode 2 tanpa laporan: selisih kosong; kurs = rata-rata laporan bulan', p2.adaLaporan === false && p2.selisihKotor === null && p2.orderKotorUsd === 50 && p2.kursDari === 'rata-rata laporan bulan ini')
cek('Total selisih hanya dari periode berlaporan', h.total.laporanUsd === 90 && h.total.selisihKotor === 30 && h.total.orderKotorUsd === 170)

console.log('— API (hanya baca) —')
let xff = 0
const panggil = async (path, { token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { headers: { 'X-Forwarded-For': `172.38.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id
let akun, lap, orderIds = []
try {
  const koord = await user('ob_koord', [['KOORDINATOR', S]]), kader = await user('ob_kader', [['KADER', S]]), lain = await user('ob_lain', [['KOORDINATOR', pibi.id]])
  akun = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-OB fiverr', feePersen: 0.2 } })
  lap = await prisma.weeklyReport.create({ data: { studioId: S, userId: koord.id, periodeAwal: new Date('2031-07-07T00:00:00Z'), periodeAkhir: new Date('2031-07-13T00:00:00Z'), omsetFiverr: 90, totalUsd: 90, kurs: 16000, kasSekarang: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, tipeKlien: 'EKSTERNAL', klien: 'UJI-OB', judul: 'UJI-OB order', nilaiDisepakati: 1500000, nilaiKotor: 1500000, nilaiBersih: 1200000, mataUang: 'USD', kurs: 15000, nilaiUsd: 100, status: 'MASUK', tanggalMasuk: t('2031-07-08') } }); orderIds.push(o.id)
  const sebelum = JSON.stringify(await prisma.weeklyReport.findUnique({ where: { id: lap.id } }))

  let r = await panggil(`/api/circle/keuangan/bayangan?studioId=${S}&bulan=7&tahun=2031`, { token: koord.c, web: 'bloom' })
  const pr = r.j.data?.periode?.find(p => p.periodeAwal === '2031-07-07')
  cek('Web circle: Koordinator melihat bayangan; periode 7–13 Jul: laporan $90 vs order kotor $100 / bersih $80', r.s === 200 && pr?.laporanUsd === 90 && pr?.orderKotorUsd === 100 && pr?.orderBersihUsd === 80, String(r.s))
  r = await panggil(`/api/circle/keuangan/bayangan?studioId=${S}&bulan=7&tahun=2031`, { token: kader.c, web: 'bloom' }); cek('Web circle: Kader → 403 (talent tanpa uang)', r.s === 403)
  r = await panggil(`/api/circle/keuangan/bayangan?studioId=${S}&bulan=7&tahun=2031`, { token: lain.c, web: 'bloom' }); cek('Web circle: Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`/api/weekly-reports/bayangan?studioId=${S}&bulan=7&tahun=2031`, { token: koord.t }); cek('Ekosistem: Koordinator melihat bayangan unitnya', r.s === 200 && r.j.data.total.laporanUsd === 90)
  r = await panggil(`/api/weekly-reports/bayangan?studioId=${S}&bulan=7&tahun=2031`, { token: lain.t }); cek('Ekosistem: Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`/api/weekly-reports/bayangan?studioId=${S}&bulan=13&tahun=2031`, { token: koord.t }); cek('Ekosistem: bulan tidak valid → 422', r.s === 422)
  cek('Laporan Omset TIDAK berubah (mode bayangan, tanpa tulis)', JSON.stringify(await prisma.weeklyReport.findUnique({ where: { id: lap.id } })) === sebelum)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  if (lap) await prisma.weeklyReport.deleteMany({ where: { id: lap.id } })
  if (akun) await prisma.akunProduksi.deleteMany({ where: { id: akun.id } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
