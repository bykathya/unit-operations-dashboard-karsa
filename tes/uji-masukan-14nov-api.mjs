import { DASH } from './_jalur.mjs'
// Uji MASUKAN TIM 14 Nov 2026: (1) tim — talent BERHENTI di tengah order (tetap tercatat, keluar dari antrean, tahap berikutnya ke talent lain,
// Aktifkan lagi) + tombol ✕ menutup tugas (bukan selesai) & menolak freelance yang sudah dibayar; dua talent bersamaan; (2) tim — satu rumus
// "belum ditagih" (DP yang diterima tanpa invoice ikut mengurangi; Pelunasan otomatis = sisa) di panel invoice & "Perlu dibuatkan invoice";
// (3) tim — kartu Produksi: nilai "sudah Delivery, belum Done". Memakai Keiko lokal; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.51.3.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m14-' + T, 4)
const dibuat = [], orderIds = [], akunIds = [], tagihanIds = [], tahapIds = []
const user = async (kode, roleType) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('m14_koord', 'KOORDINATOR'), tA = await user('m14_ta', 'KARYAWAN'), tB = await user('m14_tb', 'KARYAWAN')
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akun = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: `UJI-M14 ${T}`, feePersen: 0 } })).id; akunIds.push(akun)
  const tahap0 = await pastikanTahap(S)
  // Alur lokal Keiko hanya punya satu tahap kerja & tanpa Delivery → tambahkan sementara (dihapus di akhir) agar "tahap berikutnya" & kartu Delivery teruji
  for (const [nama, jenis, urutan] of [[`UJI-M14 Kerja 2 ${T}`, 'KERJA', 900], [`UJI-M14 Delivery ${T}`, 'DELIVERY', 901]]) tahapIds.push((await prisma.tahapProduksi.create({ data: { studioId: S, nama, jenis, urutan } })).id)
  const tahap = [...tahap0, ...(await prisma.tahapProduksi.findMany({ where: { id: { in: tahapIds } } }))]
  const inbox = tahap.find(t => t.jenis === 'MASUK'), kerja = tahap.filter(t => t.jenis === 'KERJA').sort((a, b) => a.urutan - b.urutan)
  const ord = async (judul, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'uji_kl14', judul: `${judul} ${T}`, nilaiKotor: 150000, nilaiBersih: 150000, nilaiDisepakati: 150000, tahapId: inbox.id, status: 'MASUK', tanggalMasuk: new Date(), ...extra } }); orderIds.push(o.id); return o }

  // ── (1) dua talent bersamaan, lalu talent A berhenti ──
  const o1 = await ord('UJI-M14 dua talent')
  let r = await K(`/api/circle/orders/${o1.id}/tim`, { method: 'POST', body: { userId: tA.id } }); r = await K(`/api/circle/orders/${o1.id}/tim`, { method: 'POST', body: { userId: tB.id } })
  await K(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja[0].id } })
  let aktif = await prisma.penugasanTahap.findMany({ where: { orderId: o1.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
  cek('Dua talent "semua tahap" → keduanya langsung dapat tugas di tahap kerja (bersamaan)', aktif.some(x => x.userId === tA.id) && aktif.some(x => x.userId === tB.id), String(aktif.length))
  const asgA = await prisma.assignmentProduksi.findFirst({ where: { orderId: o1.id, userId: tA.id } })
  await K(`/api/circle/orders/${o1.id}/tim/${asgA.id}`, { method: 'PATCH', body: { feeTalent: 200000 } })
  r = await panggil(`/api/circle/orders/${o1.id}/tim/${asgA.id}/berhenti`, { method: 'POST', token: tA.t, body: {} })
  cek('Talent sendiri tidak bisa menandai berhenti → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/orders/${o1.id}/tim/${asgA.id}/berhenti`, { method: 'POST', body: { alasan: 'sakit' } })
  const rowA = await prisma.penugasanTahap.findFirst({ where: { orderId: o1.id, userId: tA.id }, orderBy: { ditugaskanPada: 'desc' } })
  const asgA2 = await prisma.assignmentProduksi.findUnique({ where: { id: asgA.id } })
  cek('Berhenti: baris talent tetap ada (fee tetap), tugasnya DITUTUP (bukan selesai)', r.s === 200 && asgA2.berhentiPada && asgA2.feeTalent === 200000 && asgA2.alasanBerhenti === 'sakit' && rowA.status === 'DITUTUP' && !rowA.selesaiPada, `${r.s} ${rowA?.status}`)
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: tA.t })
  cek('Order hilang dari Antreanku talent A', r.s === 200 && !r.j.data.some(x => x.orderId === o1.id))
  r = await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token: tA.t })
  cek('…dan dari Tugas saya talent A', r.s === 200 && !(r.j.data?.tugas ?? []).some(x => x.id === o1.id))
  r = await panggil(`/api/circle/tugas-selesai?studioId=${S}`, { token: tA.t })
  cek('…dan tidak masuk Tugas selesai talent A', r.s === 200 && !(r.j.data?.tugas ?? []).some(x => x.orderId === o1.id))
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: tB.t })
  cek('Talent B tetap mengerjakan', r.j.data?.some(x => x.orderId === o1.id))
  r = await panggil(`/api/circle/orders/${o1.id}/aksi`, { method: 'POST', token: tA.t, body: { aksi: 'lanjut' } })
  cek('Talent A yang berhenti tidak bisa menggerakkan tahap', r.s === 404 || r.s === 403, String(r.s))
  r = await K(`/api/circle/papan?studioId=${S}`); const kartu = r.j.data?.orders.find(o => o.id === o1.id)
  cek('Papan: nama talent A tidak lagi tampil di kartu', kartu && !kartu.talent.includes('Uji m14_ta') && kartu.talent.includes('Uji m14_tb'), JSON.stringify(kartu?.talent))
  r = await K(`/api/circle/orders/${o1.id}/detail`); const timA = r.j.data?.tim?.find(t => t.id === asgA.id)
  cek('Detail order: talent A tetap tampil bertanda berhenti + alasan, fee tetap', !!timA?.berhentiPada && timA.alasanBerhenti === 'sakit' && r.j.data.timFee.find(t => t.id === asgA.id)?.feeTalent === 200000)
  cek('Tahap kerja kedua tersedia untuk uji', !!kerja[1])
  if (kerja[1]) {
    await K(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja[1].id } })
    aktif = await prisma.penugasanTahap.findMany({ where: { orderId: o1.id, tahapId: kerja[1].id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
    cek('Tahap berikutnya hanya untuk talent B', aktif.length === 1 && aktif[0].userId === tB.id, JSON.stringify(aktif.map(x => x.userId)))
  }
  r = await K(`/api/circle/orders/${o1.id}/tim`, { method: 'POST', body: { userId: tA.id } })
  cek('Menambah lagi talent yang berhenti → 409 dengan petunjuk "Aktifkan lagi"', r.s === 409 && /Aktifkan lagi/.test(r.j.message ?? ''), r.j.message)
  r = await K(`/api/circle/orders/${o1.id}/tim/${asgA.id}/aktifkan`, { method: 'POST' })
  aktif = await prisma.penugasanTahap.findMany({ where: { orderId: o1.id, userId: tA.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
  cek('Aktifkan lagi → talent A langsung dapat tugas di tahap sekarang', r.s === 200 && aktif.length === 1 && !(await prisma.assignmentProduksi.findUnique({ where: { id: asgA.id } })).berhentiPada, String(r.s))

  // ── ✕ hapus: tugas DITUTUP; freelance yang sudah dibayar ditolak ──
  r = await K(`/api/circle/orders/${o1.id}/tim/${asgA.id}`, { method: 'DELETE' })
  const rowX = await prisma.penugasanTahap.findFirst({ where: { orderId: o1.id, userId: tA.id }, orderBy: { ditugaskanPada: 'desc' } })
  cek('✕ hapus talent: tugas yang berjalan DITUTUP, bukan selesai', r.s === 200 && rowX.status === 'DITUTUP' && !rowX.selesaiPada, rowX?.status)
  r = await K(`/api/circle/orders/${o1.id}/tim`, { method: 'POST', body: { namaFreelance: `UJI-M14 Fl ${T}` } })
  const fl = await prisma.assignmentProduksi.findFirst({ where: { orderId: o1.id, namaEksternal: `UJI-M14 Fl ${T}` } })
  await prisma.assignmentProduksi.update({ where: { id: fl.id }, data: { feeTalent: 100000, statusBayar: 'DP', dpAmount: 50000 } })
  r = await K(`/api/circle/orders/${o1.id}/tim/${fl.id}`, { method: 'DELETE' })
  cek('✕ freelance yang sudah dibayar → 409 (pakai Berhenti)', r.s === 409 && /Berhenti/.test(r.j.message ?? ''), String(r.s))
  r = await K(`/api/circle/orders/${o1.id}/tim/${fl.id}/berhenti`, { method: 'POST', body: {} })
  r = await K(`/api/circle/bayar-freelance?studioId=${S}`)
  cek('Freelance yang berhenti tetap ada di Bayar freelance (utang tetap)', r.s === 200 && JSON.stringify(r.j.data ?? {}).includes(`UJI-M14 Fl ${T}`), String(r.s))

  // ── (2) satu rumus belum ditagih ──
  const o2 = await ord('UJI-M14 DP langsung')
  await prisma.terminBayarOrder.create({ data: { orderId: o2.id, label: 'DP', jumlah: 75000, dibayarPada: new Date(), urutan: 0 } })
  r = await K(`/api/circle/orders/${o2.id}/invoice`)
  cek('Panel invoice: DP tanpa invoice ikut mengurangi → belum ditagih 75.000', r.s === 200 && r.j.data.belumDitagih === 75000 && r.j.data.dibayarTanpaInvoice === 75000, JSON.stringify(r.j.data ?? {}).slice(0, 140))
  r = await K(`/api/circle/orders/${o2.id}/invoice`, { method: 'POST', body: { jenis: 'PELUNASAN' } })
  if (r.j.data?.id) tagihanIds.push(r.j.data.id)
  const inv = r.j.data?.id && await prisma.tagihanKomunitas.findUnique({ where: { id: r.j.data.id } })
  cek('Invoice Pelunasan otomatis = sisa 75.000 (bukan 150.000)', r.s === 201 && inv?.total === 75000, `${r.s} ${inv?.total}`)
  r = await K(`/api/circle/orders/${o2.id}/invoice`, { method: 'POST', body: { jenis: 'LAIN', keterangan: 'lebih', jumlah: 1000 } })
  cek('Setelah itu tidak bisa menagih lagi → 409', r.s === 409, String(r.s))
  const o3 = await ord('UJI-M14 Done DP', { status: 'SELESAI', tahapId: tahap.find(t => t.jenis === 'SELESAI').id, tanggalSelesai: new Date() })
  await prisma.terminBayarOrder.create({ data: { orderId: o3.id, label: 'DP', jumlah: 50000, dibayarPada: new Date(), urutan: 0 } })
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); const pi = r.j.data?.invoice?.find(x => x.id === o3.id)
  cek('"Perlu dibuatkan invoice" memakai rumus yang sama (sisa 100.000)', r.s === 200 && pi?.belumDitagih === 100000 && pi.dibayarTanpaInvoice === 50000, JSON.stringify(pi ?? {}).slice(0, 140))

  // ── (3) kartu Produksi: sudah Delivery ──
  const dlv = tahap.find(t => t.jenis === 'DELIVERY')
  cek('Tahap Delivery tersedia untuk uji', !!dlv)
  if (dlv) {
    r = await K(`/api/circle/papan?studioId=${S}`); const sebelum = r.j.data.ringkasan
    const o4 = await ord('UJI-M14 delivery', { status: 'PROSES', tahapId: dlv.id })
    r = await K(`/api/circle/papan?studioId=${S}`); const ring = r.j.data.ringkasan
    cek('Kartu: nilai order di tahap Delivery masuk "sudah Delivery", bukan Done', ring.delivery - sebelum.delivery === 150000 && ring.done === sebelum.done && Math.round(ring.total - ring.done - ring.delivery) === Math.round(ring.dikerjakan), JSON.stringify({ d: ring.delivery - sebelum.delivery, done: ring.done - sebelum.done }))
    r = await panggil(`/api/circle/papan?studioId=${S}`, { token: tA.t })
    cek('Talent tidak menerima angka uang di kartu', r.s === 403 || r.j.data?.ringkasan?.delivery == null, String(r.s))
    void o4
  }
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  await prisma.tagihanKomunitasItem.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tagihanIds } } })
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.auditOrder?.deleteMany?.({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.updateKlien.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.tahapProduksi.deleteMany({ where: { id: { in: tahapIds } } }).catch(e => console.log('sisa tahap:', e.message))
  await prisma.talentEksternal.deleteMany({ where: { nama: { startsWith: 'UJI-M14' } } }).catch(() => {})
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_kl14' } } }).catch(() => {})
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
