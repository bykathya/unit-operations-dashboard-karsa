import { DASH } from './_jalur.mjs'
// Uji masukan tim Langit (9 Nov 2026): (3) bank data pihak di LTK (kontak terisi dari data sebelumnya), (4) LTK Lempar yang Deal
// dihubungkan ke order (pihak luar masuk tim order, fee = harga deal), (6) penerbit invoice per unit (nama + rekening yang diisi koordinator;
// rekening Ekosistem tidak ikut terkirim). Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.45.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const S = keiko.id
const hash = await bcrypt.hash('uji-langit-' + Date.now(), 4)
const dibuat = [], orderIds = [], ltkIds = [], tagihanIds = []
let pengaturanLama
const rekIds = []
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  pengaturanLama = await prisma.pengaturanInvoice.findUnique({ where: { studioId: S } })
  const koord = await user('lg_koord', [['KOORDINATOR', S]]), mkt = await user('lg_mkt', [['KARYAWAN', S]], 'MARKETER')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })

  console.log('— (3) bank data pihak —')
  let r = await panggil('/api/circle/ltk', { method: 'POST', token: koord.c, body: { studioId: S, arah: 'LEMPAR', jenisPihak: 'FREELANCE', namaPihak: 'UJI-LG Cho', kontak: '0822-0000-1111', judul: 'UJI-LG Ichigo' } })
  cek('Buat LTK Lempar ke freelance → 201', r.s === 201); const ltkId = r.j.data?.id; if (ltkId) ltkIds.push(ltkId)
  r = await panggil(`/api/circle/ltk/opsi?studioId=${S}`, { token: mkt.c }); const p = r.j.data?.pihak?.find(x => x.nama === 'UJI-LG Cho')
  cek('Opsi LTK memuat pihak sebelumnya beserta kontak & jenis', r.s === 200 && p?.kontak === '0822-0000-1111' && p?.jenisPihak === 'FREELANCE')
  cek('Bank pihak tidak memuat data rekening', !JSON.stringify(r.j.data.pihak).match(/noRekening|atasNama|"bank"/))

  console.log('— (4) LTK Lempar → hubungkan ke order —')
  await prisma.kasusLtk.update({ where: { id: ltkId }, data: { status: 'DEAL', hargaSepakat: 456666 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-LG', judul: 'UJI-LG order induk', nilaiKotor: 900000, nilaiBersih: 900000, marketerId: mkt.id, tanggalMasuk: new Date() } }); orderIds.push(o.id)
  r = await panggil(`/api/circle/ltk/${ltkId}/order-lempar`, { token: koord.c }); cek('Daftar order terbuka untuk dihubungkan', r.s === 200 && r.j.data.order.some(x => x.id === o.id))
  r = await panggil(`/api/circle/ltk/${ltkId}/hubungkan`, { method: 'POST', token: mkt.c, body: { orderId: o.id } }); cek('Marketer menghubungkan → 403 (hanya koordinator)', r.s === 403)
  r = await panggil(`/api/circle/ltk/${ltkId}/hubungkan`, { method: 'POST', token: koord.c, body: { orderId: o.id } }); cek('Koordinator menghubungkan ke order yang ada → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120))
  const as = await prisma.assignmentProduksi.findFirst({ where: { orderId: o.id } })
  cek('Pihak luar masuk tim order dengan fee = harga deal', as?.namaEksternal === 'UJI-LG Cho' && as?.feeTalent === 456666 && as?.tipeEksternal === 'FREELANCER_PERORANGAN' && !as?.userId)
  cek('LTK tercatat terhubung (orderId) & tidak bisa dihapus lagi', (await prisma.kasusLtk.findUnique({ where: { id: ltkId } })).orderId === o.id)
  r = await panggil(`/api/circle/ltk/${ltkId}/hubungkan`, { method: 'POST', token: koord.c, body: { orderId: o.id } }); cek('Menghubungkan dua kali → 409', r.s === 409)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.c }); cek('Di Produksi: marketer pemegang jadi wakil freelance order itu', r.j.data?.orders?.find(x => x.id === o.id)?.wakilFreelance === true)
  r = await panggil('/api/circle/ltk', { method: 'POST', token: koord.c, body: { studioId: S, arah: 'LEMPAR', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-LG Komunitas', judul: 'UJI-LG lempar baru' } }); const ltk2 = r.j.data?.id; if (ltk2) ltkIds.push(ltk2)
  await prisma.kasusLtk.update({ where: { id: ltk2 }, data: { status: 'DEAL', hargaSepakat: 300000 } })
  r = await panggil(`/api/circle/ltk/${ltk2}/hubungkan`, { method: 'POST', token: koord.c, body: { klien: 'UJI-LG Klien Baru', akunId: akun.id, nilai: 500000 } })
  cek('Hubungkan dengan membuat order baru → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120)); if (r.j.data?.orderId) orderIds.push(r.j.data.orderId)
  const ob = r.j.data?.orderId && await prisma.orderProduksi.findUnique({ where: { id: r.j.data.orderId }, include: { assignments: true } })
  cek('Order baru: klien, nilai, dan pihak luar (studio lain) di tim', ob?.klien === 'UJI-LG Klien Baru' && ob?.nilaiKotor === 500000 && ob?.assignments[0]?.tipeEksternal === 'STUDIO_LAIN' && ob?.assignments[0]?.feeTalent === 300000)
  r = await panggil('/api/circle/ltk', { method: 'POST', token: koord.c, body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-LG PO', judul: 'UJI-LG terima' } }); const ltk3 = r.j.data?.id; if (ltk3) ltkIds.push(ltk3)
  await prisma.kasusLtk.update({ where: { id: ltk3 }, data: { status: 'DEAL', hargaSepakat: 1 } })
  r = await panggil(`/api/circle/ltk/${ltk3}/hubungkan`, { method: 'POST', token: koord.c, body: { orderId: o.id } }); cek('LTK Terima memakai Konversi, bukan Hubungkan → 422', r.s === 422)

  console.log('— (6) penerbit invoice —')
  r = await panggil(`/api/circle/tagihan/penerbit?studioId=${S}`, { method: 'PUT', token: mkt.c, body: { rekening: 'x' } }); cek('Marketer mengubah penerbit invoice → 403', r.s === 403)
  r = await panggil(`/api/circle/tagihan/penerbit?studioId=${S}`, { method: 'PUT', token: koord.c, body: { namaPenerbit: 'PH Uji Langit', rekening: 'BCA 123 a.n. Uji', catatanKaki: 'Terima kasih' } }); cek('Koordinator menyimpan penerbit invoice → 200', r.s === 200, String(r.s))
  const rek = await prisma.studioRekening.create({ data: { studioId: S, namaBank: 'BANK-UJI', nomorRekening: '9988776655', atasNama: 'Uji Langit' } }); rekIds.push(rek.id)
  r = await panggil(`/api/circle/tagihan/penerbit?studioId=${S}`, { token: koord.c }); cek('Koordinator unit menerima rekening Ekosistem untuk mengisi invoice', r.s === 200 && r.j.data.rekeningInternal?.some(x => x.nomorRekening === '9988776655' && x.atasNama === 'Uji Langit'))
  const adm = await user('lg_adm', [['KARYAWAN', S]]); await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  r = await panggil(`/api/circle/tagihan/penerbit?studioId=${S}`, { token: adm.c }); cek('Admin Market: boleh lihat penerbit, TANPA rekening Ekosistem', r.s === 200 && r.j.data.rekeningInternal.length === 0 && !JSON.stringify(r.j).includes('9988776655'))
  r = await panggil(`/api/circle/tagihan/penerbit?studioId=${S}`, { token: mkt.c }); cek('Marketer: penerbit invoice ditolak (403)', r.s === 403 && !JSON.stringify(r.j).includes('9988776655'))
  const t = await prisma.tagihanKomunitas.create({ data: { nomor: `INV-UJI-${Date.now()}`, studioId: S, klien: 'KLIEN-UJI-LG', total: 900000, dibuatOlehId: koord.id, item: { create: [{ orderId: o.id, jumlah: 900000 }] } } }); tagihanIds.push(t.id)
  r = await panggil(`/api/circle/tagihan/${t.id}`, { token: koord.c })
  cek('Detail tagihan memuat penerbit: nama, induk, rekening, catatan kaki', r.s === 200 && r.j.data.penerbit?.nama === 'PH Uji Langit' && r.j.data.penerbit?.rekening === 'BCA 123 a.n. Uji' && r.j.data.penerbit?.catatanKaki === 'Terima kasih' && !!r.j.data.penerbit?.induk)
  const rekInternal = await prisma.studioRekening.findMany({ where: { studioId: S }, select: { nomorRekening: true } })
  cek('Nomor rekening Ekosistem tidak ikut terkirim', rekInternal.every(x => !JSON.stringify(r.j).includes(x.nomorRekening)))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tagihanIds } } })
  await prisma.studioRekening.deleteMany({ where: { id: { in: rekIds } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  if (pengaturanLama) await prisma.pengaturanInvoice.update({ where: { studioId: S }, data: { namaPenerbit: pengaturanLama.namaPenerbit, rekening: pengaturanLama.rekening, catatanKaki: pengaturanLama.catatanKaki } })
  else await prisma.pengaturanInvoice.deleteMany({ where: { studioId: S } })
  await prisma.catatanLtk.deleteMany({ where: { kasusId: { in: ltkIds } } }).catch(() => {})
  await prisma.kasusLtk.deleteMany({ where: { id: { in: ltkIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
