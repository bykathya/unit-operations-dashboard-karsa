import { DASH } from './_jalur.mjs'
// Uji Penggajian di web circle (10 Nov 2026): rincian tetap (THP Bio dipecah), siapkan slip, edit DRAFT, Final → Dibayar, akses per peran, data slip PDF.
// Memakai bulan 1/2099 supaya tidak menyentuh data nyata; semua data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.44.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const lain = await prisma.studio.findFirst({ where: { id: { not: keiko.id }, nama: { not: { contains: 'Keiko' } } } })
const S = keiko.id, B = 1, T = 2099
const hash = await bcrypt.hash('uji-gaji-' + Date.now(), 4)
const dibuat = []
const user = async (kode, roles, thp) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId, takeHomePay: thp ?? 0 } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const bersih = async () => {
  const sl = await prisma.penggajian.findMany({ where: { studioId: S, tahun: T }, select: { id: true } }), ids = sl.map(x => x.id)
  await prisma.tunjanganPenggajian.deleteMany({ where: { penggajianId: { in: ids } } }); await prisma.penggajian.deleteMany({ where: { id: { in: ids } } })
  await prisma.rincianGajiTetap.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
}
try {
  const koord = await user('gj_koord', [['KOORDINATOR', S]], 0)
  const budi = await user('gj_budi', [['KARYAWAN', S]], 3000000), sari = await user('gj_sari', [['KARYAWAN', S]], 0)
  const pemilik = await user('gj_kar2', [['KARYAWAN', S]], 2000000)
  const asing = lain ? await user('gj_asing', [['KOORDINATOR', lain.id]], 0) : null
  const G = (q = '') => `/api/circle/gaji?studioId=${S}&bulan=${B}&tahun=${T}${q}`

  console.log('— akses daftar —')
  let r = await panggil(G(), { token: koord.c }); cek('Koordinator melihat daftar gaji unitnya → 200', r.s === 200, String(r.s))
  r = await panggil(G(), { token: budi.c }); cek('Anggota biasa membuka daftar gaji unit → 403', r.s === 403, String(r.s))
  if (asing) { r = await panggil(G(), { token: asing.c }); cek('Koordinator unit lain → 403', r.s === 403, String(r.s)) }
  r = await panggil(G()); cek('Tanpa token → 401', r.s === 401)
  r = await panggil(`/api/circle/gaji?studioId=${S}&bulan=13&tahun=${T}`, { token: koord.c }); cek('Bulan 13 → 422', r.s === 422)

  console.log('— rincian tetap —')
  r = await panggil(G(), { token: koord.c }); const bb = r.j.data?.baris.find(x => x.userId === budi.id), ss = r.j.data?.baris.find(x => x.userId === sari.id)
  cek('THP Bio terbaca (Budi 3.000.000), belum dipecah → seluruhnya gaji pokok', bb?.thpBio === 3000000 && bb.gajiPokokDasar === 3000000)
  cek('Orang tanpa THP diperingatkan', r.j.data?.peringatan.tanpaThp.some(n => n.includes('gj_sari')))
  const simpan = (userId, komponen) => panggil('/api/circle/gaji/rincian', { method: 'PUT', token: koord.c, body: { studioId: S, userId, komponen } })
  r = await simpan(budi.id, [{ nama: 'Tunjangan makan', jumlah: 2500000 }, { nama: 'Transport', jumlah: 600000 }]); cek('Rincian melebihi THP → 422', r.s === 422, r.j.message?.slice(0, 60))
  r = await simpan(budi.id, [{ nama: 'Makan', jumlah: 500000 }, { nama: 'makan', jumlah: 100000 }]); cek('Nama komponen dobel → 422', r.s === 422)
  r = await simpan(budi.id, [{ nama: 'Makan', jumlah: -5 }]); cek('Jumlah negatif → 422', r.s === 422)
  r = await simpan(sari.id, [{ nama: 'Makan', jumlah: 100 }]); cek('THP belum diisi di Bio → 422', r.s === 422)
  r = await simpan(budi.id, [{ nama: 'Tunjangan makan', jumlah: 500000 }, { nama: 'Transport', jumlah: 300000 }]); cek('Rincian sah disimpan → gaji pokok 2.200.000', r.s === 200 && r.j.data?.gajiPokokDasar === 2200000, JSON.stringify(r.j.data))
  r = await panggil('/api/circle/gaji/rincian', { method: 'PUT', token: budi.c, body: { studioId: S, userId: budi.id, komponen: [] } }); cek('Anggota mengubah rincian sendiri → 403', r.s === 403)

  console.log('— siapkan slip —')
  r = await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: B, tahun: T } }); cek('Siapkan slip → 200', r.s === 200, r.j.message)
  r = await panggil(G(), { token: koord.c }); const s1 = r.j.data?.baris.find(x => x.userId === budi.id)?.slip
  cek('Slip Budi: gaji pokok 2.200.000 + 2 komponen tetap = THP 3.000.000', s1?.gajiPokok === 2200000 && s1.baris.length === 2 && s1.thp === 3000000, JSON.stringify(s1 && { g: s1.gajiPokok, thp: s1.thp, n: s1.baris.length }))
  cek('Orang tanpa THP tidak dibuatkan slip', !r.j.data.baris.find(x => x.userId === sari.id)?.slip)
  await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: B, tahun: T } })
  r = await panggil(G(), { token: koord.c }); const s2 = r.j.data?.baris.find(x => x.userId === budi.id)?.slip
  cek('Siapkan dua kali tidak menggandakan komponen/slip', s2?.id === s1.id && s2.baris.length === 2 && s2.thp === 3000000)

  console.log('— edit draft —')
  r = await panggil(`/api/circle/gaji/${s1.id}`, { method: 'PATCH', token: koord.c, body: { bonus: 400000, potongan: 100000, catatan: 'Bonus target' } }); cek('Bonus & potongan diisi → 200', r.s === 200)
  r = await panggil(`/api/circle/gaji/${s1.id}/baris`, { method: 'POST', token: koord.c, body: { nama: 'Uang lembur luar', jumlah: 150000 } }); cek('Tambah baris bulan ini → 201', r.s === 201)
  r = await panggil(G(), { token: koord.c }); const s3 = r.j.data.baris.find(x => x.userId === budi.id).slip
  cek('THP = 3.000.000 + 400.000 + 150.000 − 100.000 = 3.450.000', s3.thp === 3450000, String(s3.thp))
  const tetap = s3.baris.find(x => x.tetap), tambahan = s3.baris.find(x => !x.tetap)
  r = await panggil(`/api/circle/gaji/baris/${tetap.id}`, { method: 'DELETE', token: koord.c }); cek('Baris dari rincian tetap tak bisa dihapus dari slip → 409', r.s === 409)
  r = await panggil(`/api/circle/gaji/${s1.id}`, { method: 'PATCH', token: koord.c, body: { bonus: -1 } }); cek('Bonus negatif → 422', r.s === 422)
  r = await panggil(`/api/circle/gaji/${s1.id}`, { method: 'PATCH', token: budi.c, body: { bonus: 99999999 } }); cek('Anggota mengubah slipnya sendiri → 403', r.s === 403)

  console.log('— tanggal gajian & SHU —')
  cek('Slip baru: jadwal gajian bawaan tanggal 27 bulan itu', s3.tanggalBayar === '2099-01-27' && s3.tanggalBayarShu === null, String(s3.tanggalBayar))
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: koord.c, body: { tanggalBayar: '2099-01-25', tanggalBayarShu: '2099-02-10' } }); cek('Ubah tanggal gajian & SHU → 200', r.s === 200)
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: koord.c, body: { tanggalBayar: 'besok' } }); cek('Format tanggal salah → 422', r.s === 422)
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: koord.c, body: { tanggalBayar: '' } }); cek('Tanggal gajian dikosongkan → 422', r.s === 422)
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: budi.c, body: { tanggalBayar: '2099-01-01' } }); cek('Anggota mengubah tanggal → 403', r.s === 403)
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: koord.c, body: { tanggalBayarShu: '' } }); cek('Tanggal SHU boleh dikosongkan → 200', r.s === 200)
  console.log('— akses slip & status —')
  r = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: budi.c }); cek('Pemilik slip melihat slip DRAFT → 403', r.s === 403)
  r = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: koord.c }); cek('Koordinator melihat data slip DRAFT → 200', r.s === 200 && r.j.data?.thp === 3450000 && r.j.data.tetap.length === 2 && r.j.data.tambahan.length === 1)
  r = await panggil(`/api/circle/gaji/${s1.id}/final`, { method: 'POST', token: koord.c }); cek('Finalkan → 200', r.s === 200)
  r = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: budi.c }); cek('Pemilik melihat slip FINAL → 200', r.s === 200 && r.j.data?.nama.includes('gj_budi'))
  const rb = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: pemilik.c }); cek('Rekan lain membuka slip Budi → 403', rb.s === 403)
  r = await panggil(`/api/circle/gaji/${s1.id}`, { method: 'PATCH', token: koord.c, body: { bonus: 1 } }); cek('Edit slip FINAL → 409', r.s === 409)
  r = await panggil('/api/circle/gaji/siapkan', { method: 'POST', token: koord.c, body: { studioId: S, bulan: B, tahun: T } })
  r = await panggil(G(), { token: koord.c }); cek('Siapkan ulang tidak menimpa slip FINAL', r.j.data.baris.find(x => x.userId === budi.id).slip.thp === 3450000)
  r = await panggil(`/api/circle/gaji/${s1.id}/dibayar`, { method: 'POST', token: koord.c, body: { tanggalBayar: '2099-01-27' } }); cek('Tandai dibayar (dengan tanggal) → 200', r.s === 200)
  r = await panggil(`/api/circle/gaji/${s1.id}/tanggal`, { method: 'PATCH', token: koord.c, body: { tanggalBayar: '2099-01-30' } }); cek('Slip dibayar: tanggal tak bisa diubah → 409', r.s === 409)
  r = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: budi.c }); cek('Data slip memuat tanggal bayar', r.j.data?.tanggalBayar === '2099-01-27')
  r = await panggil(`/api/circle/gaji/${s1.id}/buka`, { method: 'POST', token: koord.c }); cek('Buka kembali slip yang sudah dibayar → 409', r.s === 409)
  const s4 = r.j && (await panggil(G(), { token: koord.c })).j.data.baris.find(x => x.userId === pemilik.id)?.slip
  r = await panggil(`/api/circle/gaji/${s4.id}/final`, { method: 'POST', token: koord.c }); r = await panggil(`/api/circle/gaji/${s4.id}/buka`, { method: 'POST', token: koord.c }); cek('Slip FINAL (belum dibayar) bisa dibuka kembali', r.s === 200)
  r = await panggil('/api/circle/gaji/final-semua', { method: 'POST', token: koord.c, body: { studioId: S, bulan: B, tahun: T } }); cek('Finalkan semua draft → 200', r.s === 200)
  if (asing) { r = await panggil(`/api/circle/gaji/${s1.id}/slip`, { token: asing.c }); cek('Koordinator unit lain membuka slip → 403', r.s === 403) }
  r = await panggil('/api/circle/slip-saya?tahun=2099', { token: budi.c }); cek('"Slip saya" memuat slip final milik sendiri', r.s === 200 && r.j.data?.slip.some(x => x.id === s1.id), String(r.s))
} finally { await bersih(); await prisma.$disconnect() }
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
