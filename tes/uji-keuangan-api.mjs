import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) { gagal++; process.exitCode = 1 } }
const B = 'http://localhost:3001'
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web, cookie, ip } = {}) => {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip ?? `172.16.${(++xff >> 8) & 255}.${xff & 255}`, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(web ? { 'X-Unit-Web': web } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body && JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  const sc = r.headers.get('set-cookie')
  return { s: r.status, j, cookie: sc?.split(';')[0] }
}
const studios = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true, nama: true, circleId: true } })
const nm = (n) => studios.find(s => s.nama.trim().toLowerCase() === n)
const keiko = nm('keiko'), pibi = nm('pibi'), sekartaji = nm('sekartaji')
const sandi = crypto.randomBytes(9).toString('base64url'), hash = await bcrypt.hash(sandi, 10)
const dibuat = []
const buat = async (kode, peran) => {
  const email = `uji.${kode}@uji.local`
  const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email, passwordHash: hash, statusAktif: true } })
  for (const [roleType, studioId] of peran) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } })
  dibuat.push(u.id); return { id: u.id, email }
}
const login = (u, web) => panggil('/api/auth/login', { method: 'POST', body: { email: u.email, password: sandi }, web })
const dec = (t) => jwt.decode(t)

const sisa = { lap: [], peng: [], rek: [], note: [] }
const TGL = '2026-10-19' // Senin
try {
  const tKar = await buat('kg_karyawan', [['KARYAWAN', keiko.id]])
  const tKoord = await buat('kg_koord', [['KOORDINATOR', keiko.id], ['KOORDINATOR', pibi.id]])
  const tDig = await buat('kg_dignity', [['DIGNITY', keiko.id], ['KARYAWAN', pibi.id]])
  const tok = async (u, web = 'bloom') => (await login(u, web)).j.data?.accessToken
  const kar = await tok(tKar), koord = await tok(tKoord)
  const H = (t) => ({ token: t, web: 'bloom' })
  await prisma.weeklyReport.deleteMany({ where: { studioId: { in: [keiko.id, pibi.id] }, periodeAwal: new Date(TGL) } })

  console.log('— hak akses —')
  let r = await panggil('/api/circle/keuangan/status', H(kar)); cek('Karyawan melihat angka omset → 403', r.s === 403)
  r = await panggil('/api/circle/keuangan/laporan', { method: 'POST', ...H(kar), body: { studioId: keiko.id, periodeAwal: TGL } }); cek('Karyawan mengisi laporan → 403', r.s === 403)
  r = await panggil('/api/circle/keuangan/status', { token: koord }); cek('Tanpa alamat circle (alamat Ekosistem) → 403', r.s === 403)
  r = await panggil('/api/circle/keuangan/status', { token: koord, web: 'naya' }); cek('Token Bloom dipakai di alamat NAYA → 403', r.s === 403)

  console.log('— isi laporan dari web circle —')
  r = await panggil('/api/circle/keuangan/laporan', { method: 'POST', ...H(koord), body: { studioId: pibi.id, periodeAwal: TGL, omsetFiverr: 10, kurs: 16000 } }); cek('Koordinator mengisi laporan unit circle LAIN (Pibi) → 403', r.s === 403, r.j.message)
  r = await panggil('/api/circle/keuangan/laporan', { method: 'POST', ...H(koord), body: { studioId: keiko.id, periodeAwal: TGL, omsetFiverr: 100, omsetEtsy: 50, kurs: 16000, kendala: 'UJI', skorSemangat: 4 } })
  cek('Koordinator mengisi laporan Keiko → 201', r.s === 201, r.j.message)
  const lap = r.j.data; sisa.lap.push(lap?.id)
  cek('Total USD dihitung server = 150', lap?.totalUsd === 150, String(lap?.totalUsd))
  r = await panggil('/api/circle/keuangan/laporan', { method: 'POST', ...H(koord), body: { studioId: keiko.id, periodeAwal: TGL, omsetFiverr: 1 } }); cek('Laporan ganda di minggu sama ditolak', r.s >= 400, String(r.s))
  const db1 = await prisma.weeklyReport.findUnique({ where: { id: lap.id } }); cek('Data tersimpan di tabel Ekosistem yang sama (WeeklyReport)', db1?.omsetFiverr === 100)
  r = await panggil('/api/circle/keuangan/laporan/' + lap.id, { method: 'PUT', ...H(koord), body: { omsetFiverr: 200 } }); cek('Ubah laporan → total 250', r.s === 200 && r.j.data.totalUsd === 250, String(r.j.data?.totalUsd))
  r = await panggil('/api/circle/keuangan/laporan/' + lap.id, { method: 'PUT', ...H(kar), body: { omsetFiverr: 1 } }); cek('Karyawan mengubah laporan → 403', r.s === 403)

  console.log('— pengeluaran —')
  r = await panggil('/api/circle/keuangan/pengeluaran', { method: 'POST', ...H(koord), body: { studioId: keiko.id, tanggal: TGL, kategori: 'LAINNYA', nama: 'UJI item', jumlah: 25000 } })
  if (r.s !== 201) console.log('   (kategori valid?)', r.j.message)
  cek('Catat pengeluaran → 201', r.s === 201, r.j.message); sisa.peng.push(r.j.data?.id)
  r = await panggil(`/api/circle/keuangan/pengeluaran?studioId=${keiko.id}&dari=${TGL}&sampai=2026-10-25`, H(koord)); cek('Daftar pengeluaran memuat item', r.s === 200 && r.j.data.some(p => p.nama === 'UJI item'))
  const db2 = await prisma.weeklyReport.findUnique({ where: { id: lap.id } }); cek('Total pengeluaran laporan ikut tersinkron = 25000', db2.pengeluaran === 25000, String(db2.pengeluaran))
  r = await panggil(`/api/circle/keuangan/pengeluaran?studioId=${pibi.id}&dari=${TGL}&sampai=2026-10-25`, H(koord)); cek('Pengeluaran unit circle lain → 403', r.s === 403)

  console.log('— tampilan —')
  r = await panggil('/api/circle/keuangan/status', H(koord))
  const ids = r.j.data?.map(s => s.id) ?? []
  cek('Status minggu ini: hanya unit Bloom (Pibi tidak muncul)', r.s === 200 && ids.includes(keiko.id) && !ids.includes(pibi.id), `${ids.length} unit`)
  cek('Status: unit Bloom lain yang bukan wilayah koordinator → angka disamarkan (null)', r.j.data.filter(s => s.id !== keiko.id).every(s => s.omsetBulanIni === null))
  r = await panggil('/api/circle/keuangan/bulanan?bulan=10&tahun=2026', H(koord))
  const sk = r.j.data?.studios?.find(s => s.id === keiko.id)
  cek('Rekap bulanan: hanya unit Bloom + peringkat dinomori ulang', r.s === 200 && r.j.data.studios.every(s => s.circle?.id === keiko.circleId) && r.j.data.studios[0].peringkat === 1, `${r.j.data?.studios?.length} unit`)
  cek('Rekap bulanan: minggu baru (250) ikut dalam rekap Keiko', sk?.mingguLaporan?.some(m => m.id === lap.id && m.totalUsd === 250), String(sk?.totalUsd))
  r = await panggil('/api/circle/keuangan/laporan', H(koord)); console.log('   riwayat:', r.s, r.j.message ?? '', JSON.stringify(r.j.data?.slice(0,1))?.slice(0,200), 'pagination', JSON.stringify(r.j.pagination)); cek('Riwayat memuat laporan Keiko dan tidak memuat unit lain circle', r.s === 200 && r.j.data.some(x => x.id === lap.id) && r.j.data.every(x => x.studio.circleId === keiko.circleId))
  r = await panggil('/api/circle/keuangan/laporan?studioId=' + pibi.id, H(koord)); cek('Riwayat unit circle lain → kosong', r.s === 200 && r.j.data.length === 0)

  console.log('— kas & dana luar kas —')
  const rek = await prisma.studioRekening.create({ data: { studioId: keiko.id, namaBank: 'UJI Bank', nomorRekening: '9999000011', atasNama: 'RAHASIA', saldo: 1000 } }); sisa.rek.push(rek.id)
  r = await panggil('/api/circle/keuangan/saldo/' + keiko.id, H(koord)); cek('Saldo tampil tanpa nomor rekening & atas nama', r.s === 200 && !JSON.stringify(r.j).includes('9999000011') && !JSON.stringify(r.j).includes('RAHASIA'))
  r = await panggil(`/api/circle/keuangan/saldo/${keiko.id}/${rek.id}`, { method: 'PUT', ...H(koord), body: { saldo: 5000, nomorRekening: 'HACK', namaBank: 'HACK' } })
  const rek2 = await prisma.studioRekening.findUnique({ where: { id: rek.id } })
  cek('Ubah saldo → tersimpan, field lain tidak berubah', r.s === 200 && rek2.saldo === 5000 && rek2.nomorRekening === '9999000011' && rek2.namaBank === 'UJI Bank')
  r = await panggil('/api/circle/keuangan/saldo/' + pibi.id, H(koord)); cek('Saldo unit circle lain → 403', r.s === 403)
  r = await panggil('/api/circle/keuangan/dana-luar-kas', { method: 'PUT', ...H(koord), body: { studioId: keiko.id, bulan: 10, tahun: 2026, ekuitas: 777000 } }); cek('Simpan dana di luar kas', r.s === 200, r.j.message)
  sisa.note.push({ studioId: keiko.id })
  r = await panggil('/api/circle/keuangan/dana-luar-kas?bulan=10&tahun=2026', H(koord)); cek('Dana luar kas terbaca (hanya unit Bloom)', r.s === 200 && r.j.data.some(n => n.studioId === keiko.id && n.ekuitas === 777000) && r.j.data.every(n => n.studio?.id !== pibi.id))

  console.log('— hapus —')
  r = await panggil('/api/circle/keuangan/pengeluaran/' + sisa.peng[0], { method: 'DELETE', ...H(koord) }); cek('Hapus pengeluaran', r.s === 200)
  r = await panggil('/api/circle/keuangan/laporan/' + lap.id, { method: 'DELETE', ...H(koord) }); cek('Hapus laporan', r.s === 200)
  cek('Laporan benar-benar hilang dari tabel Ekosistem', !(await prisma.weeklyReport.findUnique({ where: { id: lap.id } })))
} catch (e) { console.error('GALAT:', e); process.exitCode = 1 } finally {
  await prisma.pengeluaran.deleteMany({ where: { nama: 'UJI item' } })
  await prisma.weeklyReport.deleteMany({ where: { kendala: 'UJI', studioId: keiko.id } })
  await prisma.studioRekening.deleteMany({ where: { namaBank: 'UJI Bank' } })
  await prisma.studioMonthlyNote.deleteMany({ where: { studioId: keiko.id, bulan: 10, tahun: 2026, ekuitas: 777000 } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(akun & data uji dihapus) — gagal: ${gagal}`)
  await prisma.$disconnect()
}
