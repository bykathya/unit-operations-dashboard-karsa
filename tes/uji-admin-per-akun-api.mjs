import { DASH } from './_jalur.mjs'
// Uji ADMIN PER AKUN JUALAN (12 Nov 2026, masukan tim): Koordinator menugaskan akun jualan ke Admin Market (mis. Admin Etsy, Admin LTK);
// admin itu hanya melihat & mengelola order dari akunnya — papan, detail, aksi, ubah, buat order, tagihan, pembayaran, update klien, analitik,
// beranda, pilihan akun. Tanpa akun ditugaskan = semua order (seperti dulu). Koordinator tidak pernah dibatasi. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.43.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const S = keiko.id, T = Date.now()
const hash = await bcrypt.hash('uji-apa-' + T, 4)
const dibuat = [], akunIds = [], orderIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('apa_koord', [['KOORDINATOR', S]]), adm = await user('apa_adm', [['KARYAWAN', S]])
  const am = await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  const akun = async (nama, platform) => { const a = await prisma.akunProduksi.create({ data: { studioId: S, platform, namaAkun: `UJI-APA ${nama} ${T}`, feePersen: 0 } }); akunIds.push(a.id); return a }
  const etsy = await akun('Etsy', 'Etsy'), ltk = await akun('LTK', 'LTK'), lainUnit = await prisma.akunProduksi.create({ data: { studioId: pibi.id, platform: 'Etsy', namaAkun: `UJI-APA Pibi ${T}`, feePersen: 0 } }); akunIds.push(lainUnit.id)
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const kerja = tahap.find(t => t.jenis === 'KERJA') ?? tahap[0]
  const lusa = new Date(Date.now() + 2 * 86400000)
  const ord = async (judul, a) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: a.id, klien: 'UJI-APA klien', judul, nilaiKotor: 100000, nilaiBersih: 100000, nilaiDisepakati: 100000, tahapId: kerja.id, status: 'PROSES', deadline: lusa, tanggalMasuk: new Date() } }); orderIds.push(o.id); return o }
  const oE = await ord(`UJI-APA etsy ${T}`, etsy), oL = await ord(`UJI-APA ltk ${T}`, ltk)
  const A = (path, o = {}) => panggil(path, { token: adm.t, ...o }), K = (path, o = {}) => panggil(path, { token: koord.t, ...o })

  console.log('— koordinator menugaskan akun ke admin —')
  let r = await A(`/api/circle/admin-market/${am.id}/akun`, { method: 'PUT', body: { akunIds: [etsy.id] } }); cek('Admin market menugaskan dirinya sendiri → 403', r.s === 403)
  r = await K(`/api/circle/admin-market/${am.id}/akun`, { method: 'PUT', body: { akunIds: [lainUnit.id] } }); cek('Akun unit lain → 422', r.s === 422)
  r = await K(`/api/circle/admin-market/${am.id}/akun`, { method: 'PUT', body: { akunIds: [etsy.id] } }); cek('Koordinator: admin memegang akun Etsy → 200', r.s === 200, r.j.message)
  r = await K(`/api/circle/admin-market?studioId=${S}`); cek('Daftar admin menampilkan akun yang dipegang + pilihan akun unit', r.j.data?.admin.find(x => x.id === am.id)?.akunIds?.join() === etsy.id && r.j.data?.akun.some(a => a.id === ltk.id))

  console.log('— papan & detail —')
  r = await A(`/api/circle/papan?studioId=${S}`); const idsA = (r.j.data?.orders ?? []).map(o => o.id)
  cek('Admin Etsy: papan berisi order Etsy, TIDAK berisi order LTK', r.s === 200 && idsA.includes(oE.id) && !idsA.includes(oL.id), String(r.s))
  r = await K(`/api/circle/papan?studioId=${S}`); const idsK = (r.j.data?.orders ?? []).map(o => o.id)
  cek('Koordinator: papan berisi keduanya', idsK.includes(oE.id) && idsK.includes(oL.id))
  r = await A(`/api/circle/orders/${oE.id}/detail`); cek('Detail order Etsy → 200', r.s === 200, String(r.s))
  r = await A(`/api/circle/orders/${oL.id}/detail`); cek('Detail order LTK → ditolak', r.s === 403 || r.s === 404, String(r.s))

  console.log('— mengubah & menggerakkan order —')
  r = await A(`/api/circle/orders/${oL.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } }); cek('Aksi tahap order LTK → ditolak', r.s === 404 || r.s === 403 || r.s === 409, String(r.s))
  const tahapLain = tahap.find(t => t.id !== kerja.id && t.jenis === 'KERJA') ?? tahap.find(t => t.id !== kerja.id)
  r = await A(`/api/circle/orders/${oL.id}/tahap`, { method: 'PATCH', body: { tahapId: tahapLain.id } }); cek('Pindah tahap manual order LTK → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/orders/${oL.id}`, { method: 'PATCH', body: { judul: 'diubah' } }); cek('Ubah order LTK → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/orders/${oE.id}`, { method: 'PATCH', body: { judul: `UJI-APA etsy ubah ${T}` } }); cek('Ubah order Etsy → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await A(`/api/circle/orders/${oE.id}`, { method: 'PATCH', body: { akunId: ltk.id } }); cek('Pindahkan order Etsy ke akun LTK → 403', r.s === 403, String(r.s))
  r = await A('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-APA baru ltk ${T}`, klien: 'UJI-APA klien', akunId: ltk.id, nilaiDisepakati: 1000 } }); cek('Tambah order dengan akun LTK → 403', r.s === 403, String(r.s))
  if (r.j.data?.id) orderIds.push(r.j.data.id)
  r = await A('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-APA baru etsy ${T}`, klien: 'UJI-APA klien', akunId: etsy.id, nilaiDisepakati: 1000 } }); cek('Tambah order dengan akun Etsy → 201', r.s === 201, `${r.s} ${r.j.message ?? ''}`)
  if (r.j.data?.id) orderIds.push(r.j.data.id)
  r = await A(`/api/circle/marketing/akun?studioId=${S}`); cek('Pilihan akun (form order) hanya akun Etsy', r.s === 200 && r.j.data?.akun.some(a => a.id === etsy.id) && !r.j.data?.akun.some(a => a.id === ltk.id))

  console.log('— tagihan, pembayaran, update klien —')
  r = await A(`/api/circle/tagihan/layak?studioId=${S}&klien=UJI-APA%20klien`); cek('Order layak ditagih: hanya Etsy', r.s === 200 && r.j.data.some(o => o.id === oE.id) && !r.j.data.some(o => o.id === oL.id), String(r.s))
  r = await A('/api/circle/tagihan', { method: 'POST', body: { studioId: S, klien: 'UJI-APA klien', orderIds: [oL.id] } }); cek('Buat tagihan berisi order LTK → 422', r.s === 422, String(r.s))
  r = await A(`/api/circle/pembayaran?semua=1&studioId=${S}`); cek('Pembayaran: order LTK tidak muncul', r.s === 200 && r.j.data.baris.some(b => b.id === oE.id) && !r.j.data.baris.some(b => b.id === oL.id), String(r.s))
  r = await A(`/api/circle/update-klien?studioId=${S}`); cek('Update klien: order LTK tidak muncul', r.s === 200 && !JSON.stringify(r.j).includes(oL.id), String(r.s))
  r = await A('/api/circle/update-klien', { method: 'POST', body: { orderId: oL.id, jenis: 'PREVIEW' } }); cek('Catat update klien order LTK → 403', r.s === 403, String(r.s))

  console.log('— analitik & beranda —')
  r = await A(`/api/circle/analitik/nadi?studioId=${S}`); cek('Kondisi hari ini: order LTK tidak ikut', r.s === 200 && !JSON.stringify(r.j).includes(oL.id), String(r.s))
  r = await A(`/api/circle/beranda?studioId=${S}`); const dl = r.j.data?.delivery?.daftar ?? []
  cek('Beranda: pengingat delivery hanya order Etsy', r.s === 200 && dl.some(o => o.orderId === oE.id) && !dl.some(o => o.orderId === oL.id), JSON.stringify(dl.map(o => o.judul)))
  r = await K(`/api/circle/beranda?studioId=${S}`); cek('(kontrol) Koordinator: delivery memuat keduanya', (r.j.data?.delivery?.daftar ?? []).filter(o => [oE.id, oL.id].includes(o.orderId)).length === 2)

  console.log('— kembali tanpa batasan —')
  r = await K(`/api/circle/admin-market/${am.id}/akun`, { method: 'PUT', body: { akunIds: [] } }); cek('Kosongkan akun → admin melihat semua lagi', r.s === 200)
  r = await A(`/api/circle/papan?studioId=${S}`); const idsB = (r.j.data?.orders ?? []).map(o => o.id)
  cek('Papan admin berisi Etsy & LTK lagi', idsB.includes(oE.id) && idsB.includes(oL.id))
  r = await A(`/api/circle/orders/${oL.id}/detail`); cek('Detail order LTK → 200 lagi', r.s === 200)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  const semua = [...new Set([...orderIds, ...(await prisma.orderProduksi.findMany({ where: { judul: { contains: `UJI-APA` }, akunId: { in: akunIds } }, select: { id: true } })).map(o => o.id)])]
  await prisma.tagihanKomunitasItem.deleteMany({ where: { orderId: { in: semua } } })
  await prisma.tagihanKomunitas.deleteMany({ where: { klien: 'UJI-APA klien' } })
  for (const m of ['updateKlien', 'auditOrder', 'riwayatTahapOrder', 'catatanOrder', 'penugasanTahap', 'assignmentProduksi', 'terminBayarOrder', 'itemOrder']) await prisma[m]?.deleteMany?.({ where: { orderId: { in: semua } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: semua } } })
  await prisma.klienProduksi.deleteMany({ where: { nama: 'UJI-APA klien' } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
