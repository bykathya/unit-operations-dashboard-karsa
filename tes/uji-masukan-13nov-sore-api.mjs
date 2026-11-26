import { DASH } from './_jalur.mjs'
// Uji MASUKAN TIM 13 Nov 2026 sore: (1) Tambah order sekalian lengkap — kategori & fee talent (fee hanya pengelola); (2) prospek "Jadi order"
// yang ordernya dihapus bisa dikembalikan ke Nego (tautan dilepas, bisa dijadikan order lagi); (3) Admin Market mengatur fungsi kerja tim produksi
// saja, tanpa fungsi Marketer/Admin; (4) Catat lembur: order yang ditunda milik orang itu di atas & bertanda; (5) Klien: terakhir dikabari.
// Memakai Keiko lokal; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.49.3.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m13s-' + T, 4)
const dibuat = [], orderIds = [], akunIds = [], leadIds = []
const user = async (kode, roleType) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('m13s_koord', 'KOORDINATOR'), koord2 = await user('m13s_koord2', 'KOORDINATOR'), adm = await user('m13s_adm', 'KARYAWAN'), tal = await user('m13s_tal', 'KARYAWAN'), mkt = await user('m13s_mkt', 'KARYAWAN')
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akun = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-M13S ${T}`, feePersen: 0 } })).id; akunIds.push(akun)
  const kat = await prisma.kategoriOrder.findFirst({ where: { studioId: S } }) ?? await prisma.kategoriOrder.create({ data: { studioId: S, nama: 'UJI-M13S Kat' } })

  // ── (1) Tambah order: kategori + fee ──
  let r = await K('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-M13S lengkap ${T}`, klien: 'uji_kl13s', akunId: akun, talentUserId: tal.id, feeTalent: 250000, kategori: kat.nama } })
  if (r.j.data?.id) orderIds.push(r.j.data.id)
  const o1 = r.j.data?.id && await prisma.orderProduksi.findUnique({ where: { id: r.j.data.id }, include: { assignments: true } })
  cek('Koordinator Tambah order dengan kategori & fee talent', r.s === 201 && o1.kategori === kat.nama && o1.assignments[0]?.feeTalent === 250000, JSON.stringify({ s: r.s, k: o1?.kategori, f: o1?.assignments?.[0]?.feeTalent, m: r.j.message }))
  r = await panggil('/api/circle/orders', { method: 'POST', token: mkt.t, body: { studioId: S, judul: `UJI-M13S mkt ${T}`, klien: 'uji_kl13s', akunId: akun, talentUserId: tal.id, feeTalent: 100000 } })
  if (r.j.data?.id) orderIds.push(r.j.data.id)
  cek('Marketer mengisi fee talent saat Tambah order → 403', r.s === 403, String(r.s))
  r = await K('/api/circle/orders', { method: 'POST', body: { studioId: S, judul: `UJI-M13S tanpa talent ${T}`, klien: 'uji_kl13s', akunId: akun, feeTalent: 100000 } })
  if (r.j.data?.id) orderIds.push(r.j.data.id)
  cek('Fee tanpa talent → 422', r.s === 422, String(r.s))

  // ── (2) prospek jadi order → order dihapus → kembali ke Nego ──
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.t, body: { studioId: S, klien: 'uji_kl13s prospek', judul: `UJI-M13S lead ${T}`, akunId: akun } })
  const leadId = r.j.data?.id; if (leadId) leadIds.push(leadId)
  r = await panggil(`/api/circle/marketing/lead/${leadId}/jadi-order`, { method: 'POST', token: mkt.t, body: { akunId: akun, nilaiDisepakati: 1000 } })
  const lj = await prisma.marketingLead.findUnique({ where: { id: leadId } }); if (lj?.orderId) orderIds.push(lj.orderId)
  cek('Prospek dijadikan order', lj?.status === 'CONVERTED' && !!lj.orderId, r.j.message ?? '')
  r = await panggil(`/api/circle/marketing/lead/${leadId}`, { method: 'PATCH', token: mkt.t, body: { status: 'NEGO' } })
  cek('Selama ordernya hidup, prospek Jadi order tidak bisa dipindah → 409', r.s === 409, String(r.s))
  await K(`/api/circle/orders/${lj.orderId}/batal`, { method: 'POST', body: { alasan: 'uji' } })
  r = await panggil(`/api/circle/marketing/lead?studioId=${S}`, { token: mkt.t }); const L = r.j.data?.lead?.find(x => x.id === leadId)
  cek('Setelah order dihapus: kartu bertanda orderBatal & bisa diubah', L?.orderBatal === true && L.bisaUbah === true, JSON.stringify({ b: L?.orderBatal, u: L?.bisaUbah }))
  r = await panggil(`/api/circle/marketing/lead/${leadId}`, { method: 'PATCH', token: mkt.t, body: { status: 'NEGO' } })
  const lk = await prisma.marketingLead.findUnique({ where: { id: leadId } })
  cek('Kembali ke Nego: status NEGO & tautan order dilepas', r.s === 200 && lk.status === 'NEGO' && lk.orderId === null, JSON.stringify({ s: r.s, st: lk.status, o: lk.orderId }))
  r = await panggil(`/api/circle/marketing/lead/${leadId}/jadi-order`, { method: 'POST', token: mkt.t, body: { akunId: akun, nilaiDisepakati: 1000 } })
  const lj2 = await prisma.marketingLead.findUnique({ where: { id: leadId } }); if (lj2?.orderId) orderIds.push(lj2.orderId)
  cek('…dan bisa dijadikan order lagi', r.s === 201 || r.s === 200 ? lj2.status === 'CONVERTED' && lj2.orderId && lj2.orderId !== lj.orderId : false, String(r.s))

  // ── (3) fungsi kerja oleh Admin Market ──
  r = await panggil(`/api/circle/tim?studioId=${S}`, { token: adm.t })
  const aTal = r.j.data?.anggota?.find(a => a.userId === tal.id), aKoo = r.j.data?.anggota?.find(a => a.userId === koord2.id)
  cek('Admin Market: bisa ubah fungsi Karyawan, tidak untuk Koordinator; Marketer/Admin terkunci', aTal?.bisaUbah === true && aKoo?.bisaUbah === false && aTal.kunciFungsi?.includes('MARKETER') && aTal.kunciFungsi?.includes('ADMIN'))
  r = await panggil(`/api/circle/tim/${tal.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'ARTIST', bidang: '3D' }, { fungsi: 'PM_QC' }] } })
  cek('Admin Market set Artist (3D) + PM/QC untuk Karyawan → 200', r.s === 200, r.j.message ?? '')
  r = await panggil(`/api/circle/tim/${tal.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'ARTIST', bidang: '3D' }, { fungsi: 'MARKETER' }] } })
  cek('Admin Market menambah fungsi Marketer → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/${mkt.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'ARTIST', bidang: '' }] } })
  cek('Admin Market mencabut fungsi Marketer orang lain → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/${mkt.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'MARKETER' }, { fungsi: 'ARTIST', bidang: 'Ilustrasi' }] } })
  cek('Admin Market mengubah baris marketer → 403 (16 Nov 2026: baris tim admin/marketing hanya Koordinator)', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/${koord2.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'PM_QC' }] } })
  cek('Admin Market mengubah fungsi Koordinator → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/${adm.id}?studioId=${S}`, { method: 'PUT', token: tal.t, body: { fungsi: [{ fungsi: 'ARTIST', bidang: '' }] } })
  cek('Talent biasa mengubah fungsi → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/terima-saran?studioId=${S}`, { method: 'POST', token: adm.t })
  cek('"Terima semua tebakan" tetap hanya Koordinator → 403', r.s === 403, String(r.s))

  // ── (4) Catat lembur: order ditunda di atas ──
  const tahap = await prisma.tahapProduksi.findMany({ where: { studioId: S } })
  const kerja = tahap.find(t => t.jenis === 'KERJA')
  const ordL = async (j) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'uji_kl13s', judul: `${j} ${T}`, nilaiKotor: 1, nilaiBersih: 1, status: 'PROSES', tahapId: kerja.id, deadline: new Date(Date.now() - 86400000) } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } }); return o }
  const biasa = await ordL('UJI-M13S biasa'), ditunda = await ordL('UJI-M13S tunda')
  await prisma.penugasanTahap.create({ data: { orderId: ditunda.id, tahapId: kerja.id, namaTahap: kerja.nama, jenisTahap: 'KERJA', userId: tal.id, status: 'MENUNGGU', tunda: true } })
  r = await panggil(`/api/circle/kehadiran/order-lembur?studioId=${S}`, { token: tal.t })
  const ol = r.j.data?.order ?? []
  cek('Pilihan order lembur: yang ditunda paling atas & bertanda', ol[0]?.id === ditunda.id && ol[0].ditunda === true && ol.some(o => o.id === biasa.id && !o.ditunda), JSON.stringify(ol.slice(0, 2)))

  // ── (6) add-on menambah nilai order (kasus tim: order USD 350 × 17.000, add-on Rp10) ──
  const oA = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'uji_kl13s', judul: `UJI-M13S addon ${T}`, nilaiKotor: 5950000, nilaiDisepakati: 5950000, nilaiBersih: 5950000, mataUang: 'USD', nilaiUsd: 350, kurs: 17000 } }); orderIds.push(oA.id)
  r = await K(`/api/circle/orders/${oA.id}/item`, { method: 'PUT', body: { item: [{ nama: 'rigging', jenis: 'ADDON', jumlah: 1, hargaSatuan: 10 }] } })
  let oa = await prisma.orderProduksi.findUnique({ where: { id: oA.id } })
  cek('Add-on Rp10 → nilai order 5.950.010 (disepakati ikut)', r.s === 200 && oa.nilaiKotor === 5950010 && oa.nilaiDisepakati === 5950010, JSON.stringify({ s: r.s, k: oa.nilaiKotor }))
  r = await K(`/api/circle/orders/${oA.id}/detail`)
  cek('Hanya add-on: tidak ada peringatan selisih & tombol Samakan', r.j.data?.uang?.selisihItem === null && r.j.data.uang.totalAddon === 10, JSON.stringify(r.j.data?.uang ?? {}).slice(0, 120))
  r = await K(`/api/circle/orders/${oA.id}/samakan-nilai`, { method: 'POST' })
  cek('Samakan nilai tanpa item pokok → 409 (nilai tidak jadi Rp10)', r.s === 409 && (await prisma.orderProduksi.findUnique({ where: { id: oA.id } })).nilaiKotor === 5950010, String(r.s))
  r = await K(`/api/circle/orders/${oA.id}/item`, { method: 'PUT', body: { item: [] } })
  oa = await prisma.orderProduksi.findUnique({ where: { id: oA.id } })
  cek('Add-on dihapus → nilai kembali 5.950.000 & USD 350', r.s === 200 && oa.nilaiKotor === 5950000 && oa.nilaiUsd === 350, `${oa.nilaiKotor}/${oa.nilaiUsd}`)
  // add-on USD: $20 × 17.000 = Rp340.000 (dikirim tampilan dalam Rupiah) → nilai USD 370
  r = await K(`/api/circle/orders/${oA.id}/item`, { method: 'PUT', body: { item: [{ nama: 'rigging', jenis: 'ADDON', jumlah: 1, hargaSatuan: 340000 }] } })
  oa = await prisma.orderProduksi.findUnique({ where: { id: oA.id } })
  cek('Order USD: add-on $20 → nilai USD 370 & Rp 6.290.000', r.s === 200 && oa.nilaiUsd === 370 && oa.nilaiKotor === 6290000, `${oa.nilaiUsd}/${oa.nilaiKotor}`)
  r = await K(`/api/circle/orders/${oA.id}/item`, { method: 'PUT', body: { item: [] } })
  oa = await prisma.orderProduksi.findUnique({ where: { id: oA.id } })
  cek('Add-on USD dihapus → kembali $350 / Rp5.950.000', oa.nilaiUsd === 350 && oa.nilaiKotor === 5950000, `${oa.nilaiUsd}/${oa.nilaiKotor}`)
  r = await panggil(`/api/circle/orders/${oA.id}/item`, { method: 'PUT', token: tal.t, body: { item: [{ nama: 'x', jenis: 'ADDON', jumlah: 1, hargaSatuan: 1000000 }] } })
  cek('Talent menambah add-on → ditolak, nilai tetap', r.s === 403 && (await prisma.orderProduksi.findUnique({ where: { id: oA.id } })).nilaiKotor === 5950000, String(r.s))

  // ── (7) Belum dibayar klien (masukan tim): hanya yang sudah Delivery/Done; status sudah/belum ditagihkan ──
  const tDlv = tahap.find(t => t.jenis === 'DELIVERY') ?? tahap.find(t => t.jenis === 'SELESAI')
  const ordB = async (j, tahapId, status = 'PROSES') => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'uji_kl13s', judul: `${j} ${T}`, nilaiKotor: 500000, nilaiBersih: 500000, nilaiDisepakati: 500000, status, tahapId } }); orderIds.push(o.id); return o }
  const bKerja = await ordB('UJI-M13S bayar kerja', kerja.id), bDlv = await ordB('UJI-M13S bayar delivery', tDlv.id), bTagih = await ordB('UJI-M13S bayar ditagih', tDlv.id)
  const inv = await prisma.tagihanKomunitas.create({ data: { nomor: `UJI-M13S-${T}`, studioId: S, klien: 'uji_kl13s', status: 'DITAGIH', total: 200000, dibuatOlehId: koord.id, item: { create: [{ orderId: bTagih.id, jumlah: 200000, keterangan: 'DP' }] } } })
  r = await K(`/api/circle/pembayaran?studioId=${S}`); let bb = r.j.data?.baris ?? []
  cek('Bawaan: hanya yang sudah Delivery/Done; yang masih dikerjakan tidak tampil tetapi dihitung', r.s === 200 && bb.some(b => b.id === bDlv.id) && !bb.some(b => b.id === bKerja.id) && r.j.data.masihDikerjakan >= 1)
  cek('Status: sudah ditagihkan (invoice terbit) vs belum dibuat tagihan', bb.find(b => b.id === bTagih.id)?.sudahDitagih === true && bb.find(b => b.id === bTagih.id)?.ditagih === 200000 && bb.find(b => b.id === bDlv.id)?.sudahDitagih === false)
  r = await K(`/api/circle/pembayaran?semua=1&studioId=${S}`); bb = r.j.data?.baris ?? []
  cek('semua=1: yang masih dikerjakan ikut tampil', bb.some(b => b.id === bKerja.id && b.sudahDelivery === false))
  await prisma.tagihanKomunitas.delete({ where: { id: inv.id } })

  // ── (5) Klien: terakhir dikabari ──
  await prisma.updateKlien.create({ data: { orderId: o1.id, studioId: S, jenis: 'PREVIEW', waktu: new Date('2026-11-01T03:00:00Z') } })
  await prisma.updateKlien.create({ data: { orderId: o1.id, studioId: S, jenis: 'CATATAN', catatan: 'bukan kontak', waktu: new Date('2026-11-10T03:00:00Z') } })
  r = await K(`/api/circle/klien?studioId=${S}`); const kl = r.j.data?.klien?.find(k => k.nama.toLowerCase() === 'uji_kl13s')
  cek('Klien: terakhirKontak = kontak terakhir (CATATAN tidak dihitung)', kl?.terakhirKontak?.startsWith('2026-11-01'), kl?.terakhirKontak)
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  await prisma.marketingLead.deleteMany({ where: { id: { in: leadIds } } })
  await prisma.itemOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.updateKlien.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.auditOrder?.deleteMany?.({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_kl13s' } } }).catch(() => {})
  await prisma.kategoriOrder.deleteMany({ where: { studioId: S, nama: 'UJI-M13S Kat' } }).catch(() => {})
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
