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
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }

const { hitungLembur, validasiProgres, nilaiLevel, validasiAturan } = await import(DASH + '/server/src/utils/lembur.js')
console.log('— rumus Sekai Land (murni) —')
// baris tabel tim: [fee level, mulai%, selesai%, fee akhir]
for (const [fee, a, b, hasil] of [[30000, 30, 60, 9000], [30000, 80, 100, 6000], [100000, 0, 50, 50000], [100000, 50, 80, 30000], [100000, 70, 80, 10000], [100000, 35, 50, 15000], [100000, 0, 35, 35000], [30000, 80, 90, 3000]]) {
  const v = validasiProgres(a, b); cek(`fee ${fee} progres ${a}→${b}% = ${hasil}`, !v.galat && nilaiLevel(fee, v.awal, v.akhir) === hasil)
}
cek('Progres akhir ≤ awal → galat', !!validasiProgres(50, 50).galat && !!validasiProgres(60, 40).galat)
cek('Progres >100 / kosong → galat', !!validasiProgres(0, 120).galat && !!validasiProgres('', 50).galat)
cek('Validasi aturan PER_LEVEL diterima', !validasiAturan({ mode: 'PER_LEVEL' }).galat)
const h = hitungLembur([{ tanggalKerja: new Date('2031-03-03T00:00:00Z'), menit: 60, status: 'DISETUJUI', nilaiProyek: 9000 }, { tanggalKerja: new Date('2031-03-03T00:00:00Z'), menit: 30, status: 'DISETUJUI', nilaiProyek: 6000 }], { mode: 'PER_LEVEL' })
cek('hitungLembur PER_LEVEL menjumlah nilai disetujui (15.000), bertarif', h.uang === 15000 && h.adaTarif)

console.log('— alur API —')
let xff = 0

