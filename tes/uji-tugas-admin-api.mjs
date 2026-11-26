import { DASH } from './_jalur.mjs'
// Uji TUGAS ADMIN (12 Nov 2026, masukan tim): Tugas saya pengelola order berisi (1) kartu di QC menunggu dikurasi (dengan QC lolos/gagal)
// dan (2) order yang perlu dibuatkan invoice = project Done (≤ 30 hari), belum lunas, harga belum ditagih penuh; dropdown lolos/revisi.
// Talent ditolak; Admin Market per akun hanya melihat order akunnya. Memakai Keiko lokal: langkah "QC: Pengerjaan" ditambah SEMENTARA
// (urutan dipulihkan). Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-ta-' + T, 4)
const dibuat = [], orderIds = [], akunIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
const urutanAsli = (await pastikanTahap(S)).map(t => ({ id: t.id, urutan: t.urutan }))
let qcId = null
try {
  const koord = await user('ta_koord', [['KOORDINATOR', S]]), tal = await user('ta_tal', [['KARYAWAN', S]]), adm = await user('ta_adm', [['KARYAWAN', S]])
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const tahap0 = await pastikanTahap(S)
  if (!tahap0.some(t => t.jenis === 'QC')) {
    const kerja = tahap0.find(t => t.jenis === 'KERJA')
    for (const t of [...tahap0].filter(t => t.urutan > kerja.urutan).sort((a, b) => b.urutan - a.urutan)) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan + 1 } })
    qcId = (await prisma.tahapProduksi.create({ data: { studioId: S, nama: `QC: ${kerja.nama}`, jenis: 'QC', indukId: kerja.id, urutan: kerja.urutan + 1 } })).id
  }
  const tahap = await pastikanTahap(S)
  const inbox = tahap.find(t => t.jenis === 'MASUK'), qc = tahap.find(t => t.jenis === 'QC'), preview = tahap.find(t => ['PREVIEW_KLIEN', 'PREVIEW'].includes(t.jenis))
  const akunA = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-TA A ${T}`, feePersen: 0 } })).id
  const akunB = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-TA B ${T}`, feePersen: 0 } })).id
  akunIds.push(akunA, akunB)
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S, akunIds: [akunB] } })
  const kerja = tahap.find(t => t.jenis === 'KERJA')
  const ord = async (judul, tahapId, data = {}) => {
    const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunA, klien: 'UJI-TA klien', judul: `${judul} ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId, status: 'PROSES', tanggalMasuk: new Date(), ...data } }); orderIds.push(o.id)
    await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } })
    await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: 'Colouring', jenis: 'KERJA', userId: tal.id, namaPengguna: 'Uji ta_tal', mulai: new Date(Date.now() - 7200000), selesai: new Date(Date.now() - 60000) } })
    await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: 'QC', jenis: 'QC', userId: tal.id, namaPengguna: 'Uji ta_tal', mulai: new Date(Date.now() - 60000) } })
    return o
  }
  const oQ = await ord('UJI-TA qc', qc.id), oQ2 = await ord('UJI-TA qc revisi', qc.id), oP = await ord('UJI-TA preview', preview.id), oL = await ord('UJI-TA lunas', tahap.find(t => t.jenis === 'SELESAI').id, { status: 'SELESAI', tanggalSelesai: new Date(), statusBayar: 'LUNAS' })
  const oM = await ord('UJI-TA inbox', inbox.id, { status: 'MASUK' }), oS = await ord('UJI-TA selesai', tahap.find(t => t.jenis === 'SELESAI').id, { status: 'SELESAI', tanggalSelesai: new Date() })
  const oLama = await ord('UJI-TA selesai lama', tahap.find(t => t.jenis === 'SELESAI').id, { status: 'SELESAI', tanggalSelesai: new Date(Date.now() - 45 * 86400000) })

  let r = await panggil(`/api/circle/tugas-admin?studioId=${S}`, { token: tal.t }); cek('Talent membuka Tugas admin → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); const d = r.j.data
  cek('Koordinator → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  const kq = d?.qc.find(x => x.id === oQ.id)
  cek('QC: baris "tahap – order – talent" (asal Colouring, oleh talent), hari ini, saran lolos', !!kq && kq.asal === 'Colouring' && kq.oleh === 'Uji ta_tal' && kq.hariIni && kq.tahapId === qc.id && kq.aksi.some(a => a.aksi === 'lanjut' && a.ke), JSON.stringify(kq))
  cek('QC: daftar tahap alur dikirim untuk dropdown', Array.isArray(d.tahap) && d.tahap.some(t => t.id === kerja.id) && d.tahap.some(t => t.id === preview.id))
  cek('QC: order di tahap lain tidak masuk daftar QC', !d.qc.some(x => [oP.id, oM.id].includes(x.id)))
  const ids = d.invoice.map(x => x.id)
  cek('Invoice: hanya order Done (≤ 30 hari) yang belum ditagih', ids.includes(oS.id) && d.invoice.find(x => x.id === oS.id).belumDitagih === 1000)
  cek('Invoice: Preview, QC, Inbox, lunas, dan Done > 30 hari tidak masuk', ![oP.id, oQ.id, oM.id, oL.id, oLama.id].some(id => ids.includes(id)))
  r = await K(`/api/circle/orders/${oS.id}/invoice`, { method: 'POST', body: { jenis: 'DP', jumlah: 400 } }); cek('Buat invoice DP 400 → 201', r.s === 201, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); cek('Setelah DP: sisa belum ditagih 600', r.j.data.invoice.find(x => x.id === oS.id)?.belumDitagih === 600)
  r = await K(`/api/circle/orders/${oS.id}/invoice`, { method: 'POST', body: { jenis: 'PELUNASAN' } }); cek('Buat invoice Pelunasan → 201', r.s === 201, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); cek('Sudah ditagih penuh → hilang dari daftar invoice', !r.j.data.invoice.some(x => x.id === oS.id))
  r = await K(`/api/circle/orders/${oQ.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } }); cek('Pilihan "✓ Lolos" (aksi lanjut) → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${oQ2.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja.id } }); cek('Pilihan "↺ Revisi" (kembali ke tahap kerja) → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  const q2 = await prisma.orderProduksi.findUnique({ where: { id: oQ2.id }, select: { tahapId: true, revisiKe: true } })
  cek('Revisi: order kembali ke tahap kerja & dihitung 1 revisi', q2.tahapId === kerja.id && q2.revisiKe === 1, JSON.stringify(q2))
  r = await K(`/api/circle/tugas-admin?studioId=${S}`); cek('Setelah dikurasi: keduanya hilang dari QC', !r.j.data.qc.some(x => [oQ.id, oQ2.id].includes(x.id)))
  r = await panggil(`/api/circle/tugas-admin?studioId=${S}`, { token: adm.t }); cek('Admin Market akun B: 200 tetapi tidak melihat order akun A', r.s === 200 && !r.j.data.qc.some(x => orderIds.includes(x.id)) && !r.j.data.invoice.some(x => orderIds.includes(x.id)), `${r.s}`)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  const tg = await prisma.tagihanKomunitasItem.findMany({ where: { orderId: { in: orderIds } }, select: { tagihanId: true } })
  await prisma.tagihanKomunitasItem.deleteMany({ where: { orderId: { in: orderIds } } }); await prisma.tagihanKomunitas.deleteMany({ where: { id: { in: tg.map(x => x.tagihanId) } } })
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'terminBayarOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } })
  if (qcId) await prisma.tahapProduksi.delete({ where: { id: qcId } }).catch(() => {})
  for (const t of urutanAsli) await prisma.tahapProduksi.update({ where: { id: t.id }, data: { urutan: t.urutan } }).catch(() => {})
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
