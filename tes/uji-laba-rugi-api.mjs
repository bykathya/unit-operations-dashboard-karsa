import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.40.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
// Angka Bio (biaya rutin, THP, SHU) ikut dihitung buku besar sejak 12 Nov 2026 — dinolkan sementara agar hitungan eksak, dipulihkan di finally
const { nolkanBio } = await import('./_isolasi-bio.mjs')
const pulihkanBio = await nolkanBio(prisma, [keiko.id, pibi.id])
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const L = await import(DASH + '/server/src/utils/labaRugi.js')
console.log('— logika murni —')
const bl = [
  { bulan: '2031-01', perKategori: [{ kategori: 'Pendapatan', arus: 'INCOME', sifat: null, jumlah: 1000 }, { kategori: 'Gaji', arus: 'EXPENSE', sifat: 'TETAP', jumlah: 400 }], masuk: 1000, tetap: 400, variabel: 0, kasAkhir: 600, status: 'DITUTUP' },
  { bulan: '2031-02', perKategori: [{ kategori: 'Pendapatan', arus: 'INCOME', sifat: null, jumlah: 2000 }, { kategori: 'Gaji', arus: 'EXPENSE', sifat: 'TETAP', jumlah: 400 }, { kategori: 'Iklan', arus: 'EXPENSE', sifat: 'VARIABEL', jumlah: 200 }], masuk: 2000, tetap: 400, variabel: 200, kasAkhir: 2000, status: 'BERJALAN' },
  { bulan: '2031-03', perKategori: [], masuk: 0, tetap: 0, variabel: 0, kasAkhir: 2000, status: 'BERJALAN' },
]
const mx = L.matriksLabaRugi(bl)
cek('Matriks: laba rugi per bulan & total', JSON.stringify(mx.labaRugi) === '[600,1400,0]' && mx.jumlah.labaRugi === 2000 && mx.jumlah.masuk === 3000)
cek('Baris kategori: Pendapatan [1000,2000,0], Gaji total 800, urut terbesar dulu', mx.pendapatan[0].total === 3000 && mx.pengeluaran[0].kategori === 'Gaji' && mx.pengeluaran[0].total === 800 && JSON.stringify(mx.pengeluaran[1].sel) === '[0,200,0]')
cek('Margin = 2000/3000 = 66,7%', mx.marginPersen === 66.7)
const pr = L.proyeksi(bl, { ke: 2, jendela: 3 })
cek('Proyeksi memakai bulan berisi data saja (Jan–Feb), rata-rata masuk 1500, keluar 500', pr.dasar.join() === '2031-01,2031-02' && pr.rataMasuk === 1500 && pr.rataKeluar === 500)
cek('Proyeksi: bulan berikut Feb → 2031-03, kas bergulir 2000+1000, +1000', pr.bulan[0].bulan === '2031-03' && pr.bulan[0].kasAkhir === 3000 && pr.bulan[1].kasAkhir === 4000)
cek('Tanpa data → proyeksi null', L.proyeksi([bl[2]]) === null)

const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const B = '/api/circle/buku', S = keiko.id
const entriId = []
try {
  const koord = await user('lr_koord', [['KOORDINATOR', S]]), kar = await user('lr_kar', [['KARYAWAN', S]]), lain = await user('lr_lain', [['KOORDINATOR', pibi.id]])
  console.log('— API —')
  let r = await panggil(`${B}/laba-rugi?studioId=${S}&tahun=2031`, { token: kar.t, web: 'bloom' }); cek('Karyawan → 403', r.s === 403)
  r = await panggil(`${B}/laba-rugi?studioId=${S}&tahun=2031`, { token: lain.t, web: 'bloom' }); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${B}/laba-rugi?studioId=${S}&tahun=abc`, { token: koord.t, web: 'bloom' }); cek('Tahun tak valid → 422', r.s === 422)
  r = await panggil(`${B}/laba-rugi?studioId=${S}&tahun=2031`, { token: koord.t, web: 'bloom' }); cek('Tahun kosong data: 12 bulan nol, tanpa proyeksi', r.s === 200 && r.j.data.bulan.length === 12 && r.j.data.jumlah.masuk === 0 && r.j.data.proyeksi === null)
  const kat = (await panggil(`${B}/kategori`, { token: koord.t, web: 'bloom' })).j.data.kategori
  const pem = kat.find(k => k.arus === 'INCOME'), ben = kat.find(k => k.arus === 'EXPENSE')
  for (const [k, tg, j] of [[pem, '2031-04-10', 900000], [ben, '2031-04-12', 300000], [pem, '2031-06-10', 600000]]) { const e = await panggil(`${B}/entri`, { method: 'POST', token: koord.t, web: 'bloom', body: { studioId: S, kategoriId: k.id, tanggal: tg, deskripsi: 'UJI-LR', jumlah: j } }); entriId.push(e.j.data?.id) }
  r = await panggil(`${B}/laba-rugi?studioId=${S}&tahun=2031`, { token: koord.t, web: 'bloom' })
  const d = r.j.data
  cek('April: masuk 900.000, laba rugi 600.000; Juni masuk 600.000', d.totalMasuk[3] === 900000 && d.labaRugi[3] === 600000 && d.totalMasuk[5] === 600000)
  cek('Jumlah tahun: masuk 1.500.000, laba 1.200.000 (entri manual saja)', d.jumlah.masuk === 1500000 && d.jumlah.labaRugi === 900000 + 600000 - 300000, JSON.stringify(d.jumlah))
  cek('Baris kategori memuat sel April', d.pendapatan.some(p => p.sel[3] === 900000))
} finally {
  await pulihkanBio()
  await prisma.entriLedger.deleteMany({ where: { deskripsi: 'UJI-LR' } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
