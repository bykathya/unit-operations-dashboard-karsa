import { DASH } from './_jalur.mjs'
// Uji AKUN SOSMED & MARKETPLACE STUDIO di web circle (12 Nov 2026, keputusan user): Marketing → Profil membaca SosmedLink studio dari Ekosistem
// Dashboard (baca-saja) — terlihat oleh Koordinator, Admin Market & Marketer UNIT ITU; talent & unit lain tidak; sosmed pribadi orang tidak
// ikut. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, token) => { const r = await fetch('http://localhost:3001' + path, { headers: { 'X-Forwarded-For': `172.49.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', Authorization: `Bearer ${token}` } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-ass-' + T, 4), dibuat = [], linkIds = []
const user = async (kode, rt, studioId = S) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const lain = await prisma.studio.findFirst({ where: { id: { not: S }, statusAktif: true, circle: { slug: 'bloom' } } })
  const koord = await user('ass_koord', 'KOORDINATOR'), mkt = await user('ass_mkt', 'KARYAWAN'), adm = await user('ass_adm', 'KARYAWAN'), tal = await user('ass_tal', 'KARYAWAN')
  const koordLain = lain ? await user('ass_koordlain', 'KOORDINATOR', lain.id) : null
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  linkIds.push((await prisma.sosmedLink.create({ data: { studioId: S, platform: 'Etsy', url: `https://etsy.com/shop/uji${T}`, username: `uji_etsy_${T}` } })).id)
  linkIds.push((await prisma.sosmedLink.create({ data: { userId: mkt.id, platform: 'Instagram', url: `https://instagram.com/pribadi${T}` } })).id)
  const punya = (r) => (r.j.data?.akunStudio ?? []).some(a => a.username === `uji_etsy_${T}`)
  let r = await panggil(`/api/circle/marketing/profil?studioId=${S}`, koord.t); cek('Koordinator unit melihat akun studio dari Ekosistem', r.s === 200 && punya(r), String(r.s))
  cek('Sosmed PRIBADI orang tidak ikut di daftar akun studio', !(r.j.data?.akunStudio ?? []).some(a => a.url.includes(`pribadi${T}`)))
  r = await panggil(`/api/circle/marketing/profil?studioId=${S}`, mkt.t); cek('Marketer unit melihat akun studio', r.s === 200 && punya(r), String(r.s))
  r = await panggil(`/api/circle/marketing/profil?studioId=${S}`, adm.t); cek('Admin Market unit melihat akun studio', r.s === 200 && punya(r), String(r.s))
  r = await panggil(`/api/circle/marketing/profil?studioId=${S}`, tal.t); cek('Talent → ditolak (tidak melihat)', r.s === 403 && !punya(r), String(r.s))
  if (koordLain) { r = await panggil(`/api/circle/marketing/profil?studioId=${S}`, koordLain.t); cek('Koordinator unit LAIN → ditolak', r.s === 403 && !punya(r), String(r.s)) }
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.sosmedLink.deleteMany({ where: { id: { in: linkIds } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
