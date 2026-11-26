import { DASH } from './_jalur.mjs'
// Uji pilihan talent (12 Nov 2026, permintaan tim): Buat order (papan.anggota) & Tim order (detail.anggotaUnit) hanya memuat peran kerja
// (tanpa Pendamping/Penasihat), dan bila unit sudah mengonfirmasi Fungsi anggota, hanya yang berfungsi ARTIST. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { token } = {}) => { const r = await fetch('http://localhost:3001' + path, { headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.48.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', Authorization: `Bearer ${token}` } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], orderIds = [], fungsiIds = []
const user = async (kode, studioId, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId } }); dibuat.push(u.id); return { id: u.id, nama: 'Uji ' + kode, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const fungsi = async (u, studioId, f) => { const x = await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId, fungsi: f, terkonfirmasi: true } }); fungsiIds.push(x.id) }
const namaDi = async (studioId, token) => {
  const p = await panggil(`/api/circle/papan?studioId=${studioId}`, { token })
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId, namaAkun: 'Order Internal' } }, update: {}, create: { studioId, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId, akunId: akun.id, klien: 'UJI-PT', judul: 'UJI-PT order', nilaiKotor: 1, nilaiBersih: 1, nilaiDisepakati: 1, tanggalMasuk: new Date() } }); orderIds.push(o.id)
  const d = await panggil(`/api/circle/orders/${o.id}/detail`, { token })
  return { papan: (p.j.data?.anggota ?? []).map(a => a.nama), tim: (d.j.data?.anggotaUnit ?? []).map(a => a.nama), s: [p.s, d.s] }
}
try {
  console.log('— unit dengan Fungsi anggota (Artist) —')
  const koord = await user('pt_koord', keiko.id, 'KOORDINATOR'), artis = await user('pt_artis', keiko.id, 'KARYAWAN'), mkt = await user('pt_mkt', keiko.id, 'KARYAWAN'), pend = await user('pt_pend', keiko.id, 'PENDAMPING')
  await fungsi(artis, keiko.id, 'ARTIST'); await fungsi(mkt, keiko.id, 'MARKETER')
  let r = await namaDi(keiko.id, koord.c)
  cek('Buat order & Tim order: Artist ada', r.papan.includes(artis.nama) && r.tim.includes(artis.nama), JSON.stringify(r.s))
  cek('Marketer & Pendamping tidak ada di pilihan talent', !r.papan.includes(mkt.nama) && !r.tim.includes(mkt.nama) && !r.papan.includes(pend.nama) && !r.tim.includes(pend.nama))
  cek('Semua nama di Tim order = Artist terkonfirmasi', (await prisma.fungsiAnggota.count({ where: { studioId: keiko.id, fungsi: 'ARTIST', terkonfirmasi: true, user: { nama: { in: r.tim } } } })) >= r.tim.length - 0 && r.tim.length > 0)

  console.log('— unit tanpa Fungsi Artist (cadangan) —')
  const tanpa = await prisma.studio.findFirst({ where: { statusAktif: true, circleId: keiko.circleId, id: { not: keiko.id }, fungsiAnggota: { none: { fungsi: 'ARTIST', terkonfirmasi: true } } } })
  if (tanpa) {
    const k2 = await user('pt_koord2', tanpa.id, 'KOORDINATOR'), kar2 = await user('pt_kar2', tanpa.id, 'KARYAWAN'), pend2 = await user('pt_pend2', tanpa.id, 'PENASIHAT')
    r = await namaDi(tanpa.id, k2.c)
    cek(`${tanpa.nama}: semua peran kerja tampil (Karyawan ada), Penasihat tidak`, r.papan.includes(kar2.nama) && r.tim.includes(kar2.nama) && !r.tim.includes(pend2.nama) && !r.papan.includes(pend2.nama), JSON.stringify(r.s))
  } else console.log('(lewati: semua unit di circle ini sudah punya Artist)')
} finally {
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }); await prisma.fungsiAnggota.deleteMany({ where: { id: { in: fungsiIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
