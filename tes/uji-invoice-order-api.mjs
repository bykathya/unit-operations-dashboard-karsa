import { DASH } from './_jalur.mjs'
// Uji invoice per order (12 Nov 2026, masukan tim): Invoice DP / Pelunasan dari detail order langsung terbit; total ≤ harga; Lunas di
// Tagihan → tercatat sebagai cicilan (uang diterima = jumlah × rasio bersih/kotor) dan status bayar order mengikuti (DP lalu Lunas). Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.50.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], tagihanIds = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let o
try {
  const koord = await user('io_koord', 'KOORDINATOR'), kar = await user('io_kar', 'KARYAWAN')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-IO klien', judul: 'UJI-IO order', nilaiKotor: 1000000, nilaiBersih: 800000, nilaiDisepakati: 1000000, tanggalMasuk: new Date() } })
  const I = `/api/circle/orders/${o.id}/invoice`
  let r = await panggil(I, { token: koord.c }); cek('Daftar invoice order: harga 1.000.000, belum ditagih 1.000.000', r.s === 200 && r.j.data.harga === 1000000 && r.j.data.belumDitagih === 1000000, String(r.s))
  r = await panggil(I, { token: kar.c }); cek('Talent membuka invoice → 403', r.s === 403)
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'DP', jumlah: 500000 } }); const dp = r.j.data; if (dp?.id) tagihanIds.push(dp.id)
  cek('Invoice DP 500.000 terbit (langsung Ditagih)', r.s === 201 && (await prisma.tagihanKomunitas.findUnique({ where: { id: dp.id } })).status === 'DITAGIH', r.j.message)
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'DP', jumlah: 600000 } }); cek('Melebihi sisa belum ditagih → 422', r.s === 422)
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'CICILAN', jumlah: 100000 } }); if (r.j.data?.id) tagihanIds.push(r.j.data.id)
  const c1 = r.s === 201 && (await prisma.tagihanKomunitasItem.findFirst({ where: { tagihanId: r.j.data.id } })).keterangan === 'Cicilan 1'
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'CICILAN', jumlah: 100000 } }); if (r.j.data?.id) tagihanIds.push(r.j.data.id)
  cek('Invoice Cicilan bernomor otomatis (Cicilan 1, Cicilan 2)', c1 && (await prisma.tagihanKomunitasItem.findFirst({ where: { tagihanId: r.j.data.id } })).keterangan === 'Cicilan 2')
  await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tagihanIds.splice(1) } } })
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'LAIN', jumlah: 1000 } }); cek('Invoice lainnya tanpa keterangan → 422', r.s === 422)
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'PELUNASAN' } }); const pl = r.j.data; if (pl?.id) tagihanIds.push(pl.id)
  cek('Invoice pelunasan tanpa jumlah = sisa 500.000', r.s === 201 && (await prisma.tagihanKomunitas.findUnique({ where: { id: pl.id } })).total === 500000)
  r = await panggil(I, { method: 'POST', token: koord.c, body: { jenis: 'PELUNASAN' } }); cek('Semua sudah ditagih → 409', r.s === 409)
  r = await panggil(`/api/circle/tagihan/${dp.id}`, { token: koord.c }); cek('Detail invoice (untuk cetak): judul memuat "— DP" + penerbit', r.s === 200 && r.j.data.item[0].judul.endsWith('— DP') && 'penerbit' in r.j.data)
  r = await panggil(`/api/circle/tagihan/${dp.id}/lunas`, { method: 'POST', token: koord.c, body: { tanggal: '2026-11-12' } }); cek('Invoice DP ditandai Lunas → 200', r.s === 200, r.j.message)
  let t = await prisma.terminBayarOrder.findMany({ where: { orderId: o.id }, orderBy: { createdAt: 'asc' } }), os = await prisma.orderProduksi.findUnique({ where: { id: o.id } })
  cek('Tercatat cicilan "DP" 400.000 (500.000 × 80% bersih), dibayar; order berstatus DP', t.length === 1 && t[0].label === 'DP' && t[0].jumlah === 400000 && !!t[0].dibayarPada && t[0].tagihanId === dp.id && os.statusBayar === 'DP', JSON.stringify(t.map(x => [x.label, x.jumlah])) + ' ' + os.statusBayar)
  r = await panggil(`/api/circle/tagihan/${pl.id}/lunas`, { method: 'POST', token: koord.c, body: {} })
  t = await prisma.terminBayarOrder.findMany({ where: { orderId: o.id } }); os = await prisma.orderProduksi.findUnique({ where: { id: o.id } })
  cek('Invoice pelunasan Lunas → cicilan Pelunasan 400.000; order LUNAS', r.s === 200 && t.length === 2 && t.some(x => x.label === 'Pelunasan' && x.jumlah === 400000) && os.statusBayar === 'LUNAS', os.statusBayar)
  r = await panggil(I, { token: koord.c }); cek('Daftar invoice order: 2 invoice Lunas', r.j.data.invoice.length === 2 && r.j.data.invoice.every(i => i.status === 'LUNAS'))
} finally {
  if (o) { await prisma.terminBayarOrder.deleteMany({ where: { orderId: o.id } }); await prisma.auditOrder.deleteMany({ where: { orderId: o.id } }).catch(() => {}) }
  await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tagihanIds } } }); if (o) await prisma.orderProduksi.delete({ where: { id: o.id } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
