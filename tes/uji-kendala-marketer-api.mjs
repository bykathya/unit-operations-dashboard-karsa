import { DASH } from './_jalur.mjs'
// Uji perbaikan "Kendala Website" dari marketer (9 Nov 2026):
// (1) wakil freelance berlaku untuk order milik marketer TANPA talent internal (nama freelancer tidak wajib dicatat)
// (2) prospek boleh USD × kurs dan terbawa saat "Jadikan order"
// (5,8) marketer pemegang order boleh mengubah data dasar, item, termin (mengisi "Diterima"); marketer lain & tim tetap tidak
// (6) Antrean klien mengirim jumlah order milik marketer yang masih di produksi
// (7) angka "Selesai" papan = jumlah kartu kolom Done (selesai bulan ini, termasuk yang masuk bulan lalu)
// Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.43.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const S = keiko.id
const hash = await bcrypt.hash('uji-kendala-' + Date.now(), 4)
const dibuat = [], orderIds = [], leadIds = []
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('kd_koord', [['KOORDINATOR', S]])
  const mkt = await user('kd_mkt', [['KARYAWAN', S]], 'MARKETER'), mkt2 = await user('kd_mkt2', [['KARYAWAN', S]], 'MARKETER')
  const kar = await user('kd_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  await prisma.penugasanAkunMarketer.create({ data: { userId: mkt.id, akunId: akun.id } })
  const ord = async (judul, marketerId, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-KD', judul, nilaiKotor: 500000, nilaiBersih: 500000, nilaiDisepakati: 500000, marketerId, tanggalMasuk: new Date(), ...extra } }); orderIds.push(o.id); return o }

  console.log('— (1) wakil freelance tanpa nama freelancer —')
  const tanpaTalent = await ord('UJI-KD tanpa talent', mkt.id), internal = await ord('UJI-KD internal', mkt.id)
  await prisma.assignmentProduksi.create({ data: { orderId: internal.id, userId: kar.id } })
  let r = await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.c })
  const ot = r.j.data?.orders?.find(o => o.id === tanpaTalent.id), oi = r.j.data?.orders?.find(o => o.id === internal.id)
  cek('Order miliknya tanpa talent: wakil + tombol "Mulai kerjakan"', ot?.wakilFreelance === true && ot.aksi.some(a => a.aksi === 'lanjut'))
  cek('Order miliknya bertalent internal: bukan wakil', oi?.wakilFreelance === false)
  r = await panggil(`/api/circle/orders/${tanpaTalent.id}/aksi`, { method: 'POST', token: mkt.c, body: { aksi: 'lanjut' } }); cek('Marketer menggeser order tanpa talent → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/orders/${tanpaTalent.id}/aksi`, { method: 'POST', token: mkt2.c, body: { aksi: 'lanjut' } }); cek('Marketer lain menggeser order itu → ditolak', r.s === 409 || r.s === 404, String(r.s))

  console.log('— (2) prospek USD → order USD —')
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.c, body: { studioId: S, klien: 'UJI-KD Klien USD', mataUang: 'USD', nilaiUsd: 75, kurs: 16000, kontak: '@ujiklien', akunId: akun.id } })
  cek('Tambah prospek USD → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120)); const leadId = r.j.data?.id; if (leadId) leadIds.push(leadId)
  r = await panggil(`/api/circle/marketing/lead?studioId=${S}`, { token: mkt.c }); const ld = r.j.data?.lead?.find(x => x.id === leadId)
  cek('Prospek tersimpan: $75 × 16.000 = Rp 1.200.000', ld?.mataUang === 'USD' && ld.nilaiUsd === 75 && ld.kurs === 16000 && ld.estimasiNilai === 1200000)
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.c, body: { studioId: S, klien: 'UJI-KD kurs aneh', mataUang: 'USD', nilaiUsd: 10, kurs: 5 } }); cek('Kurs tidak wajar → 422', r.s === 422)
  r = await panggil(`/api/circle/marketing/lead/${leadId}/jadi-order`, { method: 'POST', token: mkt.c, body: { judul: 'UJI-KD order USD' } })
  cek('Jadikan order (tanpa isi nilai) → 201', r.s === 201, String(r.s)); const ordUsdId = r.j.data?.orderId; if (ordUsdId) orderIds.push(ordUsdId)
  const ou = ordUsdId && await prisma.orderProduksi.findUnique({ where: { id: ordUsdId } })
  cek('Order mewarisi USD dari prospek ($75 × 16.000)', ou?.mataUang === 'USD' && ou.nilaiUsd === 75 && ou.kurs === 16000 && ou.nilaiKotor === 1200000)

  console.log('— (5, 8) marketer mengubah order miliknya —')
  const milik = await ord('UJI-KD milik', mkt.id), lain = await ord('UJI-KD lain', mkt2.id)
  r = await panggil(`/api/circle/orders/${milik.id}/detail`, { token: mkt.c })
  cek('Detail order miliknya: bisaUbahOrder + daftar termin', r.s === 200 && r.j.data?.bisaUbahOrder === true && Array.isArray(r.j.data?.termin) && r.j.data?.bisaKelola === false)
  r = await panggil(`/api/circle/orders/${milik.id}`, { method: 'PATCH', token: mkt.c, body: { judul: 'UJI-KD milik (diubah)', deadline: '2031-12-31' } }); cek('Ubah judul & deadline order miliknya → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/orders/${milik.id}/item`, { method: 'PUT', token: mkt.c, body: { item: [{ nama: 'Model', jumlah: 1, hargaSatuan: 500000 }] } }); cek('Isi item order miliknya → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/orders/${milik.id}/termin`, { method: 'POST', token: mkt.c, body: { label: 'DP', jumlah: 200000 } }); cek('Tambah termin DP → 201', r.s === 201, String(r.s)); const terminId = r.j.data?.id
  r = await panggil(`/api/circle/orders/${milik.id}/termin/${terminId}`, { method: 'PATCH', token: mkt.c, body: { dibayarPada: '2031-11-10' } }); cek('Tandai DP dibayar → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/orders/${milik.id}/detail`, { token: mkt.c })
  cek('"Diterima" terisi Rp 200.000 & status DP', r.j.data?.uang?.diterima === 200000 && r.j.data?.uang?.statusBayar === 'DP', JSON.stringify(r.j.data?.uang))
  r = await panggil(`/api/circle/orders/${lain.id}`, { method: 'PATCH', token: mkt.c, body: { judul: 'x' } }); cek('Ubah order marketer LAIN → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/orders/${lain.id}/termin`, { method: 'POST', token: mkt.c, body: { label: 'x', jumlah: 1 } }); cek('Termin order marketer LAIN → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/orders/${milik.id}`, { method: 'PATCH', token: kar.c, body: { judul: 'x' } }); cek('(kontrol) Karyawan biasa mengubah order → 403', r.s === 403, String(r.s))

  console.log('— (6) antrean klien: order milikku yang masih di produksi —')
  r = await panggil(`/api/circle/marketing/ruang?studioId=${S}`, { token: mkt.c }); cek('milikDiProduksi menghitung order miliknya di luar fase klien', r.s === 200 && r.j.data?.milikDiProduksi >= 3, String(r.j.data?.milikDiProduksi))

  console.log('— (7) angka Selesai = kolom Done —')
  const done = (await prisma.tahapProduksi.findFirst({ where: { studioId: S, jenis: 'SELESAI' } }))
  await ord('UJI-KD selesai, masuk bulan lalu', mkt.id, { status: 'SELESAI', tahapId: done.id, tanggalMasuk: new Date(Date.now() - 40 * 86400000), tanggalSelesai: new Date() })
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c })
  const kolomDone = r.j.data?.orders?.filter(o => o.tahapId === done.id).length
  cek('ringkasan.jumlahSelesai = jumlah kartu kolom Done', r.s === 200 && r.j.data.ringkasan.jumlahSelesai === kolomDone && kolomDone >= 1, `${r.j.data?.ringkasan?.jumlahSelesai} vs ${kolomDone}`)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.marketingLead.deleteMany({ where: { id: { in: leadIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.penugasanAkunMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
