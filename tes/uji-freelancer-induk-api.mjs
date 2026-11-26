import { DASH } from './_jalur.mjs'
// Uji ATURAN LEMBUR PER UNIT (21 Okt 2026): perhitungan murni (utils/lembur.js) + alur API (koordinator mengatur, lembur manual menunggu
// persetujuan, Payroll hanya mengklaim lembur DISETUJUI milik unitnya, dihitung dengan aturan unit). Data sementara dihapus di akhir.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.37.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }

let xff = 0
const S = keiko.id
let idsFl = []
try {
  const koord = await user('fm_koord', [['KOORDINATOR', S]]), kar = await user('fm_kar', [['KARYAWAN', S]])
  let r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: kar.c }); cek('Karyawan membuka data freelancer → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: kar.c, body: { studioId: S, nama: 'UJI-FM x' } }); cek('Karyawan tambah freelancer → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: koord.c, body: { studioId: S, nama: '  ' } }); cek('Nama kosong → 422', r.s === 422)
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI-FM Putra', kontak: '0812', bank: 'BCA', noRekening: '1234567890', atasNamaRekening: 'Putra', skill: '3D Modeling + Animation UJI', tautanPorto: 'https://drive.google.com/x' } })
  const f1 = r.j.data; if (f1?.id) idsFl.push(f1.id)
  cek('Koordinator menambah freelancer lengkap', r.s === 201 && f1.nama === 'UJI-FM Putra')
  cek('Respons TIDAK memuat nomor rekening utuh (tersamar)', f1.rekening === '•••• 7890' && !JSON.stringify(r.j).includes('1234567890'))
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'uji-fm putra' } }); cek('Nama sama (beda huruf) → 409', r.s === 409)
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI-FM Salah', tautanPorto: 'javascript:alert(1)' } }); cek('Tautan porto bukan http(s) → 422', r.s === 422)
  r = await panggil(`/api/circle/freelancer`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI-FM Salah', noRekening: 'abc' } }); cek('No. rekening bukan angka → 422', r.s === 422)
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: koord.c }); const a = r.j.data?.find(x => x.id === f1.id)
  cek('Daftar memuat freelancer baru (0 order) tanpa rekening utuh', r.s === 200 && a?.skill?.includes('Animation UJI') && a.adaRekening && !JSON.stringify(r.j).includes('1234567890'))
  r = await panggil(`/api/circle/freelancer/${f1.id}`, { method: 'PATCH', token: koord.c, body: { studioId: S, kontak: '0899', noRekening: '' } })
  cek('Ubah kontak; rekening kosong = tidak diganti', r.s === 200 && (await prisma.talentEksternal.findUnique({ where: { id: f1.id } })).noRekening === '1234567890' && r.j.data.kontak === '0899')
  r = await panggil(`/api/circle/freelancer/${f1.id}`, { method: 'PATCH', token: koord.c, body: { studioId: S, noRekening: '9876543210' } }); cek('Rekening diganti bila diisi', (await prisma.talentEksternal.findUnique({ where: { id: f1.id } })).noRekening === '9876543210')
  r = await panggil(`/api/circle/freelancer/${f1.id}`, { method: 'PATCH', token: kar.c, body: { studioId: S, kontak: '1' } }); cek('Karyawan ubah freelancer → 403', r.s === 403)
  const lain = await prisma.studio.findFirst({ where: { circleId: { not: null, not: keiko.circleId } }, select: { id: true, circleId: true } })
  const asing = await prisma.talentEksternal.create({ data: { nama: 'UJI-FM Orang Circle Lain', lingkupKunci: `c:${lain.circleId}` } })
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: koord.c }); cek('Freelancer circle lain TIDAK terlihat (isolasi antar circle)', !r.j.data.some(x => x.id === asing.id))
  r = await panggil(`/api/circle/ltk/opsi?studioId=${S}`, { token: koord.c }); const p = r.j.data?.pihak?.find(x => x.nama === 'UJI-FM Putra')
  cek('Pilihan freelance di form order/LTK memuat freelancer induk + keahlian + kontak', p?.jenisPihak === 'FREELANCE' && p.kontak === '0899' && p.skill?.includes('Animation UJI'))
  r = await panggil(`/api/circle/freelancer/${f1.id}`, { method: 'PATCH', token: koord.c, body: { studioId: S, aktif: false } })
  r = await panggil(`/api/circle/ltk/opsi?studioId=${S}`, { token: koord.c }); cek('Freelancer nonaktif tidak muncul di pilihan', !r.j.data.pihak.some(x => x.nama === 'UJI-FM Putra'))
} finally {
  await prisma.talentEksternal.deleteMany({ where: { OR: [{ id: { in: idsFl } }, { nama: { startsWith: 'UJI-FM' } }] } })
  await prisma.kategoriOrder.deleteMany({ where: { studioId: S, nama: { in: ['3D Modeling', 'Animation UJI'] }, createdAt: { gte: new Date(Date.now() - 600000) } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
