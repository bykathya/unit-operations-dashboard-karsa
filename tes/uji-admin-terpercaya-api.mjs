import { DASH } from './_jalur.mjs'
// Uji 18 Nov 2026 (keputusan user: Admin = orang terpercaya Koordinator untuk produksi & market): (1) Admin Market MENGUBAH akun jualan yang ia
// pegang (admin per akun: hanya akunnya); menambah & menghapus akun tetap Koordinator; (2) Admin menugaskan akun ke marketer (hanya akunnya);
// (3) Tim: fungsi "Admin" = label, tanda akses Admin Market per orang; (4) marketer pemegang order ditetapkan Koordinator/Admin, marketer biasa
// tidak menunjuk orang lain; order tanpa pemegang boleh digerakkan fase kliennya oleh marketer unit, order milik marketer lain tidak;
// (5) PM/QC: Kurasi QC saja (QC lolos & kembali ke langkah kerja), tanpa invoice, tanpa pindah ke tahap lain. Alur Keiko lokal disisipi QC sementara.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.54.2.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-at-' + T, 4)
const dibuat = [], orderIds = [], akunIds = []
let tahapQc = null, urutanLama = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('at_koord', [['KOORDINATOR', S]]), adm = await user('at_adm', [['KARYAWAN', S]]), lbl = await user('at_label', [['KARYAWAN', S]]), mkt = await user('at_mkt', [['KARYAWAN', S]]), mkt2 = await user('at_mkt2', [['KARYAWAN', S]]), qc = await user('at_qc', [['KARYAWAN', S]]), tal = await user('at_tal', [['KARYAWAN', S]])
  const am = await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.fungsiAnggota.createMany({ data: [{ userId: adm.id, studioId: S, fungsi: 'ADMIN', terkonfirmasi: true }, { userId: lbl.id, studioId: S, fungsi: 'ADMIN', terkonfirmasi: true }, { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true }, { userId: mkt2.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true }, { userId: qc.id, studioId: S, fungsi: 'PM_QC', terkonfirmasi: true }] })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o }), A = (p, o = {}) => panggil(p, { token: adm.t, ...o })
  const akun = async (n) => { const a = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-AT ${n} ${T}`, feePersen: 0.2 } }); akunIds.push(a.id); return a }
  const a1 = await akun('satu'), a2 = await akun('dua')

  console.log('— (1) akun jualan —')
  let r = await A(`/api/circle/akun-jualan?studioId=${S}`); cek('Admin: bisa mengubah, tidak menambah', r.s === 200 && r.j.data.bisaUbah === true && r.j.data.bisaTambah === false, JSON.stringify({ u: r.j.data?.bisaUbah, t: r.j.data?.bisaTambah }))
  r = await A(`/api/circle/akun-jualan/${a1.id}`, { method: 'PATCH', body: { feePersen: 15 } }); cek('Admin mengubah fee akun → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await A('/api/circle/akun-jualan', { method: 'POST', body: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-AT baru ${T}` } }); cek('Admin menambah akun → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/akun-jualan/${a2.id}`, { method: 'DELETE' }); cek('Admin menghapus akun → 403', r.s === 403, String(r.s))
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [a1.id] } })
  r = await A(`/api/circle/akun-jualan/${a2.id}`, { method: 'PATCH', body: { feePersen: 10 } }); cek('Admin per akun mengubah akun lain → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/akun-jualan/${a1.id}`, { method: 'PATCH', body: { namaAkun: `UJI-AT satu-b ${T}` } }); cek('Admin per akun mengubah akunnya → 200', r.s === 200, String(r.s))
  r = await K(`/api/circle/akun-jualan?studioId=${S}`); cek('Koordinator: bisa menambah & mengubah', r.j.data?.bisaTambah === true && r.j.data.bisaUbah === true)

  console.log('— (2) penugasan akun ke marketer —')
  await prisma.penugasanAkunMarketer.create({ data: { userId: mkt.id, akunId: a2.id } })
  r = await A(`/api/circle/marketing/akun?studioId=${S}`); cek('Admin: bisaAtur penugasan', r.s === 200 && r.j.data.bisaAtur === true)
  r = await A('/api/circle/marketing/akun/penugasan', { method: 'PUT', body: { studioId: S, userId: mkt.id, akunIds: [a2.id] } }); cek('Admin per akun menugaskan akun lain → 422', r.s === 422, String(r.s))
  r = await A('/api/circle/marketing/akun/penugasan', { method: 'PUT', body: { studioId: S, userId: mkt.id, akunIds: [a1.id] } }); cek('Admin per akun menugaskan akunnya → 200', r.s === 200, String(r.s))
  const tug = (await prisma.penugasanAkunMarketer.findMany({ where: { userId: mkt.id } })).map(t => t.akunId).sort()
  cek('Penugasan akun lain (di luar pegangan admin) tidak tersentuh', JSON.stringify(tug) === JSON.stringify([a1.id, a2.id].sort()), JSON.stringify(tug))
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [] } })

  console.log('— (3) Tim: label Admin vs akses Admin Market —')
  r = await K(`/api/circle/tim?studioId=${S}`); const row = (u) => r.j.data?.anggota?.find(a => a.userId === u.id)
  cek('Admin Market bertanda akses; label Admin saja tidak', row(adm)?.adminMarket === true && row(lbl)?.adminMarket === false && row(lbl)?.fungsi.some(f => f.fungsi === 'ADMIN'))
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: lbl.t }); cek('Label Admin saja tidak membuka papan pengelola', r.s === 403, String(r.s))

  console.log('— (4) marketer pemegang —')
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const id = (j) => tahap.find(t => t.jenis === j)?.id
  r = await K('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-AT pemegang ${T}`, klien: `uji_at_${T}`, akunId: a1.id, nilaiDisepakati: 100000, marketerId: mkt.id } }); const o1 = r.j.data?.id; if (o1) orderIds.push(o1)
  cek('Koordinator membuat order dengan marketer pemegang', r.s === 201 && (await prisma.orderProduksi.findUnique({ where: { id: o1 } })).marketerId === mkt.id, `${r.s} ${r.j.message ?? ''}`)
  r = await panggil('/api/circle/orders', { method: 'POST', token: mkt.t, body: { studioId: S, judul: `UJI-AT mkt ${T}`, klien: `uji_at_${T}`, akunId: a1.id, nilaiDisepakati: 100000, marketerId: mkt2.id } }); const o2 = r.j.data?.id; if (o2) orderIds.push(o2)
  cek('Marketer biasa tidak bisa menunjuk orang lain (pemegang = dirinya)', r.s === 201 && (await prisma.orderProduksi.findUnique({ where: { id: o2 } })).marketerId === mkt.id, `${r.s} ${r.j.message ?? ''}`)
  r = await A(`/api/circle/orders/${o1}`, { method: 'PATCH', body: { marketerId: mkt2.id } }); cek('Admin mengganti pemegang → 200 & tercatat di riwayat', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: o1 } })).marketerId === mkt2.id && (await prisma.auditOrder.count({ where: { orderId: o1, field: 'marketer pemegang' } })) === 1, `${r.s} ${r.j.message ?? ''}`)
  r = await panggil(`/api/circle/orders/${o2}`, { method: 'PATCH', token: mkt.t, body: { marketerId: mkt2.id } }); cek('Marketer pemegang menyerahkan ke orang lain → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/orders/${o1}`, { method: 'PATCH', body: { marketerId: tal.id } }); cek('Pemegang bukan marketer unit → 422', r.s === 422, String(r.s))
  const oTanpa = await prisma.orderProduksi.create({ data: { studioId: S, akunId: a1.id, klien: `uji_at_${T}`, judul: `UJI-AT tanpa ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'PROSES', tahapId: id('PREVIEW_KLIEN'), tanggalMasuk: new Date() } }); orderIds.push(oTanpa.id)
  await prisma.orderProduksi.update({ where: { id: o1 }, data: { tahapId: id('PREVIEW_KLIEN'), status: 'PROSES' } })
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.t }); const kt = r.j.data?.orders?.find(o => o.id === oTanpa.id), k1 = r.j.data?.orders?.find(o => o.id === o1)
  cek('Papan pantau marketer: order TANPA pemegang bisa digerakkan fase kliennya', kt?.aksi?.length > 0, JSON.stringify(kt?.aksi?.map(a => a.aksi)))
  cek('Order milik marketer lain: tidak ada tombol fase klien', (k1?.aksi ?? []).length === 0, JSON.stringify(k1?.aksi?.map(a => a.aksi)))
  r = await panggil(`/api/circle/orders/${o1}/aksi`, { method: 'POST', token: mkt.t, body: { aksi: 'lanjut' } }); cek('Server menolak aksi fase klien order milik marketer lain', r.s === 403 || r.s === 404 || r.s === 409, String(r.s))

  console.log('— (5) PM/QC: Kurasi QC saja —')
  const kerja = tahap.find(t => t.jenis === 'KERJA')
  urutanLama = (await prisma.tahapProduksi.findMany({ where: { studioId: S, urutan: { gt: kerja.urutan } }, select: { id: true, urutan: true } }))
  for (const t of urutanLama) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan + 1 } })
  tahapQc = await prisma.tahapProduksi.create({ data: { studioId: S, nama: `QC Uji ${T}`, jenis: 'QC', urutan: kerja.urutan + 1, indukId: kerja.id } })
  const mk = async (j) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: a1.id, klien: `uji_at_${T}`, judul: `UJI-AT ${j} ${T}`, nilaiKotor: 500000, nilaiBersih: 500000, nilaiDisepakati: 500000, status: 'PROSES', tahapId: tahapQc.id, tanggalMasuk: new Date() } }); orderIds.push(o.id); return o }
  const q1 = await mk('qc lolos'), q2 = await mk('qc revisi'), q3 = await mk('qc lain')
  const QC = (p, o = {}) => panggil(p, { token: qc.t, ...o })
  r = await QC(`/api/circle/tugas-admin?studioId=${S}`)
  cek('PM/QC: Kurasi QC tampil, tanpa bagian invoice', r.s === 200 && r.j.data.hanyaQc === true && r.j.data.invoice.length === 0 && r.j.data.qc.some(x => x.id === q1.id), `${r.s} ${r.j.message ?? ''}`)
  r = await QC(`/api/circle/orders/${q1.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } }); cek('PM/QC: QC lolos → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await QC(`/api/circle/orders/${q2.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja.id } }); cek('PM/QC: kembali ke langkah kerja (revisi) → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await QC(`/api/circle/orders/${q3.id}/tahap`, { method: 'PATCH', body: { tahapId: id('SELESAI') } }); cek('PM/QC: pindah ke tahap lain (Done) → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tugas-admin?studioId=${S}`, { token: tal.t }); cek('Talent tanpa PM/QC: Kurasi QC → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/orders/${q3.id}/aksi`, { method: 'POST', token: tal.t, body: { aksi: 'lanjut' } }); cek('Talent tanpa PM/QC: QC lolos ditolak', r.s >= 400, String(r.s))
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'catatanOrder', 'terminBayarOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  if (tahapQc) await prisma.tahapProduksi.delete({ where: { id: tahapQc.id } }).catch(e => console.log('sisa tahap:', e.message))
  for (const t of urutanLama) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan } }).catch(() => {})
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_at_' } } }).catch(() => {})
  await prisma.penugasanAkunMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(e => console.log('sisa akun:', e.message))
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
