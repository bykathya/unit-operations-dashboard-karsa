import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const orderIds = []
try {
  const koord = await user('am_koord', [['KOORDINATOR', S]]), kar = await user('am_kar', [['KARYAWAN', S]]), adm = await user('am_adm', [['KARYAWAN', S]]), lain = await user('am_lain', [['KOORDINATOR', pibi.id]]), luar = await user('am_luar', [['KARYAWAN', pibi.id]])
  const A = '/api/circle/admin-market'
  let r = await panggil(`${A}?studioId=${S}`, { token: kar.t }); cek('Karyawan melihat admin market → 403', r.s === 403)
  r = await panggil(`${A}?studioId=${S}`, { token: lain.t }); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(A, { method: 'POST', token: koord.t, body: { studioId: S, userId: luar.id } }); cek('Menambah orang di luar unit → 422', r.s === 422)
  r = await panggil(A, { method: 'POST', token: koord.t, body: { studioId: S, userId: adm.id } }); cek('Koordinator menambah admin market → 201', r.s === 201); const id = r.j.data?.id
  r = await panggil(A, { method: 'POST', token: koord.t, body: { studioId: S, userId: adm.id } }); cek('Dua kali → 409', r.s === 409)
  r = await panggil(`${A}?studioId=${S}`, { token: koord.t }); cek('Daftar memuat admin + anggota unit', r.s === 200 && r.j.data.admin.some(a => a.userId === adm.id) && r.j.data.anggota.length >= 3)
  r = await panggil(`/api/circle/mulai?studioId=${S}`, { token: adm.t }); const mulai = r.s
  r = await panggil(`${A}?studioId=${S}`, { token: adm.t }); cek('Admin market sendiri TIDAK bisa mengatur admin market (→ 403)', r.s === 403)
  r = await panggil(`${A}/${id}`, { method: 'DELETE', token: lain.t }); cek('Koordinator unit lain mencabut → 403', r.s === 403)
  r = await panggil(`${A}/${id}`, { method: 'DELETE', token: koord.t }); cek('Koordinator mencabut → 200', r.s === 200)
  console.log('— payroll: pilihan order lembur —')
  const akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-AM k', judul: 'UJI-AM order', nilaiKotor: 1, nilaiBersih: 1 } }); orderIds.push(o.id)
  const b = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-AM k', judul: 'UJI-AM batal', nilaiKotor: 1, nilaiBersih: 1, status: 'BATAL' } }); orderIds.push(b.id)
  r = await panggil(`/api/payroll/order-opsi?studioId=${S}`, { token: kar.tApp }); cek('Pilihan order lembur di Payroll di Management Dashboard sudah dihapus (lembur per project dicatat di web circle) → 404', r.s === 404)
  r = await panggil(`/api/payroll/order-opsi?studioId=${S}`, { token: lain.tApp }); cek('… juga untuk Koordinator unit lain → 404', r.s === 404)
  r = await panggil(`/api/payroll/order-opsi?studioId=${S}`, { token: koord.tApp }); cek('… dan Koordinator unit sendiri → 404', r.s === 404)
  console.log('— endpoint lama sudah hilang —')
  r = await panggil('/api/produksi/orders?studioId=' + S, { token: koord.tApp }); cek('/api/produksi → 404', r.s === 404)
  r = await panggil('/api/marketing/leads', { token: koord.tApp }); cek('/api/marketing → 404', r.s === 404)
} finally {
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
