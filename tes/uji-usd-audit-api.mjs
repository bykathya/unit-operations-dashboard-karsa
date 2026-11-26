import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.48.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const U = await import(DASH + '/server/src/utils/uang.js')
const AO = await import(DASH + '/server/src/utils/auditOrder.js')
console.log('— logika murni —')
cek('Validasi USD: kosong/IDR lolos; tanpa nilai, kurs tak wajar, mata uang asing ditolak', U.validasiUsd({}) === null && U.validasiUsd({ mataUang: 'IDR' }) === null && U.validasiUsd({ mataUang: 'USD', nilaiUsd: 0, kurs: 16000 }) && U.validasiUsd({ mataUang: 'USD', nilaiUsd: 10, kurs: 5 }) && U.validasiUsd({ mataUang: 'EUR' }) && U.validasiUsd({ mataUang: 'USD', nilaiUsd: 10, kurs: 16000 }) === null)
cek('Rupiah dari USD: 123,45 × 16.250 dibulatkan', U.rupiahDariUsd(123.45, 16250) === 2006063)
cek('Bersih USD: order USD pakai kurs ordernya; order Rp pakai kurs bawaan', U.bersihUsd({ mataUang: 'USD', kurs: 16000, nilaiBersih: 1600000 }, 15000) === 100 && U.bersihUsd({ mataUang: 'IDR', nilaiBersih: 1500000 }, 15000) === 100)
cek('Kurs rata-rata mengabaikan 0 dan bawaan bila kosong', U.kursRata([0, 16000, 17000]) === 16500 && U.kursRata([]) === U.KURS_BAWAAN)
cek('bedaField hanya mengembalikan yang berubah (tanggal dibandingkan sebagai tanggal)', JSON.stringify(AO.bedaField({ judul: 'A', deadline: new Date('2031-01-01') }, { judul: 'A', deadline: new Date('2031-02-01') }, ['judul', 'deadline'])) === JSON.stringify([{ field: 'deadline', dari: '2031-01-01', ke: '2031-02-01' }]))

const orderIds = []
try {
  const koord = await user('us_koord', [['KOORDINATOR', S]]), kar = await user('us_kar', [['KARYAWAN', S]]), lain = await user('us_lain', [['KOORDINATOR', pibi.id]])
  const O = '/api/circle/orders'
  console.log('— order USD —')
  let r = await panggil(O, { method: 'POST', token: koord.t, body: { studioId: S, judul: 'UJI-US usd', klien: 'UJI-US k', mataUang: 'USD', nilaiUsd: 100 } }); cek('USD tanpa kurs → 422', r.s === 422)
  r = await panggil(O, { method: 'POST', token: koord.t, body: { studioId: S, judul: 'UJI-US usd', klien: 'UJI-US k', mataUang: 'USD', nilaiUsd: 100, kurs: 16000, tipeKlien: 'EKSTERNAL', akunId: 'INTERNAL' } }); cek('USD 100 × 16.000 → 201', r.s === 201); const id = r.j.data?.id; if (id) orderIds.push(id)
  let o = await prisma.orderProduksi.findUnique({ where: { id }, include: { akun: true } })
  cek('Tersimpan: Rp 1.600.000, mataUang USD, kurs & nilai USD; nilai bersih mengikuti fee akun', o.nilaiKotor === 1600000 && o.mataUang === 'USD' && o.kurs === 16000 && o.nilaiUsd === 100 && Math.round(o.nilaiBersih) === Math.round(1600000 * (1 - o.akun.feePersen)))
  r = await panggil(O, { method: 'POST', token: koord.t, body: { studioId: S, judul: 'UJI-US idr', klien: 'UJI-US k', nilaiDisepakati: 500000, akunId: 'INTERNAL' } }); const idIdr = r.j.data?.id; if (idIdr) orderIds.push(idIdr)
  cek('Order Rupiah biasa tetap IDR tanpa kurs', (await prisma.orderProduksi.findUnique({ where: { id: idIdr } })).mataUang === 'IDR')
  console.log('— edit order + audit —')
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: kar.t, body: { judul: 'x' } }); cek('Karyawan mengubah order → 403', r.s === 403)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: lain.t, body: { judul: 'x' } }); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: {} }); cek('Tanpa perubahan → 422', r.s === 422)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { judul: '' } }); cek('Judul kosong → 422', r.s === 422)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { deadline: 'besok' } }); cek('Deadline tak valid → 422', r.s === 422)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { judul: 'UJI-US usd (revisi)', deadline: '2031-08-15', klien: 'UJI-US k2' } }); cek('Ubah judul, deadline, klien → 200', r.s === 200)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { nilaiUsd: 150, kurs: 16500 } }); cek('Order belum punya item/termin: nilai USD/kurs mengubah Rupiah (150 × 16.500 = 2.475.000)', r.s === 200 && !r.j.data.peringatan && (await prisma.orderProduksi.findUnique({ where: { id } })).nilaiKotor === 2475000)
  await prisma.itemOrder.create({ data: { orderId: id, nama: 'Item', jumlah: 1, hargaSatuan: 2475000 } })
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { kurs: 17000 } }); cek('Sudah punya item: kurs berubah tapi Rupiah TIDAK, ada peringatan', r.s === 200 && !!r.j.data.peringatan && (await prisma.orderProduksi.findUnique({ where: { id } })).nilaiKotor === 2475000)
  r = await panggil(`${O}/${id}`, { method: 'PATCH', token: koord.t, body: { mataUang: 'IDR' } }); cek('Kembali ke IDR menghapus kurs & nilai USD', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id } })).kurs === null)
  r = await panggil(`${O}/${id}/detail`, { token: koord.t }); const a = r.j.data?.audit ?? []
  cek('Audit memuat BUAT, perubahan judul/deadline/klien/nilai/kurs', a.some(x => x.aksi === 'BUAT') && ['judul', 'deadline', 'klien', 'nilaiKotor', 'kurs'].every(f => a.some(x => x.field === f)))
  cek('Audit mencatat pelaku & nilai lama→baru', a.find(x => x.field === 'judul')?.dari === 'UJI-US usd' && a.find(x => x.field === 'judul')?.ke === 'UJI-US usd (revisi)' && a[0].nama.includes('us_koord'))
  r = await panggil(`${O}/${id}/detail`, { token: kar.t }); cek('Karyawan (tidak terlibat) tidak membuka detail', r.s === 403)
  await prisma.orderProduksi.update({ where: { id }, data: { marketerId: kar.id } })
  r = await panggil(`${O}/${id}/detail`, { token: kar.t }); cek('Marketer pemegang order membuka detail: nilai ORDERNYA tampil, tanpa audit & fee tim', r.s === 200 && r.j.data.audit === undefined && r.j.data.timFee === undefined && r.j.data.uang != null)
  await prisma.orderProduksi.update({ where: { id }, data: { marketerId: null } }); await prisma.assignmentProduksi.create({ data: { orderId: id, userId: kar.id } })
  r = await panggil(`${O}/${id}/detail`, { token: kar.t }); cek('Anggota yang hanya ditugaskan: detail TANPA uang & audit', r.s === 200 && r.j.data.audit === undefined && r.j.data.uang === undefined)
} finally {
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
