import { DASH } from './_jalur.mjs'
// Uji MASUKAN RIZQA 20 Nov 2026: (1) PEKERJAAN INTERNAL (porto / persiapan) — dibuat pengelola tanpa klien & uang, tetap di papan, tetapi
// TIDAK dihitung order klien (ringkasan papan, Update klien, laporan grup, direktori klien); "Jadikan order klien" & menandai order Rp0;
// (2) BUKA KEMBALI UNTUK REVISI dari detail order (order Done, termasuk arsip) — order yang sama; (3) HAPUS KLIEN percobaan yang semua
// ordernya sudah dihapus (batal). Unit Keiko lokal; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { susunLaporanSemuaUnit } = await import(DASH + '/server/src/utils/laporanGrup.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.43.9.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-20n-' + T, 4), dibuat = [], orderIds = [], klienIds = [], akunIds = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('n20_koord', 'KOORDINATOR'), mkt = await user('n20_mkt', 'KARYAWAN')
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akun = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-20N ${T}`, feePersen: 0 } })).id; akunIds.push(akun)
  const ringkas = async () => (await K(`/api/circle/papan?studioId=${S}`)).j.data
  const awal = await ringkas()

  // (1) pekerjaan internal
  let r = await panggil('/api/circle/orders', { method: 'POST', token: mkt.t, body: { studioId: S, judul: `UJI-20N porto mkt ${T}`, pekerjaanInternal: 'PORTO' } })
  cek('Marketer membuat pekerjaan internal → 403 (pengelola/admin saja)', r.s === 403, String(r.s))
  r = await K('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-20N porto ${T}`, pekerjaanInternal: 'PORTO', nilaiDisepakati: 500000, akunId: akun } })
  const idPorto = r.j.data?.id; if (idPorto) orderIds.push(idPorto)
  const porto = await prisma.orderProduksi.findUnique({ where: { id: idPorto }, include: { akun: true } })
  cek('Pekerjaan internal: tanpa klien & uang (nilai 0, akun Order internal, tanpa direktori klien)', r.s === 201 && porto?.pekerjaanInternal === 'PORTO' && porto.nilaiKotor === 0 && porto.akun.namaAkun === 'Order Internal' && !porto.klienId && porto.klien === 'Porto', JSON.stringify({ s: r.s, n: porto?.nilaiKotor, a: porto?.akun?.namaAkun, k: porto?.klien }))
  const sesudah = await ringkas()
  cek('Kartu tetap tampil di papan (bertanda internal)', sesudah.orders.some(o => o.id === idPorto && o.pekerjaanInternal === 'PORTO'))
  cek('…tetapi tidak menambah "order masuk bulan ini"', sesudah.ringkasan.jumlahMasukBulanIni === awal.ringkasan.jumlahMasukBulanIni, `${awal.ringkasan.jumlahMasukBulanIni} → ${sesudah.ringkasan.jumlahMasukBulanIni}`)
  r = await K(`/api/circle/update-klien?studioId=${S}`); cek('Tidak muncul di Update klien (tidak ada klien untuk dikabari)', !(r.j.data?.baris ?? []).some(b => b.id === idPorto))
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  const lap = (await susunLaporanSemuaUnit(hariIni)).find(x => x.studioId === S)?.teks ?? ''
  cek('Tidak masuk "Order masuk" Laporan Harian Market ke grup', !lap.includes(`UJI-20N porto ${T}`))

  // persiapan → jadikan order klien
  r = await K('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-20N persiapan ${T}`, pekerjaanInternal: 'PERSIAPAN' } })
  const idPrep = r.j.data?.id; if (idPrep) orderIds.push(idPrep)
  r = await K(`/api/circle/orders/${idPrep}`, { method: 'PATCH', body: { pekerjaanInternal: null, klien: '' } }); cek('Jadikan order klien tanpa klien/akun → 422', r.s === 422, String(r.s))
  r = await panggil(`/api/circle/orders/${idPrep}`, { method: 'PATCH', token: mkt.t, body: { pekerjaanInternal: null, klien: 'x', akunId: akun } }); cek('…oleh marketer → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/orders/${idPrep}`, { method: 'PATCH', body: { pekerjaanInternal: null, klien: `uji_klien20n_${T}`, akunId: akun, nilaiKotor: 750000 } })
  const prep = await prisma.orderProduksi.findUnique({ where: { id: idPrep } })
  if (prep?.klienId) klienIds.push(prep.klienId)
  cek('Jadikan order klien → order klien biasa (klien di direktori, nilai, tanggal masuk hari ini)', r.s === 200 && prep.pekerjaanInternal === null && !!prep.klienId && prep.nilaiKotor === 750000 && Date.now() - prep.tanggalMasuk.getTime() < 60000, JSON.stringify({ s: r.s, m: r.j.message }))
  cek('…dan kini dihitung order masuk', (await ringkas()).ringkasan.jumlahMasukBulanIni === awal.ringkasan.jumlahMasukBulanIni + 1)
  r = await K(`/api/circle/update-klien?studioId=${S}`); cek('…dan muncul di Update klien', (r.j.data?.baris ?? []).some(b => b.id === idPrep))
  r = await K(`/api/circle/orders/${idPrep}`, { method: 'PATCH', body: { pekerjaanInternal: 'PORTO' } }); cek('Order bernilai tidak bisa ditandai internal → 409', r.s === 409, String(r.s))
  const o0 = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'UJI-20N nol', judul: `UJI-20N nol ${T}`, nilaiKotor: 0, nilaiBersih: 0, status: 'MASUK', tanggalMasuk: new Date() } }); orderIds.push(o0.id)
  r = await K(`/api/circle/orders/${o0.id}`, { method: 'PATCH', body: { pekerjaanInternal: 'PORTO' } })
  cek('Order Rp0 tanpa cicilan bisa ditandai Porto', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: o0.id } })).pekerjaanInternal === 'PORTO', String(r.s))

  // (2) buka kembali untuk revisi dari detail order
  const selesai = (await prisma.tahapProduksi.findFirst({ where: { studioId: S, jenis: 'SELESAI' } })).id
  const od = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'UJI-20N done', judul: `UJI-20N done ${T}`, nilaiKotor: 100000, nilaiBersih: 100000, status: 'SELESAI', tahapId: selesai, tanggalMasuk: new Date('2026-09-02T03:00:00Z'), tanggalSelesai: new Date('2026-09-20T03:00:00Z') } }); orderIds.push(od.id)
  r = await K(`/api/circle/orders/${od.id}/detail`)
  const tb = r.j.data?.tahapBuka ?? []
  cek('Detail order Done (arsip) menawarkan tahap untuk dibuka kembali', r.s === 200 && tb.length > 0, JSON.stringify(tb.map(t => t.nama)))
  r = await panggil(`/api/circle/orders/${od.id}/detail`, { token: mkt.t }); cek('…bukan untuk marketer yang tidak memegangnya', r.s !== 200 || !r.j.data?.tahapBuka)
  const ke = tb.find(t => t.jenis === 'REVISI_KLIEN') ?? tb[0]
  r = await K(`/api/circle/orders/${od.id}/tahap`, { method: 'PATCH', body: { tahapId: ke.id } })
  const odb = await prisma.orderProduksi.findUnique({ where: { id: od.id } })
  cek('Buka kembali → order yang sama aktif lagi; tanggal masuk (omset) tetap', r.s === 200 && odb.status !== 'SELESAI' && odb.tahapId === ke.id && odb.tanggalMasuk.toISOString().startsWith('2026-09-02'), JSON.stringify({ s: r.s, st: odb.status }))

  // (3) hapus klien percobaan
  const kl = await prisma.klienProduksi.create({ data: { studioId: S, nama: `uji_klien_coba_${T}` } }); klienIds.push(kl.id)
  const ob = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: kl.nama, klienId: kl.id, judul: `UJI-20N batal ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'BATAL', tanggalMasuk: new Date() } }); orderIds.push(ob.id)
  r = await K(`/api/circle/klien/${kl.id}`, { method: 'DELETE' })
  cek('Klien yang semua ordernya sudah dihapus → bisa dihapus (order batal tetap menyimpan namanya)', r.s === 200 && !(await prisma.klienProduksi.findUnique({ where: { id: kl.id } })) && (await prisma.orderProduksi.findUnique({ where: { id: ob.id } })).klien === kl.nama, `${r.s} ${r.j.message}`)
  const kl2 = await prisma.klienProduksi.create({ data: { studioId: S, nama: `uji_klien_aktif_${T}` } }); klienIds.push(kl2.id)
  const oa = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: kl2.nama, klienId: kl2.id, judul: `UJI-20N aktif ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'PROSES', tanggalMasuk: new Date() } }); orderIds.push(oa.id)
  r = await K(`/api/circle/klien/${kl2.id}`, { method: 'DELETE' }); cek('Klien dengan order aktif → tetap ditolak (pakai Gabung)', r.s === 409, String(r.s))

  // (4) kartu Fee freelance (masukan tim): dari fee di Tim order, order yang MASUK bulan ini; sudah dibayar = rumus Bayar freelance
  const fl0 = (await ringkas()).ringkasan.freelance ?? { fee: 0, belum: 0, orang: 0, tanpaFee: 0 }
  const of = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'UJI-20N fl', judul: `UJI-20N freelance ${T}`, nilaiKotor: 1000000, nilaiBersih: 1000000, status: 'PROSES', tanggalMasuk: new Date() } }); orderIds.push(of.id)
  await prisma.assignmentProduksi.create({ data: { orderId: of.id, namaEksternal: 'UJI fl A', feeTalent: 300000, statusBayar: 'DP', dpAmount: 100000 } })
  await prisma.assignmentProduksi.create({ data: { orderId: of.id, namaEksternal: 'UJI fl B', feeTalent: null } })
  await prisma.assignmentProduksi.create({ data: { orderId: of.id, userId: mkt.id, feeTalent: 50000 } }) // talent internal: tidak dihitung
  const oporto = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'Porto', judul: `UJI-20N porto fl ${T}`, nilaiKotor: 0, nilaiBersih: 0, status: 'PROSES', pekerjaanInternal: 'PORTO', tanggalMasuk: new Date() } }); orderIds.push(oporto.id)
  await prisma.assignmentProduksi.create({ data: { orderId: oporto.id, namaEksternal: 'UJI fl C', feeTalent: 999 } }) // order internal: tidak dihitung kartu order klien
  const fl1 = (await ringkas()).ringkasan.freelance
  cek('Kartu Fee freelance: fee 300rb, belum dibayar 200rb, 1 freelance belum diisi fee (talent internal & porto tidak dihitung)', fl1 && fl1.fee - fl0.fee === 300000 && fl1.belum - fl0.belum === 200000 && fl1.tanpaFee - fl0.tanpaFee === 1 && fl1.orang - fl0.orang === 2, JSON.stringify({ fl0, fl1 }))
  r = await K(`/api/circle/papan/ringkasan?studioId=${S}&bulan=${hariIni.slice(0, 7)}`); cek('…sama di ringkasan per bulan', r.j.data?.ringkasan?.freelance?.fee === fl1?.fee, JSON.stringify(r.j.data?.ringkasan?.freelance))
  // (5) kolom Done urut paling baru selesai (masukan tim): papan mengirim tanggalSelesai (lama kosong → updatedAt)
  const sl = (await prisma.tahapProduksi.findFirst({ where: { studioId: S, jenis: 'SELESAI' } })).id
  const dLama = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'x', judul: `UJI-20N done lama ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'SELESAI', tahapId: sl, deadline: new Date('2026-12-30'), tanggalMasuk: new Date(), tanggalSelesai: new Date(Date.now() - 86400000) } }); orderIds.push(dLama.id)
  const dBaru = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'x', judul: `UJI-20N done baru ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'SELESAI', tahapId: sl, deadline: new Date('2026-12-31'), tanggalMasuk: new Date(), tanggalSelesai: new Date() } }); orderIds.push(dBaru.id)
  const pp = (await ringkas()).orders, xl = pp.find(o => o.id === dLama.id), xb = pp.find(o => o.id === dBaru.id)
  cek('Papan mengirim tanggal selesai: yang baru Done lebih baru (diurutkan di atas, walau deadline-nya lebih akhir)', !!xl && !!xb && String(xb.tanggalSelesai) > String(xl.tanggalSelesai), JSON.stringify([xl?.tanggalSelesai, xb?.tanggalSelesai]))
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.t }); cek('…juga di papan pantau marketer', (r.j.data?.orders ?? []).some(o => o.id === dBaru.id && o.tanggalSelesai))

  // (6) lihat per akun jualan (masukan tim): papan mengirim akunId + pilihan akun; ringkasan bisa satu akun; admin per akun tidak keluar akunnya
  const akun2 = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-20N B ${T}`, feePersen: 0 } })).id; akunIds.push(akun2)
  const ob2 = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun2, klien: 'x', judul: `UJI-20N akun B ${T}`, nilaiKotor: 420000, nilaiBersih: 420000, status: 'PROSES', tanggalMasuk: new Date() } }); orderIds.push(ob2.id)
  const pa = await ringkas()
  cek('Papan: tiap order membawa akunId + pilihan akun jualan', pa.orders.find(o => o.id === ob2.id)?.akunId === akun2 && (pa.akunPilihan ?? []).some(a => a.id === akun2 && a.nama.includes('Fiverr')), JSON.stringify(pa.akunPilihan?.slice(0, 3)))
  r = await K(`/api/circle/papan/ringkasan?studioId=${S}&akunId=${akun2}`)
  cek('Ringkasan bulan satu akun: hanya order akun itu', r.j.data?.ringkasan?.jumlahMasukBulanIni === 1 && r.j.data.ringkasan.total === 420000, JSON.stringify(r.j.data?.ringkasan))
  const admA = await user('n20_adm', 'KARYAWAN'); await prisma.produksiAdminMarket.create({ data: { userId: admA.id, studioId: S, akunIds: [akun] } })
  r = await panggil(`/api/circle/papan/ringkasan?studioId=${S}&akunId=${akun2}`, { token: admA.t })
  cek('Admin per akun meminta akun di luar pegangannya → kosong', r.s === 200 && r.j.data?.ringkasan?.jumlahMasukBulanIni === 0 && !r.j.data.ringkasan.total, JSON.stringify(r.j.data?.ringkasan ?? r.s))
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: admA.t }); cek('…dan pilihan akunnya hanya akun yang dipegang', !(r.j.data?.akunPilihan ?? []).some(a => a.id === akun2), JSON.stringify(r.j.data?.akunPilihan))
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: admA.id } })

  r = await panggil(`/api/circle/papan/ringkasan?studioId=${S}`, { token: mkt.t }); cek('Marketer (pantau) tidak menerima fee freelance', r.s !== 200 || r.j.data?.ringkasan?.freelance == null, JSON.stringify(r.j.data?.ringkasan ?? r.s))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.auditOrder.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.updateKlien.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.klienProduksi.deleteMany({ where: { id: { in: klienIds } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
