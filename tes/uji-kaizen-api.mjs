import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const K = await import(DASH + '/server/src/utils/kaizen.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.38.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }

console.log('— logika murni (OGS scorecard/pace/kaizen) —')
cek('Pace bulan berjalan: di depan/on-track/behind/critical (selisih ≥0, ≥-5, ≥-15)', ['ahead', 'on-track', 'behind', 'critical'].join() === [60, 47, 40, 20].map(a => K.statusPace({ aktual: a, target: 100, hariKe: 15, hariDalamBulan: 30, bulanBerjalan: true }).status).join())
cek('Pace bulan lalu: ≥100 ahead, ≥90 on-track, ≥75 behind, selain itu critical', [100, 90, 75, 74].map(a => K.statusPace({ aktual: a, target: 100, hariKe: 30, hariDalamBulan: 30, bulanBerjalan: false }).status).join() === 'ahead,on-track,behind,critical')
cek('Tanpa target → neutral', K.statusPace({ aktual: 5, target: 0, hariKe: 1, hariDalamBulan: 30, bulanBerjalan: true }).status === 'neutral' && K.statusOmzet('ahead', false) === 'neutral')
cek('Ambang OTD (85/70), revisi (25/40), SDM (7.5/6), koleksi (80/55)', K.statusOtd(85) === 'good' && K.statusOtd(70) === 'warn' && K.statusOtd(69.9) === 'critical' && K.statusRevisi(25) === 'good' && K.statusRevisi(40) === 'warn' && K.statusRevisi(41) === 'critical' && K.statusSdm(7.5) === 'good' && K.statusSdm(6) === 'warn' && K.statusSdm(5.9) === 'critical' && K.statusKoleksi(80, 20) === 'good' && K.statusKoleksi(55, 45) === 'warn' && K.statusKoleksi(54, 46) === 'critical')
cek('Beban order: carry-over besar → warn; wip dominan → warn; wajar → good; kosong → neutral', K.statusBeban({ total: 10, carryOver: 6, wip: 1, terbuka: 10 }) === 'warn' && K.statusBeban({ total: 10, carryOver: 1, wip: 9, terbuka: 10 }) === 'warn' && K.statusBeban({ total: 10, carryOver: 1, wip: 3, terbuka: 10 }) === 'good' && K.statusBeban({ total: 0, carryOver: 0, wip: 0, terbuka: 0 }) === 'neutral')
const rd = K.radarSdm([{ skorKehadiran: 4, skorKetepatanWaktu: 4, skorAdab: 3, skorKejujuran: 3, skorMenerimaMasukan: 3, skorKualitasKerja: 5, skorPenguasaanSkill: 5, skorInisiatif: 2, skorKerjaSama: 4 }])
cek('Radar SDM: skala 5 → 10 per kategori, rata-rata 4 kategori', JSON.stringify(rd.kategori.map(k => k.nilai)) === JSON.stringify([8, 6, 10, 6]) && rd.rata === 7.5)

const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], ordersId = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, C = '/api/circle/kaizen', BLN = '2031-07'
let akun, pembuatLaporan
const W = (s) => new Date(s + '+07:00')
try {
  const koord = await user('kz_koord', [['KOORDINATOR', S]]), kepala = await user('kz_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]])
  const artA = await user('kz_artA', [['KARYAWAN', S]]), koordLain = await user('kz_koord_lain', [['KOORDINATOR', pibi.id]])
  akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })

  console.log('— akses —')
  let r = await panggil(`${C}/eksekutif?bulan=${BLN}`, { token: artA.t }); cek('Anggota biasa membuka skor eksekutif → 403', r.s === 403)
  r = await panggil(`${C}/eksekutif?bulan=${BLN}`, { token: koord.t, web: 'app' }); cek('Tanpa alamat circle → 403', r.s === 403)
  r = await panggil(`${C}/eksekutif?bulan=${BLN}`, { token: kepala.tNaya }); cek('Token circle lain di alamat Bloom → 403', r.s === 403)
  r = await panggil(`${C}/eksekutif?bulan=2031-13`, { token: koord.t }); cek('Bulan tidak valid → 422', r.s === 422)
  r = await panggil(`${C}/eksekutif?bulan=${BLN}`, { token: koordLain.t }); cek('Koordinator circle lain: cakupan kosong (tak melihat unit Bloom)', r.s === 200 && r.j.data.cakupan.length === 0)
  r = await panggil(`${C}/eksekutif?bulan=${BLN}&studioId=${pibi.id}`, { token: koord.t }); cek('Meminta unit di luar wewenang → 403', r.s === 403)

  console.log('— target omset —')
  r = await panggil(`${C}/target`, { method: 'PUT', token: koord.t, body: { studioId: S, tahun: 2031, bulan: 7, targetUsd: 1000 } }); cek('Koordinator (CEO unit) mengatur target unitnya → 200', r.s === 200)
  r = await panggil(`${C}/target`, { method: 'PUT', token: koordLain.t, body: { studioId: S, tahun: 2031, bulan: 7, targetUsd: 1 } }); cek('Koordinator unit LAIN mengatur target → 403', r.s === 403)
  r = await panggil(`${C}/target`, { method: 'PUT', token: artA.t, body: { studioId: S, tahun: 2031, bulan: 7, targetUsd: 1 } }); cek('Karyawan mengatur target → 403', r.s === 403)
  r = await panggil(`${C}/target`, { method: 'PUT', token: kepala.t, body: { studioId: pibi.id, tahun: 2031, bulan: 7, targetUsd: 1000 } }); cek('Target unit di luar wewenang → 403', r.s === 403)
  r = await panggil(`${C}/target`, { method: 'PUT', token: kepala.t, body: { studioId: S, tahun: 2031, bulan: 7, targetUsd: -5 } }); cek('Target negatif → 422', r.s === 422)
  r = await panggil(`${C}/target`, { method: 'PUT', token: kepala.t, body: { studioId: S, tahun: 2031, bulan: 7, targetUsd: 1000 } }); cek('Kepala Circle mengatur target Keiko $1.000', r.s === 200)
  r = await panggil(`${C}/target?tahun=2031&bulan=7`, { token: koord.t }); cek('Target terbaca; koordinator bisa mengubah', r.j.data.unit.find(u => u.studioId === S)?.targetUsd === 1000 && r.j.data.bisaUbah === true)

  console.log('— menyiapkan data Juli 2031 —')
  pembuatLaporan = koord.id
  await prisma.weeklyReport.create({ data: { studioId: S, userId: koord.id, periodeAwal: new Date('2031-07-07T00:00:00Z'), periodeAkhir: new Date('2031-07-13T00:00:00Z'), totalUsd: 900, kurs: 16000, kasSekarang: 0, omsetFiverr: 900 } })
  const O = async (judul, data, riwayat = [], termin = []) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-KZ', judul, nilaiKotor: 1000000, nilaiBersih: 1000000, ...data } }); ordersId.push(o.id); for (const x of riwayat) await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, ...x } }); for (const t of termin) await prisma.terminBayarOrder.create({ data: { orderId: o.id, ...t } }); return o }
  const oA = await O('UJI-KZ A terkirim+revisi', { status: 'SELESAI', tanggalMasuk: W('2031-07-05T10:00'), tanggalSelesai: W('2031-07-14T10:00'), deadline: W('2031-07-15T10:00'), revisiKe: 1 },
    [{ namaTahap: 'UJI-KZ Sketch', jenis: 'KERJA', mulai: W('2031-07-05T10:00'), selesai: W('2031-07-07T10:00') }, { namaTahap: 'Selesai', jenis: 'SELESAI', mulai: W('2031-07-14T10:00') }],
    [{ label: 'DP', jumlah: 800000, dibayarPada: new Date('2031-07-12T00:00:00Z'), jatuhTempo: new Date('2031-07-10T00:00:00Z') }, { label: 'Lunas', jumlah: 200000, jatuhTempo: new Date('2031-07-25T00:00:00Z') }])
  await O('UJI-KZ B telat', { status: 'PROSES', tanggalMasuk: W('2031-07-10T10:00'), deadline: W('2031-07-20T10:00') }, [{ namaTahap: 'UJI-KZ Sketch', jenis: 'KERJA', mulai: W('2031-07-10T10:00'), selesai: W('2031-07-13T10:00') }, { namaTahap: 'Finalisasi', jenis: 'FINALISASI', mulai: W('2031-07-20T10:00') }])
  await O('UJI-KZ C carry-over', { status: 'PROSES', tanggalMasuk: W('2031-06-20T10:00'), deadline: W('2031-08-20T10:00') }, [{ namaTahap: 'UJI-KZ Sketch', jenis: 'KERJA', mulai: W('2031-06-20T10:00'), selesai: W('2031-07-02T10:00') }])
  await O('UJI-KZ D selesai tanpa revisi', { status: 'SELESAI', tanggalMasuk: W('2031-06-25T10:00'), tanggalSelesai: W('2031-07-18T10:00'), deadline: W('2031-07-19T10:00'), revisiKe: 0 }, [{ namaTahap: 'UJI-KZ Sketch', jenis: 'KERJA', mulai: W('2031-06-25T10:00'), selesai: W('2031-06-27T10:00') }])
  await prisma.penilaianKader.create({ data: { userId: artA.id, penilaiId: koord.id, tanggalPenilaian: W('2031-07-10T10:00'), skorKehadiran: 4, skorKetepatanWaktu: 4, skorAdab: 4, skorKejujuran: 4, skorMenerimaMasukan: 4, skorKualitasKerja: 4, skorPenguasaanSkill: 4, skorInisiatif: 4, skorKerjaSama: 4 } })

  console.log('— skor eksekutif —')
  r = await panggil(`${C}/eksekutif?bulan=${BLN}`, { token: kepala.t }); const e = r.j.data
  cek('Cakupan memuat unit Bloom (Kepala Circle) termasuk Keiko', r.s === 200 && e.cakupan.some(u => u.id === S))
  cek('Omzet bulan Juli: aktual $900 vs target $1.000 = 90% → on-track → good', e.omzet.aktualUsd >= 900 && e.omzet.unit.find(u => u.studioId === S).aktualUsd === 900 && e.omzet.unit.find(u => u.studioId === S).targetUsd === 1000, JSON.stringify(e.omzet.unit.find(u => u.studioId === S)))
  cek('Koleksi: diterima 800.000 vs jatuh tempo belum dibayar 200.000 = 80% → good', e.koleksi.diterima === 800000 && e.koleksi.piutang === 200000 && e.koleksi.persen === 80 && e.koleksi.status === 'good', JSON.stringify(e.koleksi))
  cek('Beban order: 1 terbawa (C) + 3 baru... ', e.beban.carryOver >= 1 && e.beban.baru >= 2 && e.beban.completed >= 1, JSON.stringify(e.beban))
  cek('Ketepatan deadline: A & D terkirim, B belum (deadline 2031 masih di masa depan → berjalan) → 66,7% → critical', e.otd.rate === 66.7 && e.otd.rencana === 3 && e.otd.terkirim === 2 && e.otd.berjalan === 1 && e.kartu.find(k => k.kunci === 'otd').status === 'critical', JSON.stringify([e.otd.rate, e.otd.terkirim, e.otd.berjalan]))
  cek('Tingkat revisi: 2 selesai (A,D), 1 direvisi → 50% → critical', e.revisi.rate === 50 && e.revisi.selesai === 2 && e.kartu.find(k => k.kunci === 'revisi').status === 'critical')
  cek('Skor SDM: semua skor 4/5 → 8,0 (skala 10) → good', e.sdm.rata === 8 && e.kartu.find(k => k.kunci === 'sdm').status === 'good')
  cek('Enam kartu KPI tersusun', e.kartu.length === 6 && e.kartu.every(k => ['good', 'warn', 'critical', 'neutral'].includes(k.status)))
  r = await panggil(`${C}/eksekutif?bulan=${BLN}&studioId=${S}`, { token: koord.t }); cek('Koordinator melihat hanya unitnya (Keiko)', r.s === 200 && r.j.data.cakupan.length === 1 && r.j.data.omzet.aktualUsd === 900 && r.j.data.bisaAturTarget === true)

  console.log('— omzet tahunan, siklus, keterlambatan, ketepatan —')
  r = await panggil(`${C}/omzet?tahun=2031&studioId=${S}`, { token: koord.t }); cek('Omzet tahunan: Juli $900, target Juli $1.000, 12 bulan, garis dasar CPM', r.s === 200 && r.j.data.bulan.length === 12 && r.j.data.bulan[6].usd === 900 && r.j.data.bulan[6].targetUsd === 1000 && r.j.data.totalUsd === 900 && typeof r.j.data.cpmBaselineRp === 'number')
  r = await panggil(`${C}/omzet?tahun=1990`, { token: koord.t }); cek('Tahun tidak valid → 422', r.s === 422)
  r = await panggil(`${C}/siklus?studioId=${S}&minSampel=3`, { token: koord.t }); const sk = r.j.data
  const sketsa = sk.bottleneck.find(b => b.tahap === 'UJI-KZ Sketch')
  cek('Bottleneck: tahap "Sketch" 4 sampel, rata 2,5 hari (3+2+12?)…', !!sketsa && sketsa.jumlah === 4, JSON.stringify(sketsa))
  cek('Lead time: 2 order selesai terukur; revisi 50%', sk.ringkasan.order === 2 && sk.revisi.diukur === 2 && sk.revisi.persenDenganRevisi === 50 && sk.tren.length === 6, JSON.stringify([sk.ringkasan, sk.revisi]))
  r = await panggil(`${C}/siklus?studioId=${S}&minSampel=5`, { token: koord.t }); cek('minSampel 5 menyaring tahap bersampel < 5', !r.j.data.bottleneck.some(b => b.tahap === 'UJI-KZ Sketch'))
  const telat = await O('UJI-KZ E telat 10 hari', { status: 'PROSES', tanggalMasuk: new Date(Date.now() - 30 * 86400000), deadline: new Date(Date.now() - 10 * 86400000) })
  r = await panggil(`${C}/keterlambatan?studioId=${S}`, { token: koord.t }); const kt = r.j.data.daftar.find(x => x.orderId === telat.id)
  cek('Keterlambatan 6 bulan: order E telat ±10 hari muncul bernama unit', !!kt && kt.hariTelat >= 9 && kt.hariTelat <= 11 && kt.unit === 'Keiko' && r.j.data.telat >= 1, JSON.stringify(kt))
  r = await panggil(`${C}/ketepatan?studioId=${S}&bulan=12`, { token: koord.t }); cek('Ketepatan per unit (12 bulan): Keiko terdaftar', r.s === 200 && Array.isArray(r.j.data.perUnit))

  console.log('— tindakan Kaizen —')
  r = await panggil(`${C}/tindakan`, { method: 'POST', token: artA.t, body: { judul: 'x' } }); cek('Anggota biasa membuat tindakan → 403', r.s === 403)
  r = await panggil(`${C}/tindakan`, { method: 'POST', token: koord.t, body: { judul: '  ' } }); cek('Judul kosong → 422', r.s === 422)
  r = await panggil(`${C}/tindakan`, { method: 'POST', token: koord.t, body: { judul: 'UJI-KZ percepat QC', prioritas: 'GENTING' } }); cek('Prioritas tak dikenal → 422', r.s === 422)
  r = await panggil(`${C}/tindakan`, { method: 'POST', token: koord.t, body: { judul: 'UJI-KZ percepat QC', deskripsi: 'QC lama', sumberTab: 'siklus', snapshot: { rataHari: 4.2 }, pemilikId: artA.id, jatuhTempo: '2020-01-31', prioritas: 'TINGGI' } }); cek('Koordinator membuat tindakan', r.s === 201 && r.j.data.status === 'BARU' && r.j.data.prioritas === 'TINGGI'); const t1 = r.j.data?.id
  r = await panggil(`${C}/tindakan`, { token: koord.t }); const lst = r.j.data
  cek('Daftar: ringkasan baru ≥1, tindakan terlambat (jatuh tempo lewat), pemilik terbaca', lst.ringkasan.baru >= 1 && lst.tindakan.find(t => t.id === t1)?.terlambat === true && lst.tindakan.find(t => t.id === t1)?.pemilik === 'Uji kz_artA', JSON.stringify(lst.ringkasan))
  r = await panggil(`${C}/tindakan/${t1}`, { method: 'PATCH', token: koord.t, body: { status: 'LAMBAT' } }); cek('Status tak dikenal → 422', r.s === 422)
  r = await panggil(`${C}/tindakan/${t1}`, { method: 'PATCH', token: koord.t, body: { status: 'PROSES' } }); cek('Ubah ke PROSES', r.s === 200 && r.j.data.status === 'PROSES')
  r = await panggil(`${C}/tindakan/${t1}`, { method: 'PATCH', token: koord.t, body: { status: 'SELESAI', catatanHasil: 'QC turun jadi 2 hari' } }); cek('Selesai: selesaiPada terisi + catatan hasil', r.s === 200 && r.j.data.status === 'SELESAI' && !!r.j.data.selesaiPada && r.j.data.catatanHasil === 'QC turun jadi 2 hari')
  r = await panggil(`${C}/tindakan/${t1}`, { method: 'PATCH', token: koord.t, body: { status: 'PROSES' } }); cek('Dibuka lagi: selesaiPada dikosongkan', r.j.data.selesaiPada === null)
  r = await panggil(`${C}/tindakan/${t1}`, { method: 'PATCH', token: kepala.tNaya }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil(`${C}/tindakan?status=PROSES`, { token: koord.t }); cek('Filter status PROSES', r.j.data.tindakan.every(t => t.status === 'PROSES') && r.j.data.tindakan.some(t => t.id === t1))
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.kaizenTindakan.deleteMany({ where: { judul: { startsWith: 'UJI-KZ' } } })
  await prisma.targetOmsetUnit.deleteMany({ where: { studioId: keiko.id, tahun: 2031 } })
  await prisma.weeklyReport.deleteMany({ where: { studioId: keiko.id, periodeAwal: { gte: new Date('2031-01-01'), lt: new Date('2032-01-01') } } })
  await prisma.penilaianKader.deleteMany({ where: { tanggalPenilaian: { gte: new Date('2031-01-01'), lt: new Date('2032-01-01') } } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-KZ' } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
