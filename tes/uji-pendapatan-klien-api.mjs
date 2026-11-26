import { DASH } from './_jalur.mjs'
// Uji (12 Nov 2026, masukan tim): penarikan berisi "Dari klien / keterangan" → tampil di Rincian; pemasukan manual di Rincian tampil di
// Biaya & Kas → Pendapatan dan "Pendapatan Usaha" ikut dibandingkan dengan omset. Bulan uji 2031-07; data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.54.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, M = '2031-07'
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = []
const u = await prisma.user.create({ data: { nama: 'Uji pk_koord', email: `uji.pk_koord@uji.local`, passwordHash: hash, statusAktif: true } }); dibuat.push(u.id)
await prisma.userRole.create({ data: { userId: u.id, roleType: 'KOORDINATOR', studioId: S } })
const t = jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' })
try {
  let r = await panggil('/api/circle/kas/penarikan', { method: 'POST', token: t, body: { studioId: S, tanggal: `${M}-05`, jumlah: 750000, dariPlatform: 'komunitas', bankTujuan: 'BCA', atasNama: 'Uji', catatan: 'Klien Uji Komunitas' } })
  cek('Penarikan komunitas dengan keterangan klien → 201', r.s === 201, String(r.s))
  r = await panggil(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${M}`, { token: t })
  cek('Daftar penarikan memuat keterangan klien', r.j.data?.penarikan?.some(w => w.catatan === 'Klien Uji Komunitas'))
  r = await panggil(`/api/circle/buku/rincian?studioId=${S}&bulan=${M}`, { token: t })
  cek('Rincian Tutup bulan menampilkan klien di keterangan penarikan', r.j.data?.baris?.some(b => b.sumber === 'WD' && b.deskripsi.endsWith('· Klien Uji Komunitas')))
  const kat = (await panggil('/api/circle/buku/kategori', { token: t })).j.data.kategori.find(k => k.nama === 'Pendapatan Usaha')
  r = await panggil('/api/circle/buku/entri', { method: 'POST', token: t, body: { studioId: S, kategoriId: kat.id, tanggal: `${M}-08`, deskripsi: 'UJI-PK transfer langsung klien', jumlah: 300000 } })
  cek('Entri manual Pendapatan Usaha di Rincian → 201', r.s === 201)
  r = await panggil(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${M}`, { token: t }); const d = r.j.data
  cek('Biaya & Kas → Pendapatan menampilkan pemasukan manual dari Rincian', d.manual?.some(m => m.deskripsi === 'UJI-PK transfer langsung klien' && m.jumlah === 300000) && d.ringkasan.manualUsaha === 300000)
  cek('Selisih perbandingan ikut memperhitungkan pendapatan usaha manual', d.ringkasan.selisih === Math.round(d.ringkasan.omzetBersihOrder - d.ringkasan.ditarik - d.ringkasan.tertahan - 300000))
  cek('Saran nama klien tersedia untuk isian penarikan', Array.isArray(d.klien))
} finally {
  await prisma.entriLedger.deleteMany({ where: { studioId: S, bulan: M } }); await prisma.penarikanPendapatan.deleteMany({ where: { studioId: S, bulan: M } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
