import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const H = await import(DASH + '/server/src/utils/kehadiran.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.39.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const W = (s) => new Date(s + '+07:00')

console.log('— logika murni (jam kerja OGS) —')
const sel = '2031-07-08', jum = '2031-07-11', sab = '2031-07-12', min = '2031-07-13'
cek('Hari: Minggu libur, Selasa kerja', H.jenisHari(min) === 'LIBUR_MINGGU' && H.jenisHari(sel) === 'KERJA')
cek('Jam resmi Selasa 09–17, Jumat istirahat 11:30–13:30', H.jamResmi(sel).label.includes('09') && H.jamResmi(jum).labelIstirahat.includes('11.30') || H.jamResmi(jum).labelIstirahat.includes('11:30'))
cek('Minggu tanpa jam resmi', H.jamResmi(min) == null)
cek('Libur khusus menghilangkan jam kerja', H.jamResmi(sel, new Map([[sel, 'LIBUR']])) == null && H.jamResmi(sel, new Map([[sel, 'WFA']])) != null)
const lm = H.lemburOtomatis({ tgl: sel, pulang: W('2031-07-08T18:30') })
cek('Lembur otomatis: pulang 18:30 → mulai 17:30, 60 menit', lm?.menit === 60)
cek('Pulang 17:30 (dalam toleransi) → tanpa lembur', H.lemburOtomatis({ tgl: sel, pulang: W('2031-07-08T17:30') }) === null)
const po = H.potonganIstirahat({ tgl: sel, masuk: W('2031-07-08T09:00'), pulang: W('2031-07-08T17:00'), pasang: [] })
cek('Istirahat otomatis 12–13 = 60 menit; kerja bersih 7 jam', po.otomatis === 60 && H.menitKerjaBersih({ masuk: W('2031-07-08T09:00'), pulang: W('2031-07-08T17:00'), potongan: po }) === 420)
cek('Rekap: terlambat & tidak hadir terhitung', (() => { const r = H.rekapBulan({ anggota: [{ id: 'a', nama: 'A' }], rentangHari: [sel, '2031-07-09'], hariKhusus: new Map(), masukPertama: new Map([[`a|${sel}`, W('2031-07-08T09:20')]]), cuti: [], lembur: [] }); return r.hariKerja === 2 && r.orang[0].hariTerlambat === 1 && r.orang[0].hariTidakHadir === 1 })())
cek('Acara mingguan jatuh 7 hari kemudian; berhenti setelah dihentikan', H.acaraPadaTanggal({ tanggal: sel, berulang: 'MINGGUAN' }, '2031-07-15') && !H.acaraPadaTanggal({ tanggal: sel, berulang: 'MINGGUAN' }, '2031-07-16') && !H.acaraPadaTanggal({ tanggal: sel, berulang: 'MINGGUAN', berulangDihentikan: '2031-07-10' }, '2031-07-15'))

const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, K = '/api/circle/kehadiran', today = H.hariIniWIB()
const kerjaHariIni = !H.hariLibur(today, new Map())
try {
  const koord = await user('kh_koord', [['KOORDINATOR', S]]), kepala = await user('kh_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]])
  const a = await user('kh_a', [['KARYAWAN', S]]), b = await user('kh_b', [['KARYAWAN', S]]), lain = await user('kh_lain', [['KOORDINATOR', pibi.id]])

  console.log('— akses —')
  let r = await panggil(`${K}/hari-ini`, { token: a.t, web: 'app' }); cek('Tanpa alamat circle → 403', r.s === 403)
  r = await panggil(`${K}/hari-ini`, { token: a.tNaya }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil(`${K}/roster?studioId=${S}`, { token: a.t }); cek('Anggota biasa membuka roster → 403', r.s === 403)
  r = await panggil(`${K}/roster?studioId=${S}`, { token: lain.t }); cek('Koordinator unit lain membuka roster → 403', r.s === 403)
  r = await panggil(`${K}/roster?studioId=${S}`, { token: koord.t }); cek('Koordinator melihat roster unitnya', r.s === 200 && r.j.data.jumlah.anggota >= 3)

  console.log('— presensi —')
  if (kerjaHariIni) {
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'MASUK' } }); cek('Masuk tanpa mode kerja → 422', r.s === 422)
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'MASUK', modeKerja: 'WFA' } }); cek('WFA tanpa lokasi → 422', r.s === 422)
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'MASUK', modeKerja: 'WFO' } }); cek('Masuk WFO → 201', r.s === 201)
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'MASUK', modeKerja: 'WFO' } }); cek('Masuk dua kali → 422', r.s === 422)
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'KELUAR', jenisKeluar: 'SHOLAT' } }); cek('Keluar sholat → 201', r.s === 201)
    r = await panggil(`${K}/hari-ini`, { token: a.t }); cek('Status keluar sementara', r.j.data.sesi === 'keluar_sementara')
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'KEMBALI' } }); cek('Kembali → 201', r.s === 201)
    r = await panggil(`${K}/catat`, { method: 'POST', token: a.t, body: { jenis: 'PULANG' } }); cek('Pulang → 201', r.s === 201)
    r = await panggil(`${K}/hari-ini`, { token: a.t }); cek('Status pulang, ada pasangan keluar', r.j.data.sesi === 'pulang' && r.j.data.pasanganKeluar.length === 1)
    r = await panggil(`${K}/riwayat?hari=5`, { token: a.t }); cek('Riwayat 5 hari memuat hari ini hadir', r.s === 200 && r.j.data.length === 5 && r.j.data[0].status === 'hadir')
    r = await panggil(`${K}/roster?studioId=${S}`, { token: koord.t }); cek('Roster: A hadir, B tidak hadir', r.j.data.hadir.some(x => x.userId === a.id) && r.j.data.tidakHadir.some(x => x.userId === b.id))
  } else console.log('(hari ini libur — uji presensi dilewati)')

  console.log('— cuti & persetujuan —')
  const bsk = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  r = await panggil(`${K}/cuti`, { method: 'POST', token: b.t, body: { jenis: 'XX', mulai: bsk, selesai: bsk, alasan: 'x' } }); cek('Jenis cuti salah → 422', r.s === 422)
  r = await panggil(`${K}/cuti`, { method: 'POST', token: b.t, body: { jenis: 'SAKIT', mulai: bsk, selesai: '2020-01-01', alasan: 'x' } }); cek('Selesai sebelum mulai → 422', r.s === 422)
  r = await panggil(`${K}/cuti`, { method: 'POST', token: b.t, body: { jenis: 'SAKIT', mulai: bsk, selesai: bsk, alasan: '' } }); cek('Alasan kosong → 422', r.s === 422)
  r = await panggil(`${K}/cuti`, { method: 'POST', token: b.t, body: { jenis: 'SAKIT', mulai: bsk, selesai: bsk, alasan: 'Demam' } }); cek('Ajukan izin → 201', r.s === 201); const cutiId = r.j.data?.id
  r = await panggil(`${K}/cuti`, { method: 'POST', token: b.t, body: { jenis: 'IZIN', mulai: bsk, selesai: bsk, alasan: 'Tabrakan' } }); cek('Tumpang tindih → 422', r.s === 422)
  r = await panggil(`${K}/kotak-cuti?studioId=${S}`, { token: koord.t }); cek('Kotak cuti koordinator memuat pengajuan B', r.s === 200 && r.j.data.menunggu.some(x => x.id === cutiId && x.pemohonId === b.id))
  r = await panggil(`${K}/cuti/${cutiId}/setujui`, { method: 'POST', token: a.t }); cek('Anggota biasa menyetujui → 403', r.s === 403)
  r = await panggil(`${K}/cuti/${cutiId}/setujui`, { method: 'POST', token: lain.t }); cek('Koordinator unit lain menyetujui → 403', r.s === 403)
  r = await panggil(`${K}/cuti/${cutiId}/tolak`, { method: 'POST', token: koord.t, body: {} }); cek('Tolak tanpa alasan → 422', r.s === 422)
  r = await panggil(`${K}/cuti/${cutiId}/setujui`, { method: 'POST', token: koord.t }); cek('Koordinator menyetujui → 200', r.s === 200)
  r = await panggil(`${K}/cuti/${cutiId}/setujui`, { method: 'POST', token: koord.t }); cek('Setujui ulang → 409', r.s === 409)
  r = await panggil(`${K}/cuti/${cutiId}/batal`, { method: 'POST', token: b.t }); cek('Batalkan yang sudah disetujui → 409', r.s === 409)
  const ck = await panggil(`${K}/cuti`, { method: 'POST', token: koord.t, body: { jenis: 'CUTI', mulai: bsk, selesai: bsk, alasan: 'Libur sendiri' } })
  r = await panggil(`${K}/cuti/${ck.j.data.id}/setujui`, { method: 'POST', token: koord.t }); cek('Menyetujui izin diri sendiri → 403', r.s === 403)
  r = await panggil(`${K}/cuti/${ck.j.data.id}/setujui`, { method: 'POST', token: kepala.t }); cek('Kepala Circle menyetujui izin koordinator → 200', r.s === 200)
  r = await panggil(`${K}/cuti`, { token: b.t }); cek('Daftar izin saya memuat status DISETUJUI', r.j.data.cuti.some(x => x.id === cutiId && x.status === 'DISETUJUI'))

  console.log('— rekap & terlambat —')
  r = await panggil(`${K}/rekap?studioId=${S}&bulan=${today.slice(0, 7)}`, { token: koord.t }); cek('Rekap bulan ini', r.s === 200 && Array.isArray(r.j.data.orang))
  r = await panggil(`${K}/rekap?studioId=${S}&bulan=bukan`, { token: koord.t }); cek('Bulan tidak valid → 422', r.s === 422)
  r = await panggil(`${K}/terlambat?studioId=${S}&bulan=${today.slice(0, 7)}`, { token: koord.t }); cek('Daftar terlambat', r.s === 200 && Array.isArray(r.j.data.orang))
  r = await panggil(`${K}/rekap?studioId=${S}`, { token: a.t }); cek('Rekap oleh anggota biasa → 403', r.s === 403)

  console.log('— check-in harian (pribadi) —')
  const CI = '/api/circle/checkin'
  r = await panggil(`${CI}`, { method: 'POST', token: a.t, body: { emosi: 'tenang', intensitas: 9, kejernihan: 3, fokusPikiran: 'pekerjaan', kebutuhan: 'fokus' } }); cek('Intensitas di luar 1–5 → 422', r.s === 422)
  r = await panggil(`${CI}`, { method: 'POST', token: a.t, body: { emosi: 'cemas', intensitas: 4, kejernihan: 2, fokusPikiran: 'masalah', kebutuhan: 'bantuan_tim' } }); cek('Isi check-in → 201', r.s === 201)
  r = await panggil(`${CI}`, { method: 'POST', token: a.t, body: { emosi: 'cemas', intensitas: 4, kejernihan: 2, fokusPikiran: 'masalah', kebutuhan: 'bantuan_tim' } }); cek('Isi dua kali → 409', r.s === 409)
  r = await panggil(`${CI}/lewati`, { method: 'POST', token: b.t }); cek('Lewati → 201', r.s === 201)
  r = await panggil(`${CI}/hari-ini`, { token: a.t }); cek('Milik sendiri terbaca (emosi Cemas)', r.j.data.hariIni?.emosi === 'cemas' && r.j.data.perluDiisi === false)
  r = await panggil(`${CI}/tim?studioId=${S}`, { token: koord.t })
  cek('Koordinator melihat agregat', r.s === 200)
  cek('Koordinator TIDAK melihat isian per orang (tanpa id pengisi)', !JSON.stringify(r.j).includes(a.id) && !JSON.stringify(r.j).includes(b.id))
  r = await panggil(`${CI}/tim?studioId=${S}`, { token: a.t }); cek('Anggota biasa membuka agregat tim → 403', r.s === 403)

  console.log('— kalender —')
  const KL = '/api/circle/kalender'
  r = await panggil(`${KL}/acara`, { method: 'POST', token: koord.t, body: { judul: 'Rapat', tanggal: sel } }); cek('Koordinator membuat acara → 403', r.s === 403)
  r = await panggil(`${KL}/acara`, { method: 'POST', token: kepala.t, body: { judul: '', tanggal: sel } }); cek('Judul kosong → 422', r.s === 422)
  r = await panggil(`${KL}/acara`, { method: 'POST', token: kepala.t, body: { judul: 'UJI-KH Rapat mingguan', tanggal: sel, berulang: 'MINGGUAN', mulai: '10:00', selesai: '09:00' } }); cek('Selesai sebelum mulai → 422', r.s === 422)
  r = await panggil(`${KL}/acara`, { method: 'POST', token: kepala.t, body: { judul: 'UJI-KH Rapat mingguan', tanggal: sel, berulang: 'MINGGUAN', mulai: '10:00', selesai: '11:00' } }); cek('Kepala Circle membuat acara berulang → 201', r.s === 201); const acId = r.j.data?.id
  r = await panggil(`${KL}?bulan=2031-07`, { token: a.t }); cek('Anggota melihat kalender; acara muncul 4× (8,15,22,29)', r.s === 200 && r.j.data.hari.filter(h => h.acara.some(x => x.id === acId)).length === 4 && r.j.data.bisaKelola === false)
  r = await panggil(`${KL}/acara/${acId}/hentikan`, { method: 'POST', token: kepala.t }); cek('Hentikan pengulangan → 200', r.s === 200)
  r = await panggil(`${KL}/acara/${acId}`, { method: 'PATCH', token: kepala.t, body: { judul: 'UJI-KH Rapat (ubah)' } }); cek('Ubah judul → 200', r.s === 200)
  r = await panggil(`${KL}/acara/${acId}`, { method: 'DELETE', token: lain.t }); cek('Koordinator lain menghapus → 403', r.s === 403)
  r = await panggil(`${KL}/acara/${acId}`, { method: 'DELETE', token: kepala.t }); cek('Kepala Circle menghapus → 200', r.s === 200)
} finally {
  await prisma.acaraKalender.deleteMany({ where: { judul: { startsWith: 'UJI-KH' } } })
  await prisma.checkInHarian.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.cutiKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
