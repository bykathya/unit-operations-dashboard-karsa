import { DASH } from './_jalur.mjs'
// Uji ubah/hapus catatan Update klien (12 Nov 2026, masukan tim): catatan bisa diubah; catatan manual bisa dihapus; catatan otomatis tidak
// bisa dihapus; talent ditolak. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.56.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let o
try {
  const koord = await user('uuk_koord', 'KOORDINATOR'), tal = await user('uuk_tal', 'KARYAWAN')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-UUK', judul: 'UJI-UUK order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'PROSES' } })
  let r = await panggil('/api/circle/update-klien', { method: 'POST', token: koord.c, body: { orderId: o.id, jenis: 'KATA', catatan: 'tidak boleh pake AI' } }); const id = r.j.data?.id
  cek('Catat update klien → 201', r.s === 201)
  r = await panggil(`/api/circle/update-klien/catatan/${id}`, { method: 'PATCH', token: tal.c, body: { catatan: 'x' } }); cek('Talent mengubah → 403', r.s === 403)
  r = await panggil(`/api/circle/update-klien/catatan/${id}`, { method: 'PATCH', token: koord.c, body: { catatan: 'boleh pakai AI untuk referensi saja' } }); cek('Ubah catatan → 200', r.s === 200)
  r = await panggil(`/api/circle/update-klien/${o.id}/riwayat`, { token: koord.c }); cek('Riwayat menampilkan catatan baru', r.j.data?.find(x => x.id === id)?.catatan === 'boleh pakai AI untuk referensi saja')
  const oto = await prisma.updateKlien.create({ data: { orderId: o.id, studioId: S, jenis: 'PREVIEW', otomatis: true } })
  r = await panggil(`/api/circle/update-klien/catatan/${oto.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus catatan otomatis → 409', r.s === 409)
  r = await panggil(`/api/circle/update-klien/catatan/${oto.id}`, { method: 'PATCH', token: koord.c, body: { catatan: 'preview dikirim lewat WA' } }); cek('Catatan otomatis tetap bisa diberi keterangan → 200', r.s === 200)
  r = await panggil(`/api/circle/update-klien/catatan/${id}`, { method: 'DELETE', token: koord.c }); cek('Hapus catatan manual → 200', r.s === 200 && !(await prisma.updateKlien.findUnique({ where: { id } })))
} finally {
  if (o) await prisma.orderProduksi.delete({ where: { id: o.id } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
