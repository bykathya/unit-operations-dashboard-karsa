import { DASH } from './_jalur.mjs'
// Uji tombol Ubah di Biaya & Kas (12 Nov 2026, permintaan Udin): biaya & penarikan bisa diubah dengan isian yang sama seperti form catat
// (termasuk mengosongkan jatuh tempo/freelancer/tautan), talent ditolak, bulan yang sudah ditutup ditolak. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], biayaIds = [], wdIds = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const K = '/api/circle/kas', M = '2031-12', MT = '2031-11'
try {
  const koord = await user('uk_koord', 'KOORDINATOR'), kar = await user('uk_kar', 'KARYAWAN')
  console.log('— ubah biaya —')
  let r = await panggil(`${K}/biaya`, { method: 'POST', token: koord.t, body: { studioId: S, kategori: 'UJI-UK sewa', tanggal: `${M}-05`, jumlah: 100000, deskripsi: 'awal', jatuhTempo: `${M}-20`, freelancer: 'Freelance A', linkInvoice: 'https://contoh.id/inv' } })
  const bid = r.j.data?.id; if (bid) biayaIds.push(bid); cek('Catat biaya → 201', r.s === 201, String(r.s))
  r = await panggil(`${K}/biaya/${bid}`, { method: 'PATCH', token: koord.t, body: { kategori: 'UJI-UK sewa', tanggal: `${M}-07`, jumlah: 150000, deskripsi: 'diubah', jatuhTempo: null, freelancer: null, linkInvoice: null, rekeningId: null } })
  cek('Ubah biaya (jumlah, tanggal, deskripsi; kosongkan tempo/freelancer/tautan) → 200', r.s === 200 && r.j.data?.jumlah === 150000 && r.j.data.tanggal === `${M}-07` && r.j.data.deskripsi === 'diubah' && r.j.data.jatuhTempo === null && r.j.data.freelancer === null && r.j.data.linkInvoice === null, JSON.stringify(r.j).slice(0, 140))
  r = await panggil(`${K}/biaya/${bid}`, { method: 'PATCH', token: kar.t, body: { jumlah: 1 } }); cek('Talent mengubah biaya → 403', r.s === 403)
  console.log('— ubah penarikan —')
  r = await panggil(`${K}/penarikan`, { method: 'POST', token: koord.t, body: { studioId: S, tanggal: `${M}-03`, jumlah: 500000, dariPlatform: 'fiverr', bankTujuan: 'BCA', atasNama: 'Uji' } })
  const wid = r.j.data?.id; if (wid) wdIds.push(wid); cek('Catat penarikan → 201', r.s === 201, String(r.s))
  r = await panggil(`${K}/penarikan/${wid}`, { method: 'PATCH', token: koord.t, body: { tanggal: `${M}-04`, jumlah: 650000, dariPlatform: 'komunitas', bankTujuan: 'BCA', atasNama: 'Uji', rekeningId: null } })
  cek('Ubah penarikan (jumlah, tanggal, platform komunitas) → 200', r.s === 200 && r.j.data?.jumlah === 650000 && r.j.data.dariPlatform === 'komunitas' && r.j.data.tanggal === `${M}-04`, JSON.stringify(r.j).slice(0, 140))
  r = await panggil(`${K}/penarikan/${wid}`, { method: 'PATCH', token: kar.t, body: { jumlah: 1 } }); cek('Talent mengubah penarikan → 403', r.s === 403)
  console.log('— bulan sudah ditutup —')
  await prisma.statusBulan.create({ data: { studioId: S, bulan: MT, status: 'DITUTUP' } })
  r = await panggil(`${K}/penarikan/${wid}`, { method: 'PATCH', token: koord.t, body: { tanggal: `${MT}-28` } }); cek('Pindahkan penarikan ke bulan yang sudah ditutup → 409', r.s === 409, String(r.s))
  const wTutup = await prisma.penarikanPendapatan.create({ data: { nomor: `UJI-UK-${Date.now()}`, studioId: S, tanggal: new Date(`${MT}-10T00:00:00Z`), bulan: MT, jumlah: 1000, dariPlatform: 'fiverr', bankTujuan: 'BCA', atasNama: 'Uji' } }); wdIds.push(wTutup.id)
  r = await panggil(`${K}/penarikan/${wTutup.id}`, { method: 'PATCH', token: koord.t, body: { jumlah: 2000 } }); cek('Ubah penarikan di bulan ditutup → 409', r.s === 409, String(r.s))
  r = await panggil(`${K}/penarikan/${wTutup.id}`, { method: 'DELETE', token: koord.t }); cek('Hapus penarikan di bulan ditutup → 409', r.s === 409, String(r.s))
  r = await panggil(`${K}/biaya/${bid}`, { method: 'PATCH', token: koord.t, body: { tanggal: `${MT}-20` } }); cek('Pindahkan biaya ke bulan ditutup → 409', r.s === 409, String(r.s))
} finally {
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: { in: [M, MT] } } })
  await prisma.biayaStudio.deleteMany({ where: { id: { in: biayaIds } } }); await prisma.penarikanPendapatan.deleteMany({ where: { id: { in: wdIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
