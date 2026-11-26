import { DASH } from './_jalur.mjs'
// Uji kolom khusus order (12 Nov 2026, masukan tim): studio mengatur kolom (Ya/Tidak, pilihan, teks), nilai diisi per order, label tampil di
// papan & antrean talent; talent melihat tapi tidak mengisi; validasi nilai; unit lain tidak bisa. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.55.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const P = (await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = []
const user = async (kode, rt, sid = S) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: sid } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let o
try {
  const koord = await user('kk_koord', 'KOORDINATOR'), tal = await user('kk_tal', 'KARYAWAN'), lain = await user('kk_lain', 'KOORDINATOR', P)
  let r = await panggil('/api/circle/kolom-khusus', { method: 'POST', token: tal.c, body: { studioId: S, nama: 'UJI AI', tipe: 'YA_TIDAK' } }); cek('Talent membuat kolom → 403', r.s === 403)
  r = await panggil('/api/circle/kolom-khusus', { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI Pilihan', tipe: 'PILIHAN', pilihan: 'A' } }); cek('Pilihan kurang dari 2 → 422', r.s === 422)
  r = await panggil('/api/circle/kolom-khusus', { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI Boleh pakai AI?', tipe: 'YA_TIDAK' } }); const ai = r.j.data; cek('Koordinator membuat kolom Ya/Tidak → 201', r.s === 201)
  r = await panggil('/api/circle/kolom-khusus', { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI Gaya', tipe: 'PILIHAN', pilihan: 'Chibi, Realis', diKartu: false } }); const gaya = r.j.data; cek('Kolom pilihan (tidak tampil di kartu) → 201', r.s === 201 && gaya.pilihan.length === 2)
  r = await panggil(`/api/circle/kolom-khusus?studioId=${S}`, { token: lain.c }); cek('Koordinator unit lain (circle lain) → 403', r.s === 403)
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const kerja = await prisma.tahapProduksi.findFirst({ where: { studioId: S, jenis: 'KERJA' } })
  o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-KK', judul: 'UJI-KK order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'PROSES', tahapId: kerja.id } })
  await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } })
  const I = `/api/circle/orders/${o.id}/isian-khusus`
  r = await panggil(I, { method: 'PATCH', token: koord.c, body: { [ai.id]: 'Mungkin' } }); cek('Nilai Ya/Tidak tidak sah → 422', r.s === 422)
  r = await panggil(I, { method: 'PATCH', token: koord.c, body: { [gaya.id]: 'Kartun' } }); cek('Nilai di luar pilihan → 422', r.s === 422)
  r = await panggil(I, { method: 'PATCH', token: koord.c, body: { [ai.id]: 'Tidak', [gaya.id]: 'Chibi' } }); cek('Isi nilai → 200', r.s === 200, r.j.message)
  r = await panggil(I, { method: 'PATCH', token: tal.c, body: { [ai.id]: 'Ya' } }); cek('Talent mengisi → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${o.id}/detail`, { token: tal.c })
  cek('Talent melihat nilai di detail order (tanpa bisa mengisi)', r.s === 200 && r.j.data.khusus?.find(k => k.id === ai.id)?.nilai === 'Tidak' && r.j.data.bisaIsiKhusus === false)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const ko = r.j.data?.orders?.find(x => x.id === o.id)
  cek('Kartu papan: label "Boleh pakai AI?: Tidak" (merah), kolom Gaya tidak tampil', ko?.khusus?.length === 1 && ko.khusus[0].nilai === 'Tidak' && ko.khusus[0].nada === 'bad', JSON.stringify(ko?.khusus))
  r = await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token: tal.c }); cek('Tugas saya talent memuat label kolom khusus', r.j.data?.tugas?.find(x => x.id === o.id)?.khusus?.[0]?.nilai === 'Tidak')
  // 20 Nov 2026 (masukan tim): label yang sama juga di Tugas saya › Update klien (dan Antrean klien marketing) — helper labelKhusus yang sama
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); const uk = r.j.data?.baris?.find(x => x.id === o.id)
  cek('Update klien memuat label kolom khusus yang sama dengan kartu (Gaya tidak tampil)', uk?.khusus?.length === 1 && uk.khusus[0].nilai === 'Tidak' && uk.khusus[0].nada === 'bad', JSON.stringify(uk?.khusus))
  r = await panggil(I, { method: 'PATCH', token: koord.c, body: { [ai.id]: '' } }); r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c })
  cek('Dikosongkan → label hilang', (r.j.data.orders.find(x => x.id === o.id)?.khusus ?? []).length === 0)
  r = await panggil(`/api/circle/kolom-khusus/${ai.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus kolom → 200 (nonaktif)', r.s === 200 && !(await prisma.kolomKhususOrder.findUnique({ where: { id: ai.id } })).aktif)
} finally {
  if (o) { await prisma.penugasanTahap.deleteMany({ where: { orderId: o.id } }); await prisma.assignmentProduksi.deleteMany({ where: { orderId: o.id } }); await prisma.orderProduksi.delete({ where: { id: o.id } }) }
  await prisma.kolomKhususOrder.deleteMany({ where: { nama: { startsWith: 'UJI ' } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
