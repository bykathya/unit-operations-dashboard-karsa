import { DASH } from './_jalur.mjs'
// Uji masukan tim 16 Nov 2026: (1) akun jualan — Admin Market melihat saja (admin per akun hanya akunnya), tambah/ubah/hapus hanya
// Koordinator; (2) penugasan akun ke marketer hanya Koordinator; (3) hapus prospek (salah input; yang sudah jadi order ditolak); (4) catatan
// Update klien "teruskan ke talent" → Catatan proyek + centang Feedback ke talent saat Revisi klien, terbaca di Antreanku talent; (5) tanda
// talent berakun (pilihan Masuk antrean/Tunda) di Update klien & Kurasi QC, dan PATCH tahap antrean:false → tugas ditunda; (6) arsip Order
// selesai (bulan lalu, cari, per bulan, marketer hanya miliknya, talent ditolak). Data uji dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.49.6.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m16-' + T, 4)
const dibuat = [], orderIds = [], akunIds = [], leadIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('m16_koord', [['KOORDINATOR', S]]), adm = await user('m16_adm', [['KARYAWAN', S]]), mkt = await user('m16_mkt', [['KARYAWAN', S]]), mkt2 = await user('m16_mkt2', [['KARYAWAN', S]]), tal = await user('m16_tal', [['KARYAWAN', S]])
  for (const m of [mkt, mkt2]) await prisma.fungsiAnggota.create({ data: { userId: m.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const am = await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o }), A = (p, o = {}) => panggil(p, { token: adm.t, ...o })
  const akun = async (n) => { const a = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-M16 ${n} ${T}`, feePersen: 0.2 } }); akunIds.push(a.id); return a }
  const a1 = await akun('satu'), a2 = await akun('dua')

  console.log('— (1) akun jualan —')
  let r = await A(`/api/circle/akun-jualan?studioId=${S}`)
  cek('Admin Market melihat daftar akun, bisa mengubah tapi tidak menambah (18 Nov 2026: Admin = orang terpercaya Koordinator)', r.s === 200 && r.j.data.bisaUbah === true && r.j.data.bisaTambah === false && r.j.data.akun.some(a => a.id === a1.id), `${r.s} ${r.j.data?.bisaUbah}`)
  r = await A('/api/circle/akun-jualan', { method: 'POST', body: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-M16 adm ${T}` } }); cek('Admin Market menambah akun → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/akun-jualan/${a1.id}`, { method: 'PATCH', body: { namaAkun: `UJI-M16 ganti ${T}` } }); cek('Admin Market mengubah akun → 200 (18 Nov 2026)', r.s === 200, String(r.s))
  r = await A(`/api/circle/akun-jualan/${a2.id}`, { method: 'DELETE' }); cek('Admin Market menghapus akun → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/akun-jualan?studioId=${S}`); cek('Koordinator: bisaUbah true', r.s === 200 && r.j.data.bisaUbah === true)
  r = await K(`/api/circle/akun-jualan/${a1.id}`, { method: 'PATCH', body: { feePersen: 15 } }); cek('Koordinator mengubah akun → 200', r.s === 200, String(r.s))
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [a1.id] } })
  r = await A(`/api/circle/akun-jualan?studioId=${S}`); cek('Admin per akun hanya melihat akunnya', r.s === 200 && r.j.data.akun.length === 1 && r.j.data.akun[0].id === a1.id, r.j.data?.akun?.map(a => a.namaAkun).join(','))
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [] } })

  console.log('— (2) penugasan akun ke marketer —')
  r = await A(`/api/circle/marketing/akun?studioId=${S}`); cek('Admin Market: bisaAtur penugasan = true (18 Nov 2026)', r.s === 200 && r.j.data.bisaAtur === true)
  r = await A('/api/circle/marketing/akun/penugasan', { method: 'PUT', body: { studioId: S, userId: mkt.id, akunIds: [a1.id] } }); cek('Admin Market menugaskan akun ke marketer → 200 (18 Nov 2026)', r.s === 200, String(r.s))
  r = await K('/api/circle/marketing/akun/penugasan', { method: 'PUT', body: { studioId: S, userId: mkt.id, akunIds: [a1.id] } }); cek('Koordinator menugaskan akun → 200', r.s === 200, String(r.s))
  const now = new Date()
  r = await A(`/api/circle/marketing/rencana?studioId=${S}&bulan=${now.getMonth() + 1}&tahun=${now.getFullYear()}&semua=1`); cek('Rencana: Admin mendapat panel penugasan (18 Nov 2026)', r.s === 200 && r.j.data.bisaTugaskanAkun === true, String(r.s))
  r = await K(`/api/circle/marketing/rencana?studioId=${S}&bulan=${now.getMonth() + 1}&tahun=${now.getFullYear()}&semua=1`); cek('Rencana: Koordinator bisaTugaskanAkun true', r.j.data?.bisaTugaskanAkun === true)

  console.log('— (3) hapus prospek —')
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.t, body: { studioId: S, klien: `uji_m16_lead_${T}`, akunId: a1.id } }); const lid = r.j.data?.id; if (lid) leadIds.push(lid)
  cek('Marketer membuat prospek', r.s === 201 && !!lid, `${r.s} ${r.j.message ?? ''}`)
  r = await panggil(`/api/circle/marketing/lead/${lid}`, { method: 'DELETE', token: mkt2.t }); cek('Marketer lain menghapus → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/marketing/lead/${lid}`, { method: 'DELETE', token: mkt.t }); cek('Pemilik prospek menghapus (salah input) → 200 & hilang', r.s === 200 && !(await prisma.marketingLead.findUnique({ where: { id: lid } })), String(r.s))
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const id = (j) => tahap.find(t => t.jenis === j)?.id
  const ordBase = { studioId: S, akunId: a1.id, klien: `uji_m16_${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tanggalMasuk: new Date() }
  const oConv = await prisma.orderProduksi.create({ data: { ...ordBase, judul: `UJI-M16 conv ${T}`, status: 'MASUK', tahapId: id('MASUK') } }); orderIds.push(oConv.id)
  const lc = await prisma.marketingLead.create({ data: { studioId: S, klien: `uji_m16_conv_${T}`, status: 'CONVERTED', orderId: oConv.id, marketerId: mkt.id } }); leadIds.push(lc.id)
  r = await panggil(`/api/circle/marketing/lead/${lc.id}`, { method: 'DELETE', token: mkt.t }); cek('Prospek yang sudah jadi order → 409', r.s === 409, String(r.s))

  console.log('— (4) teruskan catatan ke talent —')
  const oRev = await prisma.orderProduksi.create({ data: { ...ordBase, judul: `UJI-M16 revisi ${T}`, status: 'PROSES', tahapId: id('PREVIEW_KLIEN') } }); orderIds.push(oRev.id)
  await prisma.assignmentProduksi.create({ data: { orderId: oRev.id, userId: tal.id } })
  r = await K(`/api/circle/orders/${oRev.id}/aksi`, { method: 'POST', body: { aksi: 'revisi_klien' } }); cek('Order masuk Revisi klien', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/update-klien?studioId=${S}`); let b = r.j.data.baris.find(x => x.id === oRev.id)
  cek('Update klien: tanda talent berakun & feedback belum', b?.adaTalentInternal === true && b.feedbackKeTalent === false, JSON.stringify({ t: b?.adaTalentInternal, f: b?.feedbackKeTalent }))
  r = await K('/api/circle/update-klien', { method: 'POST', body: { orderId: oRev.id, jenis: 'CATATAN', catatan: 'rambut lebih panjang', keTalent: true } })
  cek('Catatan + teruskan ke talent → 201, diteruskan', r.s === 201 && r.j.data?.diteruskan === true, `${r.s} ${r.j.message ?? ''}`)
  const co = await prisma.catatanOrder.findFirst({ where: { orderId: oRev.id }, orderBy: { createdAt: 'desc' } })
  cek('Masuk Catatan proyek order', co?.isi === 'Feedback klien: rambut lebih panjang', co?.isi)
  r = await K(`/api/circle/update-klien?studioId=${S}`); b = r.j.data.baris.find(x => x.id === oRev.id)
  cek('Centang Feedback ke talent terisi otomatis (Revisi klien, talent berakun)', b.feedbackKeTalent === true && b.catatanTerakhir === 'rambut lebih panjang')
  r = await K('/api/circle/update-klien', { method: 'POST', body: { orderId: oRev.id, jenis: 'CATATAN', catatan: 'catatan biasa' } })
  cek('Catatan tanpa centang tidak masuk Catatan proyek', r.j.data?.diteruskan === false && (await prisma.catatanOrder.count({ where: { orderId: oRev.id } })) === 1)
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: tal.t }); const ta = (r.j.data ?? []).find(x => x.orderId === oRev.id)
  cek('Antreanku talent menampilkan catatan proyek terbaru', ta?.catatanTerbaru?.isi === 'Feedback klien: rambut lebih panjang', JSON.stringify(ta?.catatanTerbaru))

  console.log('— (5) pindah tahap: tunda antrean —')
  const oQc = await prisma.orderProduksi.create({ data: { ...ordBase, judul: `UJI-M16 qc ${T}`, status: 'PROSES', tahapId: id('QC') ?? id('KERJA') } }); orderIds.push(oQc.id)
  await prisma.assignmentProduksi.create({ data: { orderId: oQc.id, userId: tal.id } })
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); const q = r.j.data?.qc?.find(x => x.id === oQc.id)
  cek('Kurasi QC: tanda talent berakun dikirim', !id('QC') || q?.adaTalentInternal === true, JSON.stringify(q?.adaTalentInternal))
  // alur lokal Keiko tidak punya QC → order uji ditaruh di Inbox dulu agar PATCH benar-benar memindah ke tahap kerja
  await prisma.orderProduksi.update({ where: { id: oQc.id }, data: { tahapId: id('MASUK'), status: 'MASUK' } })
  r = await K(`/api/circle/orders/${oQc.id}/tahap`, { method: 'PATCH', body: { tahapId: id('KERJA'), antrean: false } }); cek('Pindah manual ke tahap kerja dengan antrean:false → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  const pt = await prisma.penugasanTahap.findFirst({ where: { orderId: oQc.id, userId: tal.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
  cek('Tugas talent dibuat DITUNDA (tidak masuk Antreanku)', pt?.tunda === true, JSON.stringify({ tunda: pt?.tunda }))

  console.log('— (6) arsip order selesai —')
  const lalu = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
  const bulanLalu = lalu.toISOString().slice(0, 7)
  const oDone = await prisma.orderProduksi.create({ data: { ...ordBase, judul: `UJI-M16 arsip ${T}`, status: 'SELESAI', tahapId: id('SELESAI'), tanggalSelesai: lalu, marketerId: mkt.id, tautan: ['https://drive.google.com/uji'] } }); orderIds.push(oDone.id)
  r = await K(`/api/circle/papan?studioId=${S}`); cek('Papan (Done bulan ini) tidak memuat order selesai bulan lalu', r.s === 200 && !r.j.data.orders.some(o => o.id === oDone.id))
  r = await K(`/api/circle/orders-selesai?studioId=${S}&cari=${encodeURIComponent('UJI-M16 arsip')}`); let x = r.j.data?.order?.find(o => o.id === oDone.id)
  cek('Arsip: dicari dengan kata kunci → ketemu + folder', r.s === 200 && x?.folder === 'https://drive.google.com/uji' && x.nilai === undefined, String(r.s))
  r = await K(`/api/circle/orders-selesai?studioId=${S}&bulan=${bulanLalu}`); cek('Arsip: filter bulan selesai memuat order bulan lalu', r.j.data?.order?.some(o => o.id === oDone.id))
  const bulanIni = now.toISOString().slice(0, 7)
  r = await K(`/api/circle/orders-selesai?studioId=${S}&bulan=${bulanIni}`); cek('Arsip: bulan lain tidak memuatnya', r.s === 200 && !r.j.data.order.some(o => o.id === oDone.id))
  r = await panggil(`/api/circle/orders-selesai?studioId=${S}`, { token: mkt.t }); cek('Marketer pemegang melihat order selesainya', r.s === 200 && r.j.data.order.some(o => o.id === oDone.id))
  r = await panggil(`/api/circle/orders-selesai?studioId=${S}`, { token: mkt2.t }); cek('Marketer lain tidak melihatnya', r.s === 200 && !r.j.data.order.some(o => o.id === oDone.id))
  r = await panggil(`/api/circle/orders-selesai?studioId=${S}`, { token: tal.t }); cek('Talent → 403', r.s === 403, String(r.s))
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [a2.id] } })
  r = await A(`/api/circle/orders-selesai?studioId=${S}`); cek('Admin per akun (akun lain) tidak melihatnya', r.s === 200 && !r.j.data.order.some(o => o.id === oDone.id))
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  await prisma.marketingLead.deleteMany({ where: { OR: [{ id: { in: leadIds } }, { studioId: S, klien: { startsWith: 'uji_m16' } }] } })
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'catatanOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_m16' } } }).catch(() => {})
  await prisma.penugasanAkunMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(e => console.log('sisa akun:', e.message))
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
