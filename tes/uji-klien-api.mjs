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
let ids = []
try {
  const koord = await user('kl_koord', [['KOORDINATOR', S]]), kar = await user('kl_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'UJI-KL akun' } }, update: {}, create: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-KL akun', feePersen: 0.2 } })
  let r = await panggil(`/api/circle/klien?studioId=${S}`, { token: kar.c }); cek('Karyawan membuka direktori klien → 403', r.s === 403)
  r = await panggil(`/api/circle/klien`, { method: 'POST', token: kar.c, body: { studioId: S, nama: 'UJI-KL x' } }); cek('Karyawan tambah klien → 403', r.s === 403)
  const buat = (body) => panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, body: { studioId: S, tipeKlien: 'EKSTERNAL', nilaiDisepakati: 100000, akunId: akun.id, ...body } })
  r = await buat({ judul: 'UJI-KL satu', klien: 'UJI-KL Maxlus07' }); ids.push(r.j.data?.id); cek('Order pertama membuat klien baru otomatis', r.s === 201)
  r = await buat({ judul: 'UJI-KL dua', klien: 'uji-kl maxlus07  ' }); ids.push(r.j.data?.id)
  const o2 = await prisma.orderProduksi.findUnique({ where: { id: ids[1] } })
  cek('Order kedua (ejaan beda huruf) disamakan ke ejaan direktori & tertaut', o2.klien === 'UJI-KL Maxlus07' && !!o2.klienId)
  r = await buat({ judul: 'UJI-KL nominal', klien: 'Rp 650.000' }); cek('Klien tampak nominal ("Rp 650.000") ditolak → 422', r.s === 422)
  r = await buat({ judul: 'UJI-KL nominal2', klien: '650000' }); cek('Klien angka saja ditolak → 422', r.s === 422)
  r = await panggil(`/api/circle/klien`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'Rp 1.500.000' } }); cek('Tambah klien manual berisi nominal → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${ids[0]}`, { method: 'PATCH', token: koord.c, body: { klien: 'rp 25.000' } }); cek('Ubah klien jadi nominal → 422', r.s === 422)
  r = await panggil(`/api/circle/klien?studioId=${S}`, { token: koord.c }); const k = r.j.data?.klien?.find(x => x.nama === 'UJI-KL Maxlus07')
  cek('Direktori: 2 order, asal Fiverr (dari akun order pertama), tanpa angka uang', r.s === 200 && k?.jumlahOrder === 2 && k.asal === 'Fiverr' && k.orderBerjalan === 2 && !('nilai' in k))
  r = await panggil(`/api/circle/klien`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'uji-kl MAXLUS07' } }); cek('Tambah nama sama (beda huruf) → 409', r.s === 409)
  r = await panggil(`/api/circle/klien`, { method: 'POST', token: koord.c, body: { studioId: S, nama: 'UJI-KL Maxlus77', panggilan: 'Max', asal: 'WhatsApp' } }); const baru = r.j.data; cek('Tambah klien manual dengan nickname & asal', r.s === 201)
  r = await panggil(`/api/circle/klien/${k.id}`, { method: 'PATCH', token: koord.c, body: { panggilan: 'Maxi', asal: 'Fiverr', kontak: 'wa 0812' } }); cek('Ubah nickname/asal/kontak', r.s === 200)
  r = await panggil(`/api/circle/klien/${k.id}`, { method: 'PATCH', token: koord.c, body: { nama: 'UJI-KL Maxlus77' } }); cek('Ganti nama ke nama klien lain → 409', r.s === 409)
  r = await panggil(`/api/circle/klien/${k.id}`, { method: 'PATCH', token: koord.c, body: { nama: 'UJI-KL Maxlus 07' } }); cek('Ganti nama klien', r.s === 200)
  cek('Ganti nama memperbaiki ejaan di semua order klien itu', (await prisma.orderProduksi.findMany({ where: { id: { in: ids } } })).every(o => o.klien === 'UJI-KL Maxlus 07'))
  r = await panggil(`/api/circle/klien/${baru.id}/gabung`, { method: 'POST', token: kar.c, body: { keId: k.id } }); cek('Karyawan tidak boleh gabung → 403', r.s === 403)
  r = await panggil(`/api/circle/klien/${baru.id}/gabung`, { method: 'POST', token: koord.c, body: { keId: baru.id } }); cek('Gabung ke diri sendiri → 422', r.s === 422)
  r = await panggil(`/api/circle/klien/${baru.id}/gabung`, { method: 'POST', token: koord.c, body: { keId: k.id } }); cek('Gabungkan dua entri klien sama', r.s === 200 && !(await prisma.klienProduksi.findUnique({ where: { id: baru.id } })))
  r = await panggil(`/api/circle/klien?studioId=${S}`, { token: koord.c }); const g = r.j.data.klien.find(x => x.id === k.id)
  cek('Setelah gabung: data pelengkap terbawa (asal/nickname tetap), entri hilang satu', g.panggilan === 'Maxi' && !r.j.data.klien.some(x => x.nama === 'UJI-KL Maxlus77'))
  // klien dari order lama (tanpa direktori) otomatis masuk daftar
  const lama = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-KL Klien Lama', judul: 'UJI-KL lama', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date() } }); ids.push(lama.id)
  r = await panggil(`/api/circle/klien?studioId=${S}`, { token: koord.c }); cek('Klien dari order lama otomatis masuk direktori', r.j.data.klien.some(x => x.nama === 'UJI-KL Klien Lama' && x.jumlahOrder === 1 && x.asal === 'Fiverr'))
  await prisma.orderProduksi.update({ where: { id: lama.id }, data: { status: 'BATAL' } })
  r = await panggil(`/api/circle/klien?studioId=${S}`, { token: koord.c }); cek('Order yang dihapus tidak dihitung', r.j.data.klien.find(x => x.nama === 'UJI-KL Klien Lama')?.jumlahOrder === 0)
  // ubah klien lewat Ubah data order → tertaut ke direktori
  r = await panggil(`/api/circle/orders/${ids[0]}`, { method: 'PATCH', token: koord.c, body: { klien: 'uji-kl klien lama' } }); const o1 = await prisma.orderProduksi.findUnique({ where: { id: ids[0] } })
  cek('Ubah klien di order → ejaan disamakan ke direktori', r.s === 200 && o1.klien === 'UJI-KL Klien Lama')
  // kasus Indah: entri salah ketik tersisa di direktori setelah nama di order diperbaiki
  const sisa = await prisma.klienProduksi.create({ data: { studioId: S, nama: 'UJI-KL Rp 650.000' } })
  r = await panggil(`/api/circle/klien/${sisa.id}`, { method: 'DELETE', token: kar.c }); cek('Karyawan tidak boleh hapus klien → 403', r.s === 403)
  r = await panggil(`/api/circle/klien/${sisa.id}`, { method: 'PATCH', token: koord.c, body: { nama: 'UJI-KL Klien Lama' } }); cek('Ganti nama sisa ke nama yang sudah ada → 409 (pakai Gabung)', r.s === 409)
  r = await panggil(`/api/circle/klien?studioId=${S}`, { token: koord.c }); const kLama = r.j.data.klien.find(x => x.nama === 'UJI-KL Klien Lama'), kTerpakai = r.j.data.klien.find(x => x.id === k.id)
  r = await panggil(`/api/circle/klien/${kTerpakai.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus klien yang masih dipakai order → 409', r.s === 409)
  r = await panggil(`/api/circle/klien/${sisa.id}`, { method: 'DELETE', token: koord.c }); cek('Hapus entri sisa yang tak dipakai → 200', r.s === 200 && !(await prisma.klienProduksi.findUnique({ where: { id: sisa.id } })))
  const sisa2 = await prisma.klienProduksi.create({ data: { studioId: S, nama: 'UJI-KL Salah Ketik' } })
  r = await panggil(`/api/circle/klien/${sisa2.id}/gabung`, { method: 'POST', token: koord.c, body: { keId: kLama.id } }); cek('Gabung entri sisa ke klien yang benar → 200 & entri hilang', r.s === 200 && !(await prisma.klienProduksi.findUnique({ where: { id: sisa2.id } })))
} finally {
  for (const id of ids.filter(Boolean)) { await prisma.penugasanTahap.deleteMany({ where: { orderId: id } }); await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: id } }); await prisma.auditOrder.deleteMany({ where: { orderId: id } }); await prisma.orderProduksi.delete({ where: { id } }).catch(e => console.log('sisa:', e.message.slice(0, 90))) }
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'UJI-KL' } } })
  await prisma.akunProduksi.deleteMany({ where: { studioId: S, namaAkun: 'UJI-KL akun' } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
