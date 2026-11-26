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
let idOrder
try {
  const tKaryawan = await buat('karyawan_bloom', [['KARYAWAN', keiko.id]])
  const tKoord = await buat('koord_bloom', [['KOORDINATOR', keiko.id], ['KOORDINATOR', pibi.id]])
  const tPibi = await buat('karyawan_pibi', [['KARYAWAN', pibi.id]])
  const tDignity = await buat('dignity_bloom', [['DIGNITY', keiko.id]])

  console.log('— jalur masuk —')
  let r = await login(tKaryawan)
  if (process.env.AKSES_DASHBOARD_MIN_ROLE) cek('Management Dashboard: Karyawan DITOLAK oleh pembatas akses (Koordinator ke atas)', r.s === 403, r.j.message?.slice(0, 50))
  else console.log('  (lewati: AKSES_DASHBOARD_MIN_ROLE tidak dinyalakan — sesuai Aturan Keras 7)')
  r = await login(tKoord); cek('Management Dashboard: Koordinator boleh masuk, token tanpa klaim circle', r.s === 200 && !dec(r.j.data.accessToken).aud); const tokApp = r.j.data.accessToken
  r = await login(tKaryawan, 'bloom'); cek('Web Bloom: Karyawan Bloom BOLEH masuk (pembatas Ekosistem tidak berlaku di jalur circle)', r.s === 200 && dec(r.j.data.accessToken).aud === 'circle' && dec(r.j.data.accessToken).cs === 'bloom')
  const tokKar = r.j.data.accessToken, cookieKar = r.cookie
  r = await login(tPibi, 'bloom'); cek('Web Bloom: Karyawan circle LAIN (Pibi) ditolak', r.s === 403, r.j.message)
  r = await login(tDignity, 'bloom'); cek('Web Bloom: tag Dignity saja tidak boleh masuk', r.s === 403)
  r = await login(tKaryawan, 'tidakada'); cek('Alamat tidak dikenal → 404', r.s === 404)
  r = await login(tKaryawan, 'naya'); cek('Karyawan Bloom mencoba lewat alamat NAYA → ditolak', r.s === 403)
  r = await login(tKoord, 'bloom'); const tokKoordCircle = r.j.data.accessToken; cek('Web Bloom: Koordinator masuk', r.s === 200)

  console.log('— token circle terbatas —')
  r = await panggil('/api/weekly-reports', { token: tokKar, web: 'bloom' }); cek('Token circle ke API Ekosistem (laporan omset) → 403', r.s === 403, r.j.message)
  r = await panggil('/api/produksi/klien?studioId=' + keiko.id, { token: tokKar, web: 'bloom' }); cek('Token circle ke API Produksi Ekosistem (modul sudah dihapus) → tidak terjangkau (403/404)', [403, 404].includes(r.s))
  r = await panggil('/api/finance/posts', { token: tokKar, web: 'bloom' }); cek('Token circle ke API Keuangan → 403', r.s === 403)
  r = await panggil('/api/auth/me', { token: tokKar, web: 'bloom' }); cek('Token circle ke /api/auth/me di alamat Bloom → 200', r.s === 200)
  r = await panggil('/api/auth/me', { token: tokKar }); cek('Token circle dipakai di alamat Ekosistem → ditolak', r.s === 403)
  r = await panggil('/api/auth/refresh', { method: 'POST', cookie: cookieKar, web: 'bloom' }); cek('Refresh di alamat Bloom → token baru tetap aud circle', r.s === 200 && dec(r.j.data.accessToken).aud === 'circle')
  r = await panggil('/api/auth/refresh', { method: 'POST', cookie: cookieKar, web: 'naya' }); cek('Refresh memakai cookie Bloom di alamat NAYA → 401', r.s === 401)
  r = await panggil('/api/auth/refresh', { method: 'POST', cookie: cookieKar }); cek('Refresh memakai cookie circle di alamat Ekosistem → 401', r.s === 401)

  console.log('— talent hanya tugasnya sendiri —')
  r = await panggil('/api/circle/saya', { token: tokKar, web: 'bloom' }); cek('Karyawan melihat studionya dengan mode "tugas"', r.s === 200 && r.j.data.studios.length === 1 && r.j.data.studios[0].mode === 'tugas', r.j.data?.studios?.map(s => s.nama + ':' + s.mode).join())
  r = await panggil(`/api/circle/papan?studioId=${keiko.id}`, { token: tokKar, web: 'bloom' }); cek('Karyawan membuka papan penuh → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer?studioId=${keiko.id}`, { token: tokKar, web: 'bloom' }); cek('Karyawan membuka daftar freelancer → 403', r.s === 403)
  r = await panggil('/api/circle/orders', { method: 'POST', token: tokKar, web: 'bloom', body: { studioId: keiko.id, judul: 'x', klien: 'x' } }); cek('Karyawan menambah order → 403', r.s === 403)
  const akun = (await prisma.akunProduksi.findFirst({ where: { studioId: keiko.id } })) ?? await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o1 = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akun.id, klien: 'KLIEN-UJI', judul: 'UJI tugas milik karyawan', nilaiKotor: 999000, nilaiBersih: 999000, assignments: { create: { userId: tKaryawan.id } } } })
  const o2 = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akun.id, klien: 'KLIEN-UJI', judul: 'UJI tugas orang lain', nilaiKotor: 888000, nilaiBersih: 888000 } })
  idOrder = [o1.id, o2.id]
  r = await panggil(`/api/circle/tugas-saya?studioId=${keiko.id}`, { token: tokKar, web: 'bloom' })
  const teks = JSON.stringify(r.j)
  cek('Tugas Saya: hanya order miliknya (Inbox = daftar info, bukan antrean), order orang lain tidak muncul', r.s === 200 && (r.j.data.lain.some(t => t.judul.includes('milik karyawan')) || r.j.data.tugas.some(t => t.judul.includes('milik karyawan'))) && ![...r.j.data.tugas, ...r.j.data.lain].some(t => t.judul.includes('orang lain')))
  cek('Tugas Saya: tidak ada satu pun nilai uang di respons', !/nilai|fee|999000|888000/i.test(teks))
  r = await panggil(`/api/circle/tugas-saya?studioId=${pibi.id}`, { token: tokKar, web: 'bloom' }); cek('Tugas Saya studio lain → 403', r.s === 403)

  console.log('— talent memperbarui tugasnya sendiri —')
  const aksi = (id, a, tok = tokKar) => panggil(`/api/circle/tugas/${id}/aksi`, { method: 'POST', token: tok, web: 'bloom', body: { aksi: a } })
  const tahapKeiko = await prisma.tahapProduksi.findMany({ where: { studioId: keiko.id } })
  const tid = (j) => tahapKeiko.find(t => t.jenis === j).id
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tid('MASUK'), status: 'MASUK', subStatus: 'Inbox' } })
  r = await panggil(`/api/circle/tugas-saya?studioId=${keiko.id}`, { token: tokKar, web: 'bloom' })
  cek('Order di Inbox BUKAN antrean talent: masuk daftar info tanpa tombol', !r.j.data.tugas.some(t => t.id === o1.id) && r.j.data.lain.some(t => t.id === o1.id && !('aksi' in t)))
  r = await aksi(o1.id, 'siap_preview'); cek('Aksi yang tidak dikenal / lompat tahap ditolak → 409', r.s === 409)
  r = await aksi(o1.id, 'lanjut'); cek('Talent tidak bisa memulai dari Inbox → 409 (koordinator yang memindahkan)', r.s === 409)
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tid('KERJA'), status: 'PROSES', subStatus: 'Pengerjaan' } })
  r = await panggil(`/api/circle/tugas-saya?studioId=${keiko.id}`, { token: tokKar, web: 'bloom' }); cek('Setelah dipindah ke Pengerjaan: masuk Tugasku dengan tombol Siap Preview', r.j.data.tugas.find(t => t.id === o1.id)?.aksi?.length > 0)
  let o = await prisma.orderProduksi.findUnique({ where: { id: o1.id } }); cek('Status besar ikut PROSES, subStatus Pengerjaan', o.status === 'PROSES' && o.subStatus === 'Pengerjaan')
  r = await aksi(o1.id, 'lanjut'); cek('Siap Preview → Preview', r.s === 200 && r.j.data.tahap === 'Preview')
  r = await aksi(o1.id, 'lanjut'); cek('Dari Preview talent tidak punya aksi lanjut (Done/Revisi urusan koordinator) → 409', r.s === 409)
  r = await aksi(o1.id, 'selesai'); cek('Aksi karangan klien ("selesai") ditolak → 409', r.s === 409)
  r = await aksi(o2.id, 'lanjut'); cek('Tugas orang lain tidak bisa disentuh → 404', r.s === 404)
  const rwT = await prisma.riwayatTahapOrder.findMany({ where: { orderId: o1.id, userId: tKaryawan.id } })
  cek('Riwayat mencatat talent sebagai pelaku', rwT.length === 1)
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tid('REVISI_KLIEN'), status: 'PROSES', subStatus: 'Revisi', revisiKe: 1 } })
  r = await aksi(o1.id, 'lanjut'); o = await prisma.orderProduksi.findUnique({ where: { id: o1.id } })
  cek('Revisi selesai → Preview, hitungan revisi TIDAK bertambah', r.s === 200 && o.revisiKe === 1 && o.subStatus === 'Preview')
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tid('SELESAI'), status: 'SELESAI', subStatus: 'Done' } })
  r = await aksi(o1.id, 'lanjut'); cek('Tugas yang sudah Done tidak bisa dibuka lagi oleh talent → 409', r.s === 409)
  r = await panggil(`/api/circle/tugas/${o1.id}/aksi`, { method: 'POST', token: tokKoordCircle, web: 'bloom', body: { aksi: 'lanjut' } }); cek('Koordinator yang tidak ditugaskan juga tidak lewat jalur ini → 404', r.s === 404)

  console.log('— terikat ke circle di alamatnya —')
  r = await panggil('/api/circle/saya', { token: tokKoordCircle, web: 'bloom' }); cek('Koordinator (peran di Keiko DAN Pibi) lewat alamat Bloom hanya melihat studio Bloom', r.s === 200 && r.j.data.studios.every(s => s.circle?.nama === 'Bloom Circle') && !r.j.data.studios.some(s => s.id === pibi.id), r.j.data?.studios?.map(s => s.nama.trim()).join())
  r = await panggil(`/api/circle/papan?studioId=${pibi.id}`, { token: tokKoordCircle, web: 'bloom' }); cek('Papan Pibi lewat alamat Bloom → 403 walau ia Koordinator Pibi', r.s === 403)
  r = await panggil('/api/circle/saya', { token: tokApp }); cek('Lewat Management Dashboard, studio kedua circle terlihat (token Ekosistem tidak terikat)', r.s === 200 && r.j.data.studios.some(s => s.id === pibi.id) && r.j.data.studios.some(s => s.id === keiko.id))
  r = await panggil(`/api/circle/papan?studioId=${keiko.id}`, { token: tokKoordCircle, web: 'bloom' }); cek('Koordinator melihat papan penuh studionya (mode kelola)', r.s === 200 && r.j.data.bisaUbah === true)

  console.log('— tampilan per circle —')
  r = await panggil('/api/circle/identitas', { web: 'bloom' }); cek('Identitas alamat Bloom: nama + warna, tanpa login', r.s === 200 && r.j.data.nama === 'Bloom Circle' && r.j.data.aud === 'circle', JSON.stringify(r.j.data))
  r = await panggil('/api/circle/identitas', { web: 'langit' }); cek('Identitas rumah usaha (langit)', r.s === 200 && r.j.data.jenis === 'rumah-usaha', r.j.data?.nama)
  r = await panggil('/api/circle/identitas'); cek('Tanpa header = alamat Ekosistem', r.s === 200 && r.j.data.aud === 'app')
  r = await panggil('/api/circle/identitas', { web: '../etc' }); cek('Header aneh ditolak', r.s === 404)

  console.log('— batas permintaan per akun —')
  const ipSama = '203.0.113.77'
  const kodeStatus = []
  const tokens = [tokKar, tokKoordCircle, tokApp]
  for (let i = 0; i < 1300; i++) { const x = await panggil('/api/circle/saya', { token: tokens[i % 3], web: i % 3 === 2 ? undefined : 'bloom', ip: ipSama }); kodeStatus.push(x.s) }
  cek('3 akun berbagi 1 IP, 1300 permintaan: tidak ada yang kena batas (dihitung per akun)', !kodeStatus.includes(429), `429 = ${kodeStatus.filter(s => s === 429).length}`)
  const ipLain = '203.0.113.88'; let k429 = 0
  for (let i = 0; i < 1050; i++) { const x = await panggil('/api/circle/identitas', { ip: ipLain }); if (x.s === 429) k429++ }
  cek('Tanpa login, 1 IP tetap dibatasi (1000/15 menit)', k429 > 0, `429 = ${k429}`)
} catch (e) { console.error('GALAT:', e); process.exitCode = 1 } finally {
  if (idOrder) await prisma.orderProduksi.deleteMany({ where: { id: { in: idOrder } } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(akun & data uji dihapus) — gagal: ${gagal}`)
  await prisma.$disconnect()
}
