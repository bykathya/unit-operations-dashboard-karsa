import { DASH } from './_jalur.mjs'
// Uji masukan tim (12 Nov 2026): freelance dari order otomatis masuk menu Freelancer; Bayar freelance (DP/lunas → biaya unit otomatis,
// batal menghapus biayanya, biaya otomatis terkunci di Biaya & Kas); cicilan langsung dibayar & "Lunas penuh"; biaya harian berkategori
// bebas tetap terhitung di buku besar. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.49.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], orderIds = [], biayaIds = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const T = Date.now(), NAMA = `UJI-BF Cho ${T}`, BLN = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7), HARI = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
try {
  const koord = await user('bf_koord', 'KOORDINATOR'), kar = await user('bf_kar', 'KARYAWAN')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-BF klien', judul: `UJI-BF order ${T}`, nilaiKotor: 3400000, nilaiBersih: 3400000, nilaiDisepakati: 3400000, tanggalMasuk: new Date() } }); orderIds.push(o.id)

  console.log('— freelance dari order masuk menu Freelancer —')
  let r = await panggil(`/api/circle/orders/${o.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: NAMA } }); cek('Tambah freelance di Tim order → 201', r.s === 201, String(r.s))
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: koord.c }); cek('Nama freelance otomatis ada di menu Freelancer', r.s === 200 && r.j.data?.some(f => f.nama === NAMA), String(r.s))
  const asg = await prisma.assignmentProduksi.findFirst({ where: { orderId: o.id, namaEksternal: NAMA } })
  cek('Tim order tertaut ke data induk freelancer', !!asg?.talentEksternalId)
  await prisma.assignmentProduksi.update({ where: { id: asg.id }, data: { feeTalent: 400000 } })

  console.log('— bayar freelance —')
  r = await panggil(`/api/circle/bayar-freelance?studioId=${S}`, { token: koord.c }); let b = r.j.data?.baris.find(x => x.id === asg.id)
  cek('Daftar utang: fee 400.000, sisa 400.000, belum dibayar', b?.fee === 400000 && b.sisa === 400000 && b.status === 'BELUM_LUNAS' && r.j.data.bisaBayar === true)
  r = await panggil(`/api/circle/bayar-freelance?studioId=${S}`, { token: kar.c }); cek('Talent melihat Bayar freelance → 403', r.s === 403)
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', token: kar.c, body: { jenis: 'DP', jumlah: 1000 } }); cek('Talent membayar → 403', r.s === 403)
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', token: koord.c, body: { jenis: 'DP', jumlah: 400000, tanggal: HARI } }); cek('DP sebesar fee → 422 (pakai Lunas)', r.s === 422)
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', token: koord.c, body: { jenis: 'DP', jumlah: 150000, tanggal: HARI } }); cek('DP 150.000 → 200', r.s === 200, r.j.message)
  let biaya = await prisma.biayaStudio.findMany({ where: { assignmentId: asg.id } }); biayaIds.push(...biaya.map(x => x.id))
  cek('DP tercatat sebagai biaya unit (Fee Freelance, disetujui, lunas)', biaya.length === 1 && biaya[0].jumlah === 150000 && biaya[0].kategori === 'Fee Freelance' && biaya[0].persetujuan === 'DISETUJUI' && biaya[0].statusBayar === 'LUNAS')
  r = await panggil(`/api/circle/kas/biaya/${biaya[0].id}`, { method: 'PATCH', token: koord.c, body: { jumlah: 1 } }); cek('Biaya otomatis tidak bisa diubah di Biaya & Kas → 409', r.s === 409)
  r = await panggil(`/api/circle/kas/biaya/${biaya[0].id}`, { method: 'DELETE', token: koord.c }); cek('…dan tidak bisa dihapus di sana → 409', r.s === 409)
  r = await panggil(`/api/circle/buku/rincian?studioId=${S}&bulan=${BLN}`, { token: koord.c })
  cek('Biaya fee freelance terhitung di buku besar (kategori Fee Freelance)', r.j.data?.baris?.some(x => x.sumber === 'BIAYA' && x.sumberId === biaya[0].id && x.kategori === 'Fee Freelance'))
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', token: koord.c, body: { jenis: 'LUNAS', tanggal: HARI } }); cek('Lunas → 200', r.s === 200, r.j.message)
  biaya = await prisma.biayaStudio.findMany({ where: { assignmentId: asg.id }, orderBy: { createdAt: 'asc' } }); biayaIds.push(...biaya.map(x => x.id))
  r = await panggil(`/api/circle/bayar-freelance?studioId=${S}&semua=1`, { token: koord.c }); b = r.j.data?.baris.find(x => x.id === asg.id)
  cek('Pelunasan = sisa 250.000; status Lunas, sisa 0', biaya.length === 2 && biaya[1].jumlah === 250000 && b?.status === 'LUNAS' && b.sisa === 0)
  r = await panggil(`/api/circle/bayar-freelance?studioId=${S}`, { token: koord.c }); cek('Yang lunas tidak tampil di daftar bawaan', !r.j.data?.baris.some(x => x.id === asg.id))
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/batal`, { method: 'POST', token: koord.c }); cek('Batalkan → 200, biaya otomatis terhapus, status kembali belum dibayar', r.s === 200 && (await prisma.biayaStudio.count({ where: { assignmentId: asg.id } })) === 0 && (await prisma.assignmentProduksi.findUnique({ where: { id: asg.id } })).statusBayar === 'BELUM_LUNAS')

  console.log('— cicilan langsung dibayar & lunas penuh —')
  r = await panggil(`/api/circle/orders/${o.id}/termin`, { method: 'POST', token: koord.c, body: { label: 'DP', jumlah: 1000000, dibayarPada: HARI } }); cek('DP dengan tanggal diterima → langsung tercatat dibayar', r.s === 201 && (await prisma.orderProduksi.findUnique({ where: { id: o.id } })).statusBayar === 'DP')
  r = await panggil(`/api/circle/orders/${o.id}/detail`, { token: koord.c }); const sisa = r.j.data?.uang?.sisaTagihan
  r = await panggil(`/api/circle/orders/${o.id}/termin`, { method: 'POST', token: koord.c, body: { label: 'Pelunasan', jumlah: Math.round(sisa), dibayarPada: HARI } })
  cek('"Lunas penuh" (pelunasan sebesar sisa, dibayar hari ini) → order Lunas', r.s === 201 && sisa === 2400000 && (await prisma.orderProduksi.findUnique({ where: { id: o.id } })).statusBayar === 'LUNAS', String(sisa))

  console.log('— biaya harian berkategori bebas terhitung —')
  r = await panggil('/api/circle/kas/biaya', { method: 'POST', token: koord.c, body: { studioId: S, kategori: 'UJI-BF kategori bebas', tanggal: HARI, jumlah: 12345 } }); if (r.j.data?.id) biayaIds.push(r.j.data.id)
  await panggil(`/api/circle/kas/biaya/${r.j.data?.id}/setuju`, { method: 'POST', token: koord.c, body: { status: 'DISETUJUI' } })
  r2: { const x = await panggil(`/api/circle/buku/rincian?studioId=${S}&bulan=${BLN}`, { token: koord.c }); cek('Kategori biaya tanpa pemetaan masuk "Pengeluaran Lain-lain" (tidak hilang)', x.j.data?.baris?.some(y => y.sumber === 'BIAYA' && y.deskripsi === 'UJI-BF kategori bebas' && y.kategori === 'Pengeluaran Lain-lain')) }
} finally {
  await prisma.biayaStudio.deleteMany({ where: { id: { in: biayaIds } } })
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: { in: orderIds } } }); await prisma.auditOrder.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }); await prisma.talentEksternal.deleteMany({ where: { nama: NAMA } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
