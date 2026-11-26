import { DASH } from './_jalur.mjs'
// Uji JAM KERJA PER UNIT + PULANG OTOMATIS (16 Nov 2026, masukan timunit uji): (1) fungsi murni memakai jadwal unit; (2) wewenang
// pengaturan (Koordinator ya; Admin Market & talent tidak) + validasi; (3) presensi memakai jadwal unit (jam resmi, unit tercatat di MASUK,
// Kehadiran tim, terlambat); (4) pulang otomatis: sesi tanpa pulang ditutup pada jam pulang resmi, bertanda otomatis, tanpa lembur, izin keluar
// yang terbuka ikut ditutup, tidak dobel, sesi sebelum aktifSejak tidak disentuh. Pengaturan unit Keiko dikembalikan & data uji dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const H = await import(DASH + '/server/src/utils/kehadiran.js')
const J = await import(DASH + '/server/src/utils/jamKerjaUnit.js')
const { jamKerja } = await import(DASH + '/server/src/utils/jamKerja.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.50.7.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-jku-' + T, 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const lama = await prisma.jamKerjaUnit.findUnique({ where: { studioId: S } })
const JADWAL_UJI = { 1: { kerja: ['08:30', '16:30'], istirahat: ['11:30', '13:00'] }, 2: { kerja: ['08:30', '16:30'], istirahat: ['11:30', '13:00'] }, 3: { kerja: ['08:30', '16:30'], istirahat: ['11:30', '13:00'] }, 4: { kerja: ['08:30', '16:30'], istirahat: ['11:30', '13:00'] }, 5: { kerja: ['08:30', '16:30'], istirahat: ['11:30', '13:30'] }, 6: null }
// hari kerja (Senin–Jumat) terakhir yang bukan libur kalender, ≤ hari ini — tempat menguji presensi lampau
const libur = new Set((await prisma.hariLiburKerja.findMany({ select: { tanggal: true } })).map(l => l.tanggal.toISOString().slice(0, 10)))
let tglUji = H.hariIniWIB(); for (let i = 0; i < 14; i++) { const d = new Date(tglUji + 'T00:00:00Z').getUTCDay(); if (d >= 1 && d <= 5 && !libur.has(tglUji)) break; tglUji = new Date(new Date(tglUji + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10) }
const W = (jam) => new Date(`${tglUji}T${jam}:00+07:00`)
try {
  console.log('— (1) fungsi murni —')
  const jd = J.jadwalDariSimpan(JADWAL_UJI)
  const jr = H.jamResmi(tglUji, new Map(), jd)
  cek('jamResmi memakai jadwal unit (08:30–16:30, istirahat 11:30–13:00 / Jumat 13:30)', jr.label === '08:30 – 16:30 WIB' && /^11:30 – 13:(00|30) WIB$/.test(jr.labelIstirahat), `${jr.label} · ${jr.labelIstirahat}`)
  cek('Sabtu = libur di jadwal unit', H.jamResmi('2026-11-14', new Map(), jd) === null)
  const l = H.lemburOtomatis({ tgl: tglUji, pulang: W('17:10'), hariKhusus: new Map(), jadwal: jd })
  cek('Lembur otomatis dihitung dari jam pulang unit (+30 mnt toleransi): pulang 17:10 → 10 mnt', l?.menit === 10, JSON.stringify(l?.menit))
  cek('Tanpa jadwal unit tetap jadwal bawaan (pulang 17:10 belum lembur)', H.lemburOtomatis({ tgl: tglUji, pulang: W('17:10'), hariKhusus: new Map() }) === null)
  cek('Jam kerja bersih Analitik memakai jadwal unit (08:30–16:30 minus istirahat)', jamKerja(W('08:30'), W('16:30'), new Set(), jd) === (new Date(tglUji + 'T00:00:00Z').getUTCDay() === 5 ? 6 : 6.5), String(jamKerja(W('08:30'), W('16:30'), new Set(), jd)))
  cek('Validasi: pulang sebelum masuk ditolak', !!J.validasiJadwal({ 1: { kerja: ['17:00', '09:00'], istirahat: [] } }).galat)
  cek('Validasi: istirahat di luar jam kerja ditolak', !!J.validasiJadwal({ 1: { kerja: ['09:00', '17:00'], istirahat: ['17:00', '18:00'] } }).galat)
  cek('Validasi: istirahat kosong = tanpa istirahat', J.validasiJadwal({ 1: { kerja: ['09:00', '15:00'], istirahat: [] } }).data?.[1]?.istirahat?.join() === '09:00,09:00')

  console.log('— (2) wewenang & simpan —')
  const koord = await user('jku_koord', [['KOORDINATOR', S]]), adm = await user('jku_adm', [['KARYAWAN', S]]), tal = await user('jku_tal', [['KARYAWAN', S]]), tal2 = await user('jku_tal2', [['KARYAWAN', S]])
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.jamKerjaUnit.deleteMany({ where: { studioId: S } })
  let r = await panggil(`/api/circle/kehadiran/jam-kerja?studioId=${S}`, { token: koord.t })
  cek('Koordinator: belum diatur → jadwal bawaan (Senin 09:00–17:00)', r.s === 200 && r.j.data.diatur === false && r.j.data.jadwal[1].kerja.join() === '09:00,17:00', String(r.s))
  r = await panggil(`/api/circle/kehadiran/jam-kerja?studioId=${S}`, { token: adm.t }); cek('Admin Market → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/kehadiran/jam-kerja?studioId=${S}`, { token: tal.t }); cek('Talent → 403', r.s === 403, String(r.s))
  r = await panggil('/api/circle/kehadiran/jam-kerja', { method: 'PUT', token: adm.t, body: { studioId: S, jadwal: JADWAL_UJI } }); cek('Admin Market menyimpan → 403', r.s === 403, String(r.s))
  r = await panggil('/api/circle/kehadiran/jam-kerja', { method: 'PUT', token: koord.t, body: { studioId: S, jadwal: JADWAL_UJI, pulangOtomatis: true, batasPulang: '16:00' } }); cek('Batas pulang otomatis lebih awal dari jam pulang → 422', r.s === 422, String(r.s))
  r = await panggil('/api/circle/kehadiran/jam-kerja', { method: 'PUT', token: koord.t, body: { studioId: S, jadwal: { ...JADWAL_UJI, 1: { kerja: ['08:30', '16:30'], istirahat: ['07:00', '08:00'] } } } }); cek('Istirahat di luar jam kerja → 422', r.s === 422, String(r.s))
  r = await panggil('/api/circle/kehadiran/jam-kerja', { method: 'PUT', token: koord.t, body: { studioId: S, jadwal: JADWAL_UJI, pulangOtomatis: true, batasPulang: '17:30' } })
  cek('Koordinator menyimpan jam kerja unit uji + pulang otomatis 17:30', r.s === 200 && r.j.data.diatur && r.j.data.pulangOtomatis && r.j.data.batasPulang === '17:30' && r.j.data.jadwal[6] === null && !!r.j.data.aktifSejak, `${r.s} ${r.j.message ?? ''}`)

  console.log('— (3) presensi memakai jadwal unit —')
  r = await panggil(`/api/circle/kehadiran/hari-ini?studioId=${S}`, { token: tal.t })
  const libHariIni = r.j.data?.jenisHari !== 'KERJA'
  cek('Hari ini (talent): jam resmi dari unit + info pulang otomatis', r.s === 200 && (libHariIni || r.j.data.jamResmi === '08:30 – 16:30 WIB') && r.j.data.pulangOtomatisJam === '17:30', `${r.j.data?.jamResmi} · ${r.j.data?.pulangOtomatisJam}`)
  if (!libHariIni) {
    r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: tal.t, body: { jenis: 'MASUK', modeKerja: 'WFO', studioId: S } })
    const ev = await prisma.kehadiranEvent.findFirst({ where: { userId: tal.id, jenis: 'MASUK' } })
    cek('Presensi datang mencatat unitnya', r.s === 201 && ev?.studioId === S, `${r.s} ${ev?.studioId}`)
    await prisma.kehadiranEvent.deleteMany({ where: { userId: tal.id } })
  }
  // presensi lampau (tglUji) untuk roster & terlambat: masuk 08:45 → terlambat 15 mnt menurut jadwal unit (bawaan 09:00 tidak terlambat)
  await prisma.kehadiranEvent.create({ data: { userId: tal2.id, tanggalKerja: new Date(tglUji + 'T00:00:00Z'), jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('08:45'), studioId: S } })
  r = await panggil(`/api/circle/kehadiran/roster?studioId=${S}&tanggal=${tglUji}`, { token: koord.t }); const rb = r.j.data?.hadir?.find(h => h.userId === tal2.id)
  cek('Kehadiran tim: jam resmi unit & masuk 08:45 = terlambat 15 mnt', r.s === 200 && r.j.data.jamResmi === '08:30 – 16:30 WIB' && rb?.terlambat === true && rb.menitTerlambat === 15, JSON.stringify({ jam: r.j.data?.jamResmi, rb }))
  r = await panggil(`/api/circle/kehadiran/terlambat?studioId=${S}&bulan=${tglUji.slice(0, 7)}`, { token: koord.t }); const tb = r.j.data?.orang?.find(o => o.userId === tal2.id)
  cek('Rekap terlambat memakai jam masuk unit', r.s === 200 && tb?.kejadian?.some(k => k.tanggal === tglUji && k.menit === 15 && k.jamResmi === '08:30'), JSON.stringify(tb?.kejadian))
  await prisma.kehadiranEvent.deleteMany({ where: { userId: tal2.id } })

  console.log('— (4) pulang otomatis —')
  const tglD = new Date(tglUji + 'T00:00:00Z')
  await prisma.jamKerjaUnit.update({ where: { studioId: S }, data: { aktifSejak: W('00:01') } })
  // A: masuk 08:40 (unit tercatat) tanpa pulang · B: masuk tanpa unit (orang satu unit) + izin keluar 16:00 yang belum kembali · C: sudah pulang · D: masuk sebelum aktifSejak
  await prisma.kehadiranEvent.create({ data: { userId: tal.id, tanggalKerja: tglD, jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('08:40'), studioId: S } })
  await prisma.kehadiranEvent.createMany({ data: [{ userId: tal2.id, tanggalKerja: tglD, jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('09:00') }, { userId: tal2.id, tanggalKerja: tglD, jenis: 'KELUAR', jenisKeluar: 'KELUAR_STUDIO', dicatatPada: W('16:00') }] })
  await prisma.kehadiranEvent.createMany({ data: [{ userId: koord.id, tanggalKerja: tglD, jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('08:30'), studioId: S }, { userId: koord.id, tanggalKerja: tglD, jenis: 'PULANG', dicatatPada: W('16:40'), studioId: S }] })
  let hasil = await J.tutupPulangOtomatis(W('17:20'))
  cek('Sebelum jam batas (17:20) belum ada yang ditutup', (await prisma.kehadiranEvent.count({ where: { userId: { in: [tal.id, tal2.id] }, jenis: 'PULANG' } })) === 0, JSON.stringify(hasil))
  hasil = await J.tutupPulangOtomatis(W('17:40'))
  const pA = await prisma.kehadiranEvent.findFirst({ where: { userId: tal.id, jenis: 'PULANG' } })
  cek('Sesi A ditutup: pulang = jam pulang resmi 16:30, bertanda otomatis', pA?.otomatis === true && pA.dicatatPada.getTime() === W('16:30').getTime(), JSON.stringify({ o: pA?.otomatis, t: pA && H.jamTeks(pA.dicatatPada) }))
  const evB = await prisma.kehadiranEvent.findMany({ where: { userId: tal2.id }, orderBy: [{ dicatatPada: 'asc' }, { id: 'asc' }] })
  cek('Sesi B (MASUK tanpa unit, orang satu unit) ditutup + izin keluar ikut ditutup', evB.some(e => e.jenis === 'KEMBALI' && e.otomatis) && evB.some(e => e.jenis === 'PULANG' && e.otomatis) && H.statusSesi(evB).status === 'pulang', evB.map(e => e.jenis).join(','))
  cek('Sesi yang sudah pulang tidak disentuh', (await prisma.kehadiranEvent.count({ where: { userId: koord.id, jenis: 'PULANG' } })) === 1)
  cek('Pulang otomatis tidak membuat lembur', (await prisma.lemburKehadiran.count({ where: { userId: { in: [tal.id, tal2.id] } } })) === 0)
  const lagi = await J.tutupPulangOtomatis(W('17:50'))
  cek('Dipanggil ulang tidak dobel', (await prisma.kehadiranEvent.count({ where: { userId: tal.id, jenis: 'PULANG' } })) === 1 && lagi.ditutup === 0, JSON.stringify(lagi))
  r = await panggil(`/api/circle/kehadiran/riwayat?hari=14&studioId=${S}`, { token: tal.t }); const hr = (r.j.data ?? []).find(x => x.tanggal === tglUji)
  cek('Riwayat: pulang 16:30 (otomatis), jam kerja terhitung (bukan "Lupa pulang")', hr?.pulang === '16:30' && hr.pulangOtomatis === true && hr.lupaPulang === false && hr.menitKerja > 0, JSON.stringify({ p: hr?.pulang, o: hr?.pulangOtomatis, k: hr?.labelKerja }))
  // D: sesi sebelum pulang otomatis dinyalakan tidak diubah
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: [tal.id, tal2.id, koord.id] } } })
  await prisma.jamKerjaUnit.update({ where: { studioId: S }, data: { aktifSejak: W('12:00') } })
  await prisma.kehadiranEvent.create({ data: { userId: tal.id, tanggalKerja: tglD, jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('08:40'), studioId: S } })
  await J.tutupPulangOtomatis(W('17:40'))
  cek('Sesi sebelum pulang otomatis diaktifkan tidak disentuh', (await prisma.kehadiranEvent.count({ where: { userId: tal.id, jenis: 'PULANG' } })) === 0)
  await prisma.jamKerjaUnit.update({ where: { studioId: S }, data: { pulangOtomatis: false } })
  await prisma.kehadiranEvent.deleteMany({ where: { userId: tal.id } })
  await prisma.kehadiranEvent.create({ data: { userId: tal.id, tanggalKerja: tglD, jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: W('12:30'), studioId: S } })
  await J.tutupPulangOtomatis(W('17:40'))
  cek('Pulang otomatis mati → tidak ada yang ditutup', (await prisma.kehadiranEvent.count({ where: { userId: tal.id, jenis: 'PULANG' } })) === 0)
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.jamKerjaUnit.deleteMany({ where: { studioId: S } })
  if (lama) await prisma.jamKerjaUnit.create({ data: lama })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
