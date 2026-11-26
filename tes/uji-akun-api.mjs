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

try {
  const tKar = await buat('ak_karyawan', [['KARYAWAN', keiko.id]])
  const tKoord = await buat('ak_koord', [['KOORDINATOR', keiko.id], ['KOORDINATOR', pibi.id]])
  const tok = async (u) => (await login(u, 'bloom')).j.data?.accessToken
  const kar = await tok(tKar), koord = await tok(tKoord)
  const H = (t) => ({ token: t, web: 'bloom' })
  const U = '/api/circle/akun-jualan'
  let r = await panggil(`${U}?studioId=${keiko.id}`, H(kar)); cek('Karyawan melihat akun jualan → 403', r.s === 403)
  r = await panggil(U, { method: 'POST', ...H(kar), body: { studioId: keiko.id, platform: 'Fiverr', namaAkun: 'UJI-A' } }); cek('Karyawan menambah akun → 403', r.s === 403)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: pibi.id, platform: 'Fiverr', namaAkun: 'UJI-A' } }); cek('Koordinator menambah akun di circle LAIN (Pibi) → 403', r.s === 403)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: keiko.id, platform: 'TikTok', namaAkun: 'UJI-A' } }); cek('Platform tak dikenal → 422', r.s === 422)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: keiko.id, platform: 'Fiverr', namaAkun: '  ' } }); cek('Nama kosong → 422', r.s === 422)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: keiko.id, platform: 'Fiverr', namaAkun: 'UJI-A', feePersen: 150 } }); cek('Fee > 100% → 422', r.s === 422)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: keiko.id, platform: 'Fiverr', namaAkun: 'UJI-A' } }); cek('Tambah akun → 201, fee bawaan 20%', r.s === 201 && r.j.data.feePersen === 20, JSON.stringify(r.j.data))
  const id = r.j.data?.id
  const db = await prisma.akunProduksi.findUnique({ where: { id } }); cek('Tersimpan di tabel Ekosistem (fee pecahan 0.2)', db?.namaAkun === 'UJI-A' && Math.abs(db.feePersen - 0.2) < 1e-9)
  r = await panggil(U, { method: 'POST', ...H(koord), body: { studioId: keiko.id, platform: 'Etsy', namaAkun: 'UJI-A' } }); cek('Nama ganda di studio sama → 409', r.s === 409)
  r = await panggil(`${U}?studioId=${keiko.id}`, H(koord)); cek('Daftar memuat akun', r.s === 200 && r.j.data.akun.some(a => a.id === id))
  r = await panggil(`${U}/${id}`, { method: 'PATCH', ...H(koord), body: { namaAkun: 'UJI-B', feePersen: 12.5 } }); cek('Ubah nama & fee', r.s === 200 && r.j.data.namaAkun === 'UJI-B' && r.j.data.feePersen === 12.5)
  r = await panggil(`${U}/${id}`, { method: 'PATCH', ...H(kar), body: { namaAkun: 'X' } }); cek('Karyawan mengubah akun → 403', r.s === 403)
  r = await panggil('/api/circle/mulai?studioId=' + keiko.id, H(koord)); cek('Status Mulai: akun terhitung ≥ 1', r.s === 200 && r.j.data.akun >= 1, JSON.stringify(r.j.data))
  r = await panggil('/api/circle/mulai?studioId=' + pibi.id, H(koord)); cek('Status Mulai unit circle lain → 403', r.s === 403)
  const ord = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: id, klien: 'UJI', judul: 'UJI akun', nilaiKotor: 1, nilaiBersih: 1 } })
  r = await panggil(`${U}/${id}`, { method: 'DELETE', ...H(koord) }); cek('Hapus akun yang dipakai order → 409', r.s === 409, r.j.message)
  await prisma.orderProduksi.delete({ where: { id: ord.id } })
  r = await panggil(`${U}/${id}`, { method: 'DELETE', ...H(koord) }); cek('Hapus akun bebas → 200', r.s === 200)
  cek('Akun hilang dari tabel Ekosistem', !(await prisma.akunProduksi.findUnique({ where: { id } })))
} catch (e) { console.error('GALAT:', e); process.exitCode = 1 } finally {
  await prisma.akunProduksi.deleteMany({ where: { namaAkun: { startsWith: 'UJI-' } } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'UJI', judul: 'UJI akun' } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(akun & data uji dihapus) — gagal: ${gagal}`)
  await prisma.$disconnect()
}