const S = keiko.id
const aturanLama = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
let orderId, akun
try {
  const koord = await user('lv_koord', [['KOORDINATOR', S]]), kar = await user('lv_kar', [['KARYAWAN', S]])
  akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-LV', judul: 'UJI-LV order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } }); orderId = o.id
  await prisma.userRole.create({ data: { userId: kar.id, roleType: 'KARYAWAN', studioId: S } }).catch(() => {})
  await prisma.assignmentProduksi.create({ data: { orderId, userId: kar.id, feeTalent: 0, peran: 'TALENT' } }).catch(() => {})

  let r = await panggil(`/api/circle/lembur/level?studioId=${S}`, { token: kar.c }); cek('Karyawan membuka daftar level → 403', r.s === 403)
  r = await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ nama: 'Revisi Minor', fee: 30000 }, { nama: 'Level 1', keterangan: 'Karakter simple cute', fee: 100000 }, { nama: 'level 1', fee: 1 }] } }); cek('Nama level dobel → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ nama: 'Revisi Minor', fee: 30000 }, { nama: 'Level 1', keterangan: 'Karakter simple cute', fee: 100000 }] } }); cek('Koordinator menyimpan daftar level', r.s === 200 && r.j.data.level.filter(l => l.aktif).length === 2)
  r = await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ nama: 'Level 1', produk: '3D Printing', fee: 100000 }, { nama: 'Level 1', produk: '3D Game', fee: 150000 }, { nama: 'Level 1', produk: '3d game', fee: 1 }] } }); cek('Level sama + produk sama (beda huruf) → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ nama: 'Revisi Minor', fee: 30000 }, { nama: 'Level 1', produk: '3D Printing', fee: 100000 }, { nama: 'Level 1', produk: '3D Game', fee: 150000 }] } }); cek('Fee beda per produk: Level 1 Printing 100rb & Game 150rb', r.s === 200 && r.j.data.level.filter(l => l.aktif).length === 3)
  const daftarLevel = r.j.data.level
  const gameId = daftarLevel.find(l => l.aktif && l.produk === '3D Game')?.id
  r = await panggil(`/api/circle/lembur/tahap`, { method: 'PUT', token: koord.c, body: { studioId: S, tahap: [{ nama: 'Blocking', persen: 20 }, { nama: 'Finishing', persen: 100 }, { nama: 'blocking', persen: 5 }] } }); cek('Tahap dobel → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/tahap`, { method: 'PUT', token: koord.c, body: { studioId: S, tahap: [{ nama: 'Blocking', persen: 20 }, { nama: 'Finishing', persen: 100 }] } }); cek('Koordinator menyimpan tahap', r.s === 200 && r.j.data.tahap.length === 2)
  r = await panggil(`/api/circle/lembur/tahap`, { method: 'PUT', token: koord.c, body: { studioId: S, tahap: [{ nama: 'X', persen: 120 }] } }); cek('Tahap persen >100 → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/tahap?studioId=${S}`, { token: kar.c }); cek('Karyawan membuka pengaturan tahap → 403', r.s === 403)
  const lvl = Object.fromEntries(daftarLevel.filter(l => l.aktif).map(l => [l.produk ? `${l.nama}|${l.produk}` : l.nama, l.id]))
  r = await panggil(`/api/circle/lembur/aturan`, { method: 'PUT', token: koord.c, body: { studioId: S, mode: 'PER_LEVEL' } }); cek('Aturan PER_LEVEL tersimpan', r.s === 200 && r.j.data.aturan.mode === 'PER_LEVEL')

  r = await panggil(`/api/circle/kehadiran/order-lembur?studioId=${S}`, { token: kar.c })
  cek('Anggota melihat level + tahap TANPA fee', r.s === 200 && r.j.data.wajibLevel && r.j.data.level.length === 3 && r.j.data.tahap.length === 2 && r.j.data.level.every(l => l.fee === undefined))
  await prisma.kehadiranEvent.deleteMany({ where: { userId: kar.id } })
  await panggil(`/api/circle/kehadiran/catat`, { method: 'POST', token: kar.c, body: { jenis: 'MASUK', modeKerja: 'WFO' } })
  await panggil(`/api/circle/kehadiran/catat`, { method: 'POST', token: kar.c, body: { jenis: 'PULANG' } })
  const lembur = (b) => panggil(`/api/circle/kehadiran/lembur`, { method: 'POST', token: kar.c, body: { mulai: '19:00', selesai: '20:00', catatan: 'UJI-LV', studioId: S, ...b } })
  r = await lembur({}); cek('Tanpa order → 422', r.s === 422)
  r = await lembur({ orderId }); cek('Tanpa level → 422', r.s === 422)
  r = await lembur({ orderId, levelId: lvl['Level 1|3D Printing'], progresAwal: 60, progresAkhir: 50 }); cek('Progres mundur → 422', r.s === 422)
  r = await lembur({ orderId, levelId: 'ngawur', progresAwal: 0, progresAkhir: 50 }); cek('Level tidak ada → 422', r.s === 422)
  r = await lembur({ orderId, levelId: lvl['Level 1|3D Printing'], progresAwal: 50, progresAkhir: 80 }); const id1 = r.j.data?.id
  cek('Lembur level tercatat MENUNGGU', r.s === 201 && r.j.data.status === 'MENUNGGU')
  // fee dikunci: ubah daftar level SESUDAH dicatat tidak mengubah nilai
  await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ id: lvl['Revisi Minor'], nama: 'Revisi Minor', fee: 30000 }, { id: lvl['Level 1|3D Printing'], nama: 'Level 1', produk: '3D Printing', fee: 999999 }, { id: lvl['Level 1|3D Game'], nama: 'Level 1', produk: '3D Game', fee: 150000 }] } })
  r = await lembur({ orderId, levelId: gameId, progresAwal: 0, progresAkhir: 50 }); const idGame = r.j.data?.id
  r = await panggil(`/api/circle/lembur/usulan?studioId=${S}&bulan=${new Date().toISOString().slice(0, 7)}`, { token: koord.c })
  const b1 = r.j.data?.baris?.find(x => x.id === id1)
  cek('Usulan menampilkan level, progres 50→80, usulan Rp30.000 (fee terkunci)', b1?.levelNama === 'Level 1 — 3D Printing' && b1.progresAwal === 50 && b1.progresAkhir === 80 && b1.nilaiUsulan === 30000)
  cek('Level produk 3D Game 0→50% = usulan Rp75.000, label memuat produk', (await panggil(`/api/circle/lembur/usulan?studioId=${S}&bulan=${new Date().toISOString().slice(0, 7)}`, { token: koord.c })).j.data.baris.some(x => x.id === idGame && x.nilaiUsulan === 75000 && x.levelNama === 'Level 1 — 3D Game'))
  r = await panggil(`/api/circle/lembur/${id1}/setujui`, { method: 'POST', token: kar.c, body: { studioId: S } }); cek('Karyawan tidak bisa menyetujui → 403', r.s === 403)
  r = await panggil(`/api/circle/lembur/${id1}/setujui`, { method: 'POST', token: koord.c, body: { studioId: S } })
  cek('Koordinator setujui TANPA mengisi nilai → otomatis Rp30.000', r.s === 200 && (await prisma.lemburKehadiran.findUnique({ where: { id: id1 } })).nilaiProyek === 30000)
  r = await panggil(`/api/circle/lembur/level`, { method: 'PUT', token: koord.c, body: { studioId: S, level: [{ id: lvl['Revisi Minor'], nama: 'Revisi Minor', fee: 30000 }] } })
  const aktif = r.j.data?.level?.filter(l => l.aktif).map(l => l.nama)
  cek('Level yang dibuang dinonaktifkan (bukan dihapus), catatan lama utuh', aktif?.length === 1 && aktif[0] === 'Revisi Minor' && !!(await prisma.lemburKehadiran.findUnique({ where: { id: id1 } })).levelNama)
  r = await lembur({ orderId, levelId: lvl['Level 1|3D Printing'], progresAwal: 0, progresAkhir: 10 }); cek('Level nonaktif ditolak → 422', r.s === 422)
} finally {
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId } }).catch(() => {})
  if (orderId) { await prisma.auditOrder?.deleteMany?.({ where: { orderId } }).catch(() => {}); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('order sisa:', e.message.slice(0, 80))) }
  await prisma.levelLembur.deleteMany({ where: { studioId: S } }); await prisma.tahapLembur.deleteMany({ where: { studioId: S } })
  if (aturanLama) await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { ...aturanLama, studioId: undefined, updatedAt: undefined, tingkat: aturanLama.tingkat ?? undefined } })
  else await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
