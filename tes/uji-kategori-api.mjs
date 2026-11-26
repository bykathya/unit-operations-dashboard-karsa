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
let orderId, ltkId
try {
  const koord = await user('kt_koord', [['KOORDINATOR', S]]), kar = await user('kt_kar', [['KARYAWAN', S]]), mkt = await user('kt_mkt', [['KADER', S]])
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER' } }).catch(() => {})
  await prisma.kategoriOrder.deleteMany({ where: { studioId: S, nama: { in: ['UJIKAT', 'Ujikat', 'ujikat', 'Animasi UJI', 'Animation UJI'] } } })
  let r = await panggil(`/api/circle/kategori-order?studioId=${S}`, { token: kar.c }); cek('Karyawan melihat daftar kategori, tanpa hak tambah', r.s === 200 && Array.isArray(r.j.data.kategori) && r.j.data.bisaTambah === false)
  r = await panggil(`/api/circle/kategori-order`, { method: 'POST', token: kar.c, body: { studioId: S, nama: 'UJIKAT' } }); cek('Karyawan tidak boleh tambah kategori → 403', r.s === 403)
  r = await panggil(`/api/circle/kategori-order`, { method: 'POST', token: koord.c, body: { studioId: S, nama: '  ' } }); cek('Nama kosong → 422', r.s === 422)
  r = await panggil(`/api/circle/kategori-order`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJIKAT' } }); cek('Koordinator menambah kategori', r.s === 201 && r.j.data.kategori.includes('UJIKAT'))
  r = await panggil(`/api/circle/kategori-order`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'ujikat' } }); cek('Nama sama beda huruf → memakai ejaan yang sudah ada (tidak dobel)', r.s === 201 && r.j.data.nama === 'UJIKAT' && r.j.data.kategori.filter(k => k.toLowerCase() === 'ujikat').length === 1)
  // LTK: kategori diketik "ujikat" lewat API → disamakan ke "UJIKAT"
  r = await panggil(`/api/circle/ltk`, { method: 'POST', token: koord.c, body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-KT pihak', judul: 'UJI-KT ltk', kategori: 'ujikat', anggaranCatatan: 'Rp 1.500.000' } }); ltkId = r.j.data?.id
  cek('LTK dibuat', r.s === 201)
  r = await panggil(`/api/circle/ltk/${ltkId}`, { token: koord.c })
  cek('Kategori LTK disamakan ke ejaan daftar; anggaran tersimpan', r.j.data?.kategori === 'UJIKAT' && r.j.data?.anggaranCatatan === 'Rp 1.500.000')
  // kategori baru yang belum ada, lewat LTK → otomatis masuk daftar
  r = await panggil(`/api/circle/ltk/${ltkId}`, { method: 'PATCH', token: koord.c, body: { kategori: 'Ujikat Baru' } }); cek('Ubah LTK dengan kategori baru', r.s === 200)
  r = await panggil(`/api/circle/kategori-order?studioId=${S}`, { token: koord.c }); cek('Kategori baru otomatis masuk daftar', r.j.data.kategori.includes('Ujikat Baru'))
  // profil order
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  orderId = (await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-KT', judul: 'UJI-KT order', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } })).id
  r = await panggil(`/api/circle/orders/${orderId}/profil`, { method: 'PATCH', token: koord.c, body: { kategori: 'ujikat' } }); cek('Profil order: kategori disamakan', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: orderId } })).kategori === 'UJIKAT')
  // BUNDLING: banyak kategori dalam satu order/LTK
  r = await panggil(`/api/circle/orders/${orderId}/profil`, { method: 'PATCH', token: koord.c, body: { kategori: 'ujikat + Animasi UJI  + ujikat' } }); cek('Profil order: dua kategori (bundling), dobel dibuang, ejaan disamakan', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: orderId } })).kategori === 'UJIKAT + Animasi UJI')
  r = await panggil(`/api/circle/orders/${orderId}/profil`, { method: 'PATCH', token: koord.c, body: { kategori: 'a + b + c + d + e + f + g' } }); cek('Lebih dari 6 kategori → 422', r.s === 422)
  r = await panggil(`/api/circle/kategori-order`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'A+B' } }); cek('Nama kategori mengandung + → 422', r.s === 422)
  r = await panggil(`/api/circle/kategori-order?studioId=${S}`, { token: koord.c }); const itemA = r.j.data.item?.find(x => x.nama === 'Animasi UJI'), itemU = r.j.data.item?.find(x => x.nama === 'UJIKAT')
  cek('Koordinator melihat daftar atur (id + jumlah dipakai)', r.j.data.bisaKelola && itemA?.dipakai === 1 && itemU?.dipakai >= 1)
  r = await panggil(`/api/circle/kategori-order?studioId=${S}`, { token: mkt.c }); cek('Marketer boleh tambah tapi tanpa layar atur', r.j.data.bisaTambah === true && r.j.data.bisaKelola === false && !r.j.data.item)
  r = await panggil(`/api/circle/kategori-order/${itemA.id}`, { method: 'PATCH', token: mkt.c, body: { nama: 'X' } }); cek('Marketer tidak boleh ganti nama → 403', r.s === 403)
  r = await panggil(`/api/circle/kategori-order/${itemA.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus kategori yang masih dipakai → 409', r.s === 409)
  r = await panggil(`/api/circle/kategori-order/${itemA.id}`, { method: 'PATCH', token: koord.c, body: { nama: 'ujikat' } }); cek('Ganti nama ke nama yang sudah ada → 409', r.s === 409)
  r = await panggil(`/api/circle/kategori-order/${itemA.id}`, { method: 'PATCH', token: koord.c, body: { nama: 'Animation UJI' } }); cek('Ganti nama kategori', r.s === 200)
  cek('Ganti nama ikut mengubah order yang memakainya', (await prisma.orderProduksi.findUnique({ where: { id: orderId } })).kategori === 'UJIKAT + Animation UJI')
  // laporan jenis order: bundling dihitung per kategori, total order tetap satu
  const { hitungJenisOrder } = await import(DASH + '/server/src/utils/tambahanOgs.js')
  const jr = hitungJenisOrder([{ akunId: 'a', kategori: 'X + Y' }, { akunId: 'a', kategori: 'X' }, { akunId: 'a', kategori: null }], new Map())
  cek('Laporan jenis order: bundling dihitung per kategori, total order = 3', jr.total === 3 && jr.totalKategori.X === 2 && jr.totalKategori.Y === 1 && jr.totalKategori.Lainnya === 1)
  await prisma.orderProduksi.update({ where: { id: orderId }, data: { kategori: null } })
  r = await panggil(`/api/circle/kategori-order/${itemA.id}`, { method: 'DELETE', token: koord.c }); cek('Kategori tak terpakai bisa dihapus', r.s === 200)
  // akun jualan WhatsApp / Telegram
  r = await panggil(`/api/circle/akun-jualan`, { method: 'POST', token: koord.c, body: { studioId: S, platform: 'WhatsApp', namaAkun: 'UJI-KT WA', feePersen: 0 } }); cek('Akun jualan platform WhatsApp diterima', r.s === 201)
  r = await panggil(`/api/circle/akun-jualan`, { method: 'POST', token: koord.c, body: { studioId: S, platform: 'Telegram', namaAkun: 'UJI-KT TG', feePersen: 0 } }); cek('Akun jualan platform Telegram diterima', r.s === 201)
  r = await panggil(`/api/circle/akun-jualan`, { method: 'POST', token: koord.c, body: { studioId: S, platform: 'Ngawur', namaAkun: 'UJI-KT X' } }); cek('Platform tidak dikenal → 422', r.s === 422)
} finally {
  await prisma.akunProduksi.deleteMany({ where: { studioId: S, namaAkun: { startsWith: 'UJI-KT' } } })
  if (ltkId) { await prisma.catatanLtk.deleteMany({ where: { kasusId: ltkId } }); await prisma.kasusLtk.delete({ where: { id: ltkId } }).catch(() => {}) }
  if (orderId) { await prisma.auditOrder.deleteMany({ where: { orderId } }); await prisma.orderProduksi.delete({ where: { id: orderId } }).catch(e => console.log('sisa:', e.message.slice(0, 80))) }
  await prisma.kategoriOrder.deleteMany({ where: { studioId: S, nama: { in: ['UJIKAT', 'Ujikat Baru', 'Animasi UJI', 'Animation UJI'] } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
