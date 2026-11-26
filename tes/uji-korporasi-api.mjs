import { DASH } from './_jalur.mjs'
// Uji UNIT DI BAWAH KORPORASI (9 Nov 2026, keputusan user): unit yang bernaung di Korporasi (indukId → unit KORPORASI, tanpa circle/rumah
// usaha) dilayani di alamat Circle Ekosistem. Server lokal harus dijalankan dengan WEB_KORPORASI_SLUG = slug Circle Ekosistem lokal (mis. "utama");
// di production bawaannya "circle". Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const circleUtama = await prisma.circle.findFirst({ where: { nama: 'Circle Ekosistem' } })
const SLUG = circleUtama?.slug ?? 'circle'
const panggil = async (path, { method = 'GET', body, token, web = SLUG } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const SANDI = 'uji-korp-' + Date.now(), hash = await bcrypt.hash(SANDI, 4)
const dibuat = [], studioIds = []
try {
  const korp = await prisma.studio.create({ data: { nama: 'UJI-KORP PT Uji', tipe: 'KORPORASI', statusAktif: true } }); studioIds.push(korp.id)
  const anak = await prisma.studio.create({ data: { nama: 'UJI-KORP Project', tipe: 'PROJECT', indukId: korp.id, statusAktif: true } }); studioIds.push(anak.id)
  const mk = async (kode, sid) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: 'KOORDINATOR', studioId: sid } }); dibuat.push(u.id); return { id: u.id, email: `uji.${kode}@uji.local` } }
  const zafia = await mk('korp_anggota', anak.id)
  let r = await panggil('/api/auth/login', { method: 'POST', body: { email: zafia.email, password: SANDI } })
  cek(`Anggota unit Korporasi login di alamat Circle Ekosistem (${SLUG}) → 200`, r.s === 200, String(r.s) + ' ' + (r.j.message ?? ''))
  const tok = r.j.data?.accessToken
  r = await panggil('/api/auth/login', { method: 'POST', web: 'bloom', body: { email: zafia.email, password: SANDI } }); cek('…tetapi tidak di alamat circle lain (bloom) → 403', r.s === 403)
  r = await panggil('/api/circle/saya', { token: tok }); const st = r.j.data?.studios?.find(s => s.id === anak.id)
  cek('Unit Korporasi muncul di daftar unit, dikelompokkan ke korporasinya', r.s === 200 && st && st.induk?.nama === 'UJI-KORP PT Uji')
  cek('Unit KORPORASI induknya sendiri tidak tampil sebagai unit kerja', !r.j.data?.studios?.some(s => s.id === korp.id))
  r = await panggil(`/api/circle/papan?studioId=${anak.id}`, { token: tok }); cek('Koordinator unit Korporasi membuka Produksi unitnya → 200', r.s === 200, String(r.s))
  const tokBloom = jwt.sign({ id: zafia.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' })
  r = await panggil(`/api/circle/papan?studioId=${anak.id}`, { token: tokBloom, web: 'bloom' }); cek('Unit Korporasi tidak terlihat dari alamat bloom → 403', r.s === 403)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.refreshToken?.deleteMany?.({ where: { userId: id } }).catch(() => {}); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  await prisma.tahapProduksi.deleteMany({ where: { studioId: { in: studioIds } } })
  await prisma.studio.deleteMany({ where: { id: { in: [...studioIds].reverse() } } }).catch(async () => { for (const id of [...studioIds].reverse()) await prisma.studio.delete({ where: { id } }).catch(() => {}) })
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
