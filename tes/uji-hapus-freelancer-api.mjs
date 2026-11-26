import { DASH } from './_jalur.mjs'
// Uji hapus freelancer (12 Nov 2026, masukan tim): terhapus dari daftar, riwayat order aman (nama di order & fee tetap, tautan dilepas),
// talent ditolak, freelancer milik circle lain tidak bisa dihapus. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.51.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], T = Date.now()
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let o, asing
try {
  const koord = await user('hf_koord', 'KOORDINATOR'), kar = await user('hf_kar', 'KARYAWAN')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-HF', judul: 'UJI-HF order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } })
  const NAMA = `UJI-HF aldi ${T}`
  await panggil(`/api/circle/orders/${o.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: NAMA } })
  const asg = await prisma.assignmentProduksi.findFirst({ where: { orderId: o.id, namaEksternal: NAMA } }); await prisma.assignmentProduksi.update({ where: { id: asg.id }, data: { feeTalent: 400000 } })
  const t = await prisma.talentEksternal.findUnique({ where: { id: asg.talentEksternalId } })
  let r = await panggil(`/api/circle/freelancer/${t.id}?studioId=${S}`, { method: 'DELETE', token: kar.c }); cek('Talent menghapus freelancer → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer/${t.id}?studioId=${S}`, { method: 'DELETE', token: koord.c }); cek('Koordinator menghapus freelancer (punya 1 order) → 200', r.s === 200, r.j.message)
  const a2 = await prisma.assignmentProduksi.findUnique({ where: { id: asg.id } })
  cek('Freelancer hilang dari data induk; nama & fee di order tetap, tautan dilepas', !(await prisma.talentEksternal.findUnique({ where: { id: t.id } })) && a2.namaEksternal === NAMA && a2.feeTalent === 400000 && a2.talentEksternalId === null)
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: koord.c }); cek('Tidak tampil lagi di menu Freelancer', !r.j.data?.some(f => f.nama === NAMA))
  asing = await prisma.talentEksternal.create({ data: { nama: `UJI-HF asing ${T}`, lingkupKunci: 'c:circle-lain-uji' } })
  await prisma.assignmentProduksi.create({ data: { orderId: o.id, namaEksternal: asing.nama, tipeEksternal: 'FREELANCER_PERORANGAN', talentEksternalId: asing.id } })
  r = await panggil(`/api/circle/freelancer/${asing.id}?studioId=${S}`, { method: 'DELETE', token: koord.c }); cek('Freelancer milik circle lain → 409 (nonaktifkan saja)', r.s === 409, String(r.s))
} finally {
  if (o) { await prisma.assignmentProduksi.deleteMany({ where: { orderId: o.id } }); await prisma.orderProduksi.delete({ where: { id: o.id } }) }
  if (asing) await prisma.talentEksternal.deleteMany({ where: { id: asing.id } })
  await prisma.talentEksternal.deleteMany({ where: { nama: { startsWith: 'UJI-HF' } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
