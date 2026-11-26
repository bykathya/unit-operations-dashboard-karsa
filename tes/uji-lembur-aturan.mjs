import { DASH } from './_jalur.mjs'
// Uji ATURAN LEMBUR PER UNIT (21 Okt 2026): perhitungan murni (utils/lembur.js) + alur API (koordinator mengatur, lembur manual menunggu
// persetujuan, Payroll hanya mengklaim lembur DISETUJUI milik unitnya, dihitung dengan aturan unit). Data sementara dihapus di akhir.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { hitungLembur, validasiAturan, statusAwal } = await import(DASH + '/server/src/utils/lembur.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }

console.log('— perhitungan murni —')
const d = (tgl, menit, status = 'DISETUJUI') => ({ tanggalKerja: new Date(tgl + 'T00:00:00Z'), menit, status })
// 2031-03-03 Senin (kerja), 2031-03-09 Minggu (libur), 2031-03-04 Selasa ditandai LIBUR nasional
const hk = new Map([['2031-03-04', 'LIBUR']])
let h = hitungLembur([d('2031-03-03', 90)], { mode: 'PER_JAM', tarifPerJam: 20000 }, hk); cek('Per jam: 90 menit × Rp20.000/jam = Rp30.000', h.uang === 30000 && h.jam === 1.5 && h.hari === 1)
h = hitungLembur([d('2031-03-03', 90, 'MENUNGGU'), d('2031-03-03', 30, 'DITOLAK')], { mode: 'PER_JAM', tarifPerJam: 20000 }); cek('Hanya DISETUJUI yang dihitung (menunggu/ditolak = 0)', h.uang === 0 && h.menit === 0)
h = hitungLembur([d('2031-03-03', 25), d('2031-03-05', 45)], { mode: 'PER_JAM', tarifPerJam: 60000, minimalMenit: 30 }); cek('Minimal 30 menit/hari: hari 25 menit tidak dihitung', h.menit === 45 && h.uang === 45000 && h.hari === 1)
h = hitungLembur([d('2031-03-03', 50)], { mode: 'PER_JAM', tarifPerJam: 60000, pembulatanMenit: 30 }); cek('Pembulatan 30 menit ke bawah: 50 → 30 menit', h.menit === 30 && h.uang === 30000)
h = hitungLembur([d('2031-03-09', 60), d('2031-03-04', 60), d('2031-03-03', 60)], { mode: 'PER_JAM', tarifPerJam: 10000, pengaliLibur: 2 }, hk); cek('Hari libur (Minggu & libur nasional) × 2', h.uang === 20000 + 20000 + 10000)
h = hitungLembur([d('2031-03-03', 240)], { mode: 'BERTINGKAT', tingkat: [{ sampaiJam: 2, tarifPerJam: 10000 }, { sampaiJam: null, tarifPerJam: 15000 }] }); cek('Bertingkat: 2 jam × 10rb + 2 jam × 15rb = 50rb', h.uang === 50000)
h = hitungLembur([d('2031-03-03', 30), d('2031-03-03', 30), d('2031-03-05', 200)], { mode: 'PER_HARI', tarifPerHari: 50000 }); cek('Per hari: 2 hari lembur × Rp50.000 (dua catatan sehari = satu hari)', h.uang === 100000 && h.hari === 2)
h = hitungLembur([d('2031-03-03', 600), d('2031-03-05', 600)], { mode: 'PER_JAM', tarifPerJam: 10000, batasJamBulanan: 12 }); cek('Batas 12 jam/bulan: 20 jam dipotong jadi 12', h.jam === 12 && h.uang === 120000)
h = hitungLembur([d('2031-03-03', 120)], { mode: 'TIDAK_DIBAYAR' }); cek('Tidak dibayar: dicatat (2 jam) tapi Rp0, tidak berbayar', h.jam === 2 && h.uang === 0 && !h.adaTarif)
h = hitungLembur([d('2031-03-03', 120)], null); cek('Tanpa aturan: acuan saja (Rp0)', h.uang === 0 && !h.adaTarif)
cek('Validasi: per jam tanpa tarif → galat', !!validasiAturan({ mode: 'PER_JAM' }).galat)
cek('Validasi: bertingkat batas tidak naik → galat', !!validasiAturan({ mode: 'BERTINGKAT', tingkat: [{ sampaiJam: 2, tarifPerJam: 1 }, { sampaiJam: 1, tarifPerJam: 2 }, { tarifPerJam: 3 }] }).galat)
cek('Validasi: pembulatan 7 menit → galat', !!validasiAturan({ mode: 'PER_JAM', tarifPerJam: 1, pembulatanMenit: 7 }).galat)
cek('Validasi: aturan sah diterima', !validasiAturan({ mode: 'BERTINGKAT', tingkat: [{ sampaiJam: 2, tarifPerJam: 10000 }, { tarifPerJam: 15000 }], pengaliLibur: 1.5 }).galat)
cek('Status awal: manual MENUNGGU (bawaan), otomatis DISETUJUI', statusAwal('MANUAL', null) === 'MENUNGGU' && statusAwal('OTOMATIS', null) === 'DISETUJUI' && statusAwal('MANUAL', { perluPersetujuan: false }) === 'DISETUJUI')

