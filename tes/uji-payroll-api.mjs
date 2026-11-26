import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.30.0.${++xff}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, role) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId: keiko.id } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let pg
try {
  const kar = await user('pr_karyawan', 'KARYAWAN'), lain = await user('pr_lain', 'KARYAWAN'), koord = await user('pr_koord', 'KOORDINATOR')
  pg = await prisma.penggajian.create({ data: { userId: kar.id, studioId: keiko.id, bulan: 1, tahun: 2031, gajiPokok: 1000, thp: 1000, status: 'DRAFT' } })
  let r = await panggil(`/api/payroll?studioId=${keiko.id}&bulan=1&tahun=2031`, { token: kar.t }); cek('Karyawan: baris DRAFT miliknya tidak terlihat', r.s === 200 && r.j.data.length === 0)
  r = await panggil(`/api/payroll/${pg.id}/slip`, { token: kar.t }); cek('Karyawan: slip DRAFT → 403', r.s === 403, r.j.message)
  r = await panggil(`/api/payroll?studioId=${keiko.id}&bulan=1&tahun=2031`, { token: koord.t }); cek('Koordinator tetap melihat baris DRAFT', r.s === 200 && r.j.data.length === 1)
  r = await panggil(`/api/payroll/${pg.id}/slip`, { token: koord.t }); cek('Koordinator tetap melihat slip DRAFT', r.s === 200)
  await prisma.penggajian.update({ where: { id: pg.id }, data: { status: 'FINAL' } })
  r = await panggil(`/api/payroll/${pg.id}/slip`, { token: lain.t }); cek('Karyawan LAIN di studio sama tidak boleh membuka slip orang → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/payroll?studioId=${keiko.id}&bulan=1&tahun=2031`, { token: kar.t }); cek('Setelah FINAL: Karyawan melihat barisnya', r.s === 200 && r.j.data.length === 1)
  r = await panggil(`/api/payroll/${pg.id}/slip`, { token: kar.t }); cek('Setelah FINAL: slip terbuka untuk pemiliknya', r.s === 200)
  r = await panggil('/api/pengeluaran', { method: 'POST', token: koord.t, body: { studioId: keiko.id, tanggal: '2031-01-05', kategori: 'BEBAN_ORANG', nama: 'UJI upah', jumlah: 1000 } }); cek('Beban orang di bulan yang punya Payroll → ada peringatan', r.s === 201 && !!r.j.peringatan)
  r = await panggil('/api/pengeluaran', { method: 'POST', token: koord.t, body: { studioId: keiko.id, tanggal: '2031-01-06', kategori: 'OPERASIONAL', nama: 'UJI ops', jumlah: 1000 } }); cek('Kategori lain → tanpa peringatan', r.s === 201 && !r.j.peringatan)
  r = await panggil('/api/pengeluaran', { method: 'POST', token: koord.t, body: { studioId: keiko.id, tanggal: '2031-02-05', kategori: 'BEBAN_ORANG', nama: 'UJI upah2', jumlah: 1000 } }); cek('Beban orang di bulan tanpa Payroll → tanpa peringatan', r.s === 201 && !r.j.peringatan)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.pengeluaran.deleteMany({ where: { nama: { startsWith: 'UJI ' } } })
  await prisma.weeklyReport.deleteMany({ where: { studioId: keiko.id, periodeAwal: { gte: new Date('2031-01-01'), lt: new Date('2031-03-01') } } })
  if (pg) await prisma.penggajian.delete({ where: { id: pg.id } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
