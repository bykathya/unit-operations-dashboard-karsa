import { DASH } from './_jalur.mjs'
// Uji masukan tim 17 Nov 2026: (1) invoice yang sudah terbit (Ditagih) bisa DIBATALKAN (klien batal sebelum membayar) — kembali dihitung
// "belum ditagih"; invoice Lunas tidak bisa; (2) Cancel klien nilai 0 → invoice order itu yang belum dibayar ikut dibatalkan, order hilang dari
// Belum dibayar klien; invoice gabungan dengan order lain ditolak; nilai riil < uang yang sudah diterima ditolak; partial refund tidak menyentuh
// invoice; (3) Rincian Tutup bulan menandai biaya dari Bayar freelance (dihapus lewat Bayar freelance). Data uji dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.53.9.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m17-' + T, 4)
const dibuat = [], orderIds = [], akunIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const KLIEN = `uji_m17_${T}`
try {
  const koord = await user('m17_koord', [['KOORDINATOR', S]])
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akun = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: `UJI-M17 ${T}`, feePersen: 0 } }); akunIds.push(akun.id)
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const id = (j) => tahap.find(t => t.jenis === j)?.id
  const ord = async (judul, data = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: KLIEN, judul: `UJI-M17 ${judul} ${T}`, nilaiKotor: 1000000, nilaiBersih: 1000000, nilaiDisepakati: 1000000, status: 'PROSES', tahapId: id('KERJA'), tanggalMasuk: new Date(), ...data } }); orderIds.push(o.id); return o }

  console.log('— (1) batalkan invoice Ditagih —')
  const o1 = await ord('invoice')
  let r = await K(`/api/circle/orders/${o1.id}/invoice`, { method: 'POST', body: { jenis: 'DP', jumlah: 400000 } }); cek('Terbitkan invoice DP 400.000', r.s === 201 || r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${o1.id}/invoice`); const inv = r.j.data?.invoice?.[0]
  cek('Invoice berstatus Ditagih, belum ditagih 600.000', inv?.status === 'DITAGIH' && Math.round(r.j.data.belumDitagih) === 600000, JSON.stringify({ s: inv?.status, b: r.j.data?.belumDitagih }))
  r = await K(`/api/circle/tagihan/${inv.id}/batal`, { method: 'POST', body: {} }); cek('Batalkan invoice Ditagih → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${o1.id}/invoice`)
  cek('Invoice tidak dihitung lagi: belum ditagih kembali 1.000.000, nomor tetap tercatat (BATAL)', Math.round(r.j.data.belumDitagih) === 1000000 && (await prisma.tagihanKomunitas.findUnique({ where: { id: inv.id } })).status === 'BATAL')
  r = await K(`/api/circle/orders/${o1.id}/invoice`, { method: 'POST', body: { jenis: 'PELUNASAN' } }); const inv2 = (await K(`/api/circle/orders/${o1.id}/invoice`)).j.data.invoice.find(i => i.status === 'DITAGIH')
  r = await K(`/api/circle/tagihan/${inv2.id}/lunas`, { method: 'POST', body: { tanggal: new Date().toISOString().slice(0, 10) } }); cek('Invoice pelunasan dibayar → Lunas', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/tagihan/${inv2.id}/batal`, { method: 'POST', body: {} }); cek('Invoice Lunas tidak bisa dibatalkan → 409', r.s === 409, String(r.s))

  console.log('— (2) cancel klien —')
  const o2 = await ord('cancel nol')
  await K(`/api/circle/orders/${o2.id}/invoice`, { method: 'POST', body: { jenis: 'DP', jumlah: 500000 } })
  const invO2 = (await K(`/api/circle/orders/${o2.id}/invoice`)).j.data.invoice[0]
  r = await K(`/api/circle/orders/${o2.id}/cancel-klien`, { method: 'POST', body: { alasan: 'klien batal sebelum bayar', nilaiRiil: 0 } })
  cek('Cancel klien nilai 0 → 200, invoice DP disebut dibatalkan', r.s === 200 && r.j.message.includes(invO2.nomor), `${r.s} ${r.j.message ?? ''}`)
  const o2b = await prisma.orderProduksi.findUnique({ where: { id: o2.id } })
  cek('Order ditutup sebagai Cancel klien, nilai 0, invoice BATAL', o2b.cancelKlien && o2b.status === 'SELESAI' && o2b.nilaiKotor === 0 && (await prisma.tagihanKomunitas.findUnique({ where: { id: invO2.id } })).status === 'BATAL')
  r = await K(`/api/circle/pembayaran?studioId=${S}&semua=1`); cek('Tidak muncul di Belum dibayar klien', r.s === 200 && !r.j.data.baris.some(b => b.id === o2.id))

  const o3 = await ord('gabungan A'), o4 = await ord('gabungan B')
  r = await K('/api/circle/tagihan', { method: 'POST', body: { studioId: S, klien: KLIEN, orderIds: [o3.id, o4.id] } }); cek('Tagihan gabungan dua order dibuat', r.s === 201 || r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${o3.id}/cancel-klien`, { method: 'POST', body: { alasan: 'batal', nilaiRiil: 0 } }); cek('Cancel nilai 0 saat invoice memuat order lain → 409 (atur di menu Tagihan)', r.s === 409 && /order lain/.test(r.j.message ?? ''), `${r.s} ${r.j.message ?? ''}`)

  const o5 = await ord('sudah bayar')
  await prisma.terminBayarOrder.create({ data: { orderId: o5.id, label: 'DP', jumlah: 300000, dibayarPada: new Date(), urutan: 1 } })
  r = await K(`/api/circle/orders/${o5.id}/cancel-klien`, { method: 'POST', body: { alasan: 'batal', nilaiRiil: 100000 } }); cek('Nilai riil di bawah uang yang sudah diterima → 422', r.s === 422, `${r.s} ${r.j.message ?? ''}`)
  await K(`/api/circle/orders/${o5.id}/invoice`, { method: 'POST', body: { jenis: 'PELUNASAN', jumlah: 200000 } })
  r = await K(`/api/circle/orders/${o5.id}/cancel-klien`, { method: 'POST', body: { alasan: 'partial refund', nilaiRiil: 500000 } })
  const invO5 = (await K(`/api/circle/orders/${o5.id}/invoice`)).j.data.invoice
  cek('Partial refund (nilai > 0) → 200, invoice tidak disentuh', r.s === 200 && invO5.some(i => i.status === 'DITAGIH'), `${r.s} ${JSON.stringify(invO5.map(i => i.status))}`)

  console.log('— (3) Rincian: biaya dari Bayar freelance —')
  const asg = await prisma.assignmentProduksi.create({ data: { orderId: o1.id, namaEksternal: `UjiFree17 ${T}`, tipeEksternal: 'FREELANCER_PERORANGAN', feeTalent: 50000 } })
  r = await K(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', body: { jenis: 'LUNAS' } }); cek('Bayar fee freelance → biaya tercatat', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  const bulan = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
  r = await K(`/api/circle/buku/rincian?studioId=${S}&bulan=${bulan}`)
  const bf = (r.j.data?.baris ?? []).find(b => b.sumber === 'BIAYA' && String(b.deskripsi).includes(`UjiFree17 ${T}`))
  cek('Rincian menandai baris itu berasal dari Bayar freelance', bf?.dariFreelance === true, JSON.stringify(bf ? { s: bf.sumber, f: bf.dariFreelance } : r.s))

  console.log('— (4) fee freelance dibayar & order dihapus —')
  const o6 = await ord('freelance hapus')
  const asg6 = await prisma.assignmentProduksi.create({ data: { orderId: o6.id, namaEksternal: `UjiFree17b ${T}`, tipeEksternal: 'FREELANCER_PERORANGAN', feeTalent: 80000 } })
  r = await K(`/api/circle/bayar-freelance/${asg6.id}/bayar`, { method: 'POST', body: { jenis: 'LUNAS' } }); cek('Fee freelance dilunasi', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${o6.id}/batal`, { method: 'POST', body: {} }); cek('Hapus order yang fee freelance-nya sudah dibayar → 409 (batalkan dulu di Bayar freelance)', r.s === 409 && /Bayar freelance/.test(r.j.message ?? ''), `${r.s} ${r.j.message ?? ''}`)
  await prisma.orderProduksi.update({ where: { id: o6.id }, data: { status: 'BATAL' } }) // data lama: order terlanjur dihapus sebelum pengaman ini
  r = await K(`/api/circle/bayar-freelance?studioId=${S}&semua=1`); const b6 = r.j.data?.baris?.find(b => b.id === asg6.id)
  cek('Daftar (tampilkan yang lunas): order dihapus tetap tampil, bertanda, bukan utang', b6?.orderDihapus === true && b6.sisa === 0, JSON.stringify(b6 && { d: b6.orderDihapus, s: b6.sisa }))
  r = await K(`/api/circle/bayar-freelance?studioId=${S}`); cek('Tampilan bawaan (belum lunas) tidak memuatnya', !r.j.data.baris.some(b => b.id === asg6.id))
  r = await K(`/api/circle/bayar-freelance/${asg6.id}/batal`, { method: 'POST' })
  cek('Batalkan pembayarannya → biaya Fee Freelance terhapus', r.s === 200 && (await prisma.biayaStudio.count({ where: { assignmentId: asg6.id } })) === 0, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/bayar-freelance/${asg6.id}/bayar`, { method: 'POST', body: { jenis: 'DP', jumlah: 1000 } }); cek('Pembayaran baru untuk order dihapus → 409', r.s === 409, String(r.s))
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  const asgIds = (await prisma.assignmentProduksi.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map(a => a.id)
  await prisma.biayaStudio.deleteMany({ where: { assignmentId: { in: asgIds } } })
  const tg = (await prisma.tagihanKomunitasItem.findMany({ where: { orderId: { in: orderIds } }, select: { tagihanId: true } })).map(t => t.tagihanId)
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.tagihanKomunitasItem.deleteMany({ where: { tagihanId: { in: tg } } }); await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tg } } })
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'catatanOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_m17' } } }).catch(() => {})
  await prisma.talentEksternal.deleteMany({ where: { nama: { startsWith: 'UjiFree17' } } }).catch(() => {}) // termasuk UjiFree17b
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(e => console.log('sisa akun:', e.message))
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