console.log('— alur API —')
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.37.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id
const aturanLama = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
try {
  const koord = await user('la_koord', [['KOORDINATOR', S]]), kar = await user('la_kar', [['KARYAWAN', S]]), kader = await user('la_kader', [['KADER', S]])
  const dua = await user('la_dua', [['KARYAWAN', S], ['KARYAWAN', pibi.id]])

  let r = await panggil(`/api/circle/lembur/aturan?studioId=${S}`, { token: kader.c }); cek('Kader membuka aturan lembur → 403', r.s === 403)
  r = await panggil(`/api/circle/lembur/aturan`, { method: 'PUT', token: koord.c, body: { studioId: S, mode: 'PER_JAM' } }); cek('Aturan per jam tanpa tarif → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/aturan`, { method: 'PUT', token: koord.c, body: { studioId: S, mode: 'PER_JAM', tarifPerJam: 30000, minimalMenit: 30, pembulatanMenit: 30, pengaliLibur: 2, perluPersetujuan: true } })
  cek('Koordinator menyimpan aturan unitnya', r.s === 200 && r.j.data.aturan.tarifPerJam === 30000 && r.j.data.aturan.pembulatanMenit === 30)

  // lembur manual lewat presensi sungguhan: masuk → pulang → lembur
  await prisma.kehadiranEvent.deleteMany({ where: { userId: kar.id } })
  r = await panggil(`/api/circle/kehadiran/catat`, { method: 'POST', token: kar.c, body: { jenis: 'MASUK', modeKerja: 'WFO' } })
  r = await panggil(`/api/circle/kehadiran/catat`, { method: 'POST', token: kar.c, body: { jenis: 'PULANG' } })
  r = await panggil(`/api/circle/kehadiran/lembur`, { method: 'POST', token: kar.c, body: { mulai: '19:00', selesai: '21:15', catatan: 'UJI-LA kejar deadline', studioId: S } })
  const idManual = r.j.data?.id
  cek('Lembur manual tercatat MENUNGGU persetujuan, di unit Keiko', r.s === 201 && r.j.data.status === 'MENUNGGU' && (await prisma.lemburKehadiran.findUnique({ where: { id: idManual } }))?.studioId === S, `${r.s} ${r.j.message ?? ''}`)

  // data periode uji (2031-03): baris langsung supaya tanggalnya pasti
  const tgl = (s) => new Date(s + 'T00:00:00Z'), jam = (s, h) => new Date(`${s}T${h}:00+07:00`)
  const buatL = (userId, studioId, tanggal, menit, status) => prisma.lemburKehadiran.create({ data: { userId, studioId, status, tanggalKerja: tgl(tanggal), sumber: 'MANUAL', mulai: jam(tanggal, '18:00'), selesai: jam(tanggal, '20:00'), menit, catatan: 'UJI-LA' } })
  const lMenunggu = await buatL(kar.id, S, '2031-03-03', 100, 'MENUNGGU')
  await buatL(kar.id, S, '2031-03-05', 60, 'DISETUJUI')
  await buatL(dua.id, pibi.id, '2031-03-05', 120, 'DISETUJUI') // lembur di unit LAIN → tidak boleh diklaim Payroll Keiko
  await buatL(dua.id, S, '2031-03-06', 60, 'DISETUJUI')

  r = await panggil(`/api/circle/lembur/usulan?studioId=${S}&bulan=2031-03`, { token: koord.c })
  cek('Usulan lembur unit: daftar + perkiraan uang', r.s === 200 && r.j.data.baris.some(b => b.id === lMenunggu.id && b.status === 'MENUNGGU') && !r.j.data.baris.some(b => b.studioId === pibi.id))
  r = await panggil(`/api/circle/lembur/${lMenunggu.id}/setujui`, { method: 'POST', token: kar.c, body: {} }); cek('Karyawan menyetujui lemburnya sendiri → 403', r.s === 403)
  r = await panggil(`/api/circle/lembur/${lMenunggu.id}/tolak`, { method: 'POST', token: koord.c, body: {} }); cek('Tolak tanpa alasan → 422', r.s === 422)

  // Siapkan slip Maret 2031 sebelum persetujuan: hanya 60 menit (Rabu 5 Mar) yang dihitung. Sejak 18 Nov 2026 penggajian dikelola di web circle
  // › Penggajian (Payroll di Management Dashboard hanya memantau) — slip butuh THP di Bio, jadi THP uji diisi pada peran unit Keiko.
  await prisma.userRole.updateMany({ where: { userId: { in: [kar.id, dua.id] }, studioId: S }, data: { takeHomePay: 3000000 } })
  r = await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: 3, tahun: 2031 } })
  let p = await prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId: kar.id, studioId: S, bulan: 3, tahun: 2031 } } })
  cek('Generate: lembur MENUNGGU tidak ikut; 60 menit × 30rb = Rp30.000', r.s === 200 && p?.lembur === 30000, `${r.s} lembur=${p?.lembur}`)
  const pDua = await prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId: dua.id, studioId: S, bulan: 3, tahun: 2031 } } })
  cek('Orang di dua unit: hanya lembur unit Keiko yang diklaim (60 menit → Rp30.000)', pDua?.lembur === 30000, `lembur=${pDua?.lembur}`)
  cek('Lembur unit lain tetap belum diklaim', (await prisma.lemburKehadiran.count({ where: { userId: dua.id, studioId: pibi.id, penggajianId: null } })) === 1)

  r = await panggil(`/api/circle/lembur/${lMenunggu.id}/setujui`, { method: 'POST', token: koord.c, body: {} }); cek('Koordinator menyetujui', r.s === 200)
  r = await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: 3, tahun: 2031 } })
  p = await prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId: kar.id, studioId: S, bulan: 3, tahun: 2031 } } })
  cek('Generate ulang: yang baru disetujui ditambahkan sekali (100 menit → dibulatkan 90 → Rp45.000; total Rp75.000)', p?.lembur === 75000, `lembur=${p?.lembur}`)
  r = await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: 3, tahun: 2031 } })
  p = await prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId: kar.id, studioId: S, bulan: 3, tahun: 2031 } } })
  cek('Generate ketiga: tidak dobel', p?.lembur === 75000)
  r = await panggil(`/api/circle/lembur/${lMenunggu.id}/tolak`, { method: 'POST', token: koord.c, body: { catatan: 'x' } }); cek('Lembur yang sudah masuk slip tidak bisa ditinjau ulang → 409', r.s === 409)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.penggajian.deleteMany({ where: { studioId: { in: [S, pibi.id] }, bulan: 3, tahun: 2031 } })
  if (aturanLama) await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { ...aturanLama, studioId: undefined, updatedAt: undefined, tingkat: aturanLama.tingkat ?? undefined } })
  else await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
