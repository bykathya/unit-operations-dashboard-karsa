import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0, xff = 0
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const api = (uid) => { const t = jwt.sign({ id: uid }, process.env.JWT_SECRET, { expiresIn: '10m' }); return async (path, method = 'GET', body) => { const r = await fetch('http://localhost:3001/api/circle' + path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Forwarded-For': `172.21.${(++xff >> 8) & 255}.${xff & 255}` }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } } }
const studio = await prisma.studio.findFirst({ where: { nama: 'Sekartaji' } })
const lain = await prisma.studio.findFirst({ where: { nama: { startsWith: 'Pibi' } } })
const dibuat = []
const buat = async (kode, role, studioId, posisi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: 'x', statusAktif: true, posisi } }); dibuat.push(u.id); await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId } }); return u.id }
try {
  const idK = await buat('tim_koord', 'KOORDINATOR', studio.id, 'Koordinator')
  const idA = await buat('tim_artist', 'KARYAWAN', studio.id, 'Karyawan/Rigger&Animator')
  const idM = await buat('tim_admin', 'KARYAWAN', studio.id, 'Admin')
  const idKosong = await buat('tim_kosong', 'MAGANG', studio.id, null)
  const idLainKoord = await buat('tim_koord_lain', 'KOORDINATOR', lain.id, 'Koordinator')
  const K = api(idK), TA = api(idA), L = api(idLainKoord)
  const q = `?studioId=${studio.id}`

  console.log('— membaca tim —')
  let r = await K('/tim' + q); const ang = r.j.data?.anggota ?? []
  const uji = (id) => ang.find(a => a.userId === id)
  cek('Koordinator melihat tim studionya beserta tebakan', r.s === 200 && !!uji(idA) && !!uji(idM) && !!uji(idKosong))
  cek('Tebakan Rigger&Animator = Artist (Rigging,Animasi)', uji(idA).saran.some(s => s.fungsi === 'ARTIST' && s.bidang === 'Rigging,Animasi'))
  cek('Tebakan "Admin" = Marketer (default, koordinator mengoreksi)', uji(idM).saran.some(s => s.fungsi === 'MARKETER'))
  cek('Posisi kosong = tanpa tebakan', uji(idKosong).saran.length === 0)
  cek('Koordinator terbaca sebagai PM/QC', uji(idK).saran.some(s => s.fungsi === 'PM_QC'))
  cek('Belum ada yang terkonfirmasi di awal (untuk akun uji)', !uji(idA).terkonfirmasi && !uji(idM).terkonfirmasi)
  cek('Hanya anggota studio ini (tidak ada anggota Pibi)', !ang.some(a => a.userId === idLainKoord))
  r = await TA('/tim' + q); cek('Artist (bukan manajer) membuka layar Tim → 403', r.s === 403)
  r = await L('/tim' + q); cek('Koordinator studio lain membuka tim studio ini → 403', r.s === 403)

  console.log('— mengonfirmasi —')
  r = await K(`/tim/${idM}${q}`, 'PUT', { fungsi: [{ fungsi: 'ADMIN' }] }); cek('Koreksi: "Admin" ternyata ADMIN (administrasi), bukan marketer', r.s === 200)
  let t = (await K('/tim' + q)).j.data.anggota; cek('Tersimpan & terkonfirmasi, tebakan tidak lagi dipakai', uji.call(null, idM) && t.find(a => a.userId === idM).terkonfirmasi && t.find(a => a.userId === idM).fungsi[0].fungsi === 'ADMIN')
  r = await K(`/tim/${idA}${q}`, 'PUT', { fungsi: [{ fungsi: 'ARTIST', bidang: 'Rigging,Animasi' }, { fungsi: 'MARKETER' }] }); cek('Satu orang dua fungsi (Artist + Marketer)', r.s === 200)
  r = await K(`/tim/${idA}${q}`, 'PUT', { fungsi: [{ fungsi: 'DUKUN' }] }); cek('Fungsi tak dikenal → 422', r.s === 422)
  r = await K(`/tim/${idA}${q}`, 'PUT', { fungsi: [{ fungsi: 'MARKETER', bidang: '3D' }] }); cek('Bidang pada non-artist → 422', r.s === 422)
  r = await K(`/tim/${idLainKoord}${q}`, 'PUT', { fungsi: [{ fungsi: 'PM_QC' }] }); cek('Mengubah anggota studio LAIN → 404', r.s === 404)
  r = await TA(`/tim/${idA}${q}`, 'PUT', { fungsi: [{ fungsi: 'PM_QC' }] }); cek('Artist mengubah fungsinya sendiri → 403', r.s === 403)
  r = await L(`/tim/${idA}${q}`, 'PUT', { fungsi: [{ fungsi: 'PM_QC' }] }); cek('Koordinator studio lain mengubah anggota → 403', r.s === 403)
  const adaSimpan = await prisma.fungsiAnggota.count({ where: { userId: idA, studioId: studio.id } }); cek('Isian ditimpa utuh (tidak menumpuk): 2 baris untuk idA', adaSimpan === 2)
  r = await K(`/tim/${idA}${q}`, 'PUT', { fungsi: [] }); cek('Mengosongkan fungsi → baris dihapus', r.s === 200 && (await prisma.fungsiAnggota.count({ where: { userId: idA, studioId: studio.id } })) === 0)

  console.log('— terima semua saran —')
  r = await K('/tim/terima-saran' + q, 'POST'); cek('Terima saran: hanya yang belum terkonfirmasi & punya tebakan', r.s === 200 && r.j.data.diterima >= 2, `diterima ${r.j.data?.diterima}`)
  t = (await K('/tim' + q)).j.data.anggota
  cek('Artist kembali dari saran (Rigging,Animasi)', t.find(a => a.userId === idA).fungsi.some(f => f.fungsi === 'ARTIST' && f.bidang === 'Rigging,Animasi' && f.terkonfirmasi))
  cek('"Admin" yang sudah dikoreksi TIDAK ditimpa saran', t.find(a => a.userId === idM).fungsi.length === 1 && t.find(a => a.userId === idM).fungsi[0].fungsi === 'ADMIN')
  cek('Yang tanpa dasar tetap kosong (harus diisi manual)', t.find(a => a.userId === idKosong).fungsi.length === 0 && !t.find(a => a.userId === idKosong).terkonfirmasi)
  r = await TA('/tim/terima-saran' + q, 'POST'); cek('Artist menerima saran → 403', r.s === 403)
  r = await L('/tim/terima-saran' + q, 'POST'); cek('Koordinator studio lain menerima saran → 403', r.s === 403)
  const ringkas = (await K('/tim' + q)).j.data.ringkas; cek('Ringkasan menghitung terkonfirmasi/tanpa dasar', ringkas.tanpaDasar >= 1 && ringkas.terkonfirmasi >= 3, JSON.stringify(ringkas))
} catch (e) { console.error('GALAT:', e); gagal++ } finally {
  await prisma.fungsiAnggota.deleteMany({ where: { studioId: studio.id } })   // termasuk baris anggota ASLI yang ikut tersentuh 'terima saran'
  for (const id of dibuat) { await prisma.fungsiAnggota.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect(); process.exit(gagal ? 1 : 0)
}
