import { DASH } from './_jalur.mjs'
// Uji KAS DARI CICILAN & "KE MANA OMSET" (18 Nov 2026, masukan tim + temuan audit): cicilan diterima pada order akun Komunitas/Internal
// otomatis menjadi Pendapatan (penarikan, rekening belum dipilih) — jumlah/tanggal mengikuti cicilan, lepas/hapus cicilan = Pendapatan hilang,
// tidak bisa diubah/dihapus dari Biaya & Kas (hanya pilih rekening); order Etsy (marketplace) & cicilan sebelum 19 Nov 2026 tidak; Pendapatan
// merinci saldo platform & belum dibayar klien; Saldo platform & Tutup bulan menyebut kapan diperbarui; Beranda Koordinator mengingatkan
// pemasukan tanpa rekening; marketer tidak membuka Pendapatan. Unit Keiko lokal, tahun 2031; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.45.8.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now(), B = '2031-02'
const hash = await bcrypt.hash('uji-kc-' + T, 4), dibuat = [], orderIds = [], akunIds = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const wdDari = (orderId) => prisma.penarikanPendapatan.findMany({ where: { orderId } })
try {
  const koord = await user('kc_koord', 'KOORDINATOR'), mkt = await user('kc_mkt', 'KARYAWAN')
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akunKom = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Komunitas', namaAkun: `UJI-KC kom ${T}`, feePersen: 0 } })).id
  const akunEtsy = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-KC etsy ${T}`, feePersen: 0 } })).id
  akunIds.push(akunKom, akunEtsy)
  const ord = async (judul, akunId) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId, klien: 'UJI-KC klien', judul: `${judul} ${T}`, nilaiKotor: 1000000, nilaiBersih: 1000000, status: 'PROSES', marketerId: mkt.id, tanggalMasuk: new Date(`${B}-05T03:00:00Z`) } }); orderIds.push(o.id); return o }
  const oKom = await ord('UJI-KC komunitas', akunKom), oEtsy = await ord('UJI-KC etsy', akunEtsy)

  // (1) cicilan diterima order Komunitas (oleh marketer pemegang) → Pendapatan otomatis
  let r = await panggil(`/api/circle/orders/${oKom.id}/termin`, { method: 'POST', token: mkt.t, body: { label: 'DP', jumlah: 400000, dibayarPada: `${B}-10` } })
  const t1 = r.j.data?.id
  let w = await wdDari(oKom.id)
  cek('Cicilan diterima order Komunitas → Pendapatan otomatis (rekening belum dipilih)', r.s === 201 && w.length === 1 && w[0].jumlah === 400000 && w[0].terminId === t1 && !w[0].rekeningId && w[0].dariPlatform === 'komunitas' && w[0].bulan === B, JSON.stringify(w[0] ?? r.j).slice(0, 160))
  r = await panggil(`/api/circle/orders/${oEtsy.id}/termin`, { method: 'POST', token: mkt.t, body: { label: 'Lunas', jumlah: 1000000, dibayarPada: `${B}-10` } })
  cek('Order Etsy (marketplace) lunas → TIDAK masuk kas (dicatat saat WD)', r.s === 201 && (await wdDari(oEtsy.id)).length === 0)
  r = await panggil(`/api/circle/orders/${oKom.id}/termin/${t1}`, { method: 'PATCH', token: mkt.t, body: { jumlah: 450000, dibayarPada: `${B}-12` } })
  w = await wdDari(oKom.id); cek('Ubah jumlah/tanggal cicilan → Pendapatan ikut berubah', w[0]?.jumlah === 450000 && w[0].tanggal.toISOString().startsWith(`${B}-12`), `${w[0]?.jumlah}`)
  r = await panggil(`/api/circle/orders/${oKom.id}/termin/${t1}`, { method: 'PATCH', token: mkt.t, body: { dibayarPada: null } })
  cek('Cicilan dilepas (belum dibayar) → Pendapatan dihapus', (await wdDari(oKom.id)).length === 0)
  await panggil(`/api/circle/orders/${oKom.id}/termin/${t1}`, { method: 'PATCH', token: mkt.t, body: { dibayarPada: `${B}-12` } })
  const wd = (await wdDari(oKom.id))[0]
  r = await K(`/api/circle/kas/penarikan/${wd.id}`, { method: 'DELETE' }); cek('Pendapatan dari cicilan tidak bisa dihapus dari Biaya & Kas → 409', r.s === 409, String(r.s))
  r = await K(`/api/circle/kas/penarikan/${wd.id}`, { method: 'PATCH', body: { jumlah: 1 } }); cek('…dan jumlahnya tidak bisa diubah di sana → 409', r.s === 409, String(r.s))
  const rek = await prisma.studioRekening.findFirst({ where: { studioId: S }, select: { id: true } })
  if (rek) { r = await K(`/api/circle/kas/penarikan/${wd.id}`, { method: 'PATCH', body: { rekeningId: rek.id } }); cek('Koordinator memilih rekeningnya → 200', r.s === 200 && (await prisma.penarikanPendapatan.findUnique({ where: { id: wd.id } })).rekeningId === rek.id, String(r.s)); await prisma.penarikanPendapatan.update({ where: { id: wd.id }, data: { rekeningId: null } }) }
  // cicilan lama (sebelum 19 Nov 2026) tidak dibuatkan — hindari dobel dengan penarikan manual
  r = await panggil(`/api/circle/orders/${oKom.id}/termin`, { method: 'POST', token: mkt.t, body: { label: 'Cicilan lama', jumlah: 100000, dibayarPada: '2026-11-10' } })
  cek('Cicilan diterima sebelum 19 Nov 2026 → tidak dibuatkan Pendapatan', (await wdDari(oKom.id)).length === 1)
  await panggil(`/api/circle/orders/${oKom.id}/termin/${r.j.data?.id}`, { method: 'DELETE', token: mkt.t })

  // (2) Pendapatan: ke mana omset bulan ini
  await K('/api/circle/kas/saldo-platform', { method: 'PUT', body: { studioId: S, bulan: B, platform: 'etsy', jumlah: 300000 } })
  r = await K(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${B}`)
  const rg = r.j.data?.ringkasan
  cek('Pendapatan merinci saldo platform (+ tanggal diperbarui) & belum dibayar klien', r.s === 200 && rg?.saldoPlatform?.jumlah === 300000 && !!rg.saldoPlatform.diperbarui && rg.belumDibayar?.jumlah >= 550000, JSON.stringify({ sp: rg?.saldoPlatform, bb: rg?.belumDibayar }).slice(0, 200))
  cek('Pemasukan dari cicilan ikut "sudah ditarik" & dihitung "tanpa rekening"', rg?.ditarik >= 450000 && rg?.tanpaRekening?.jumlahItem >= 1 && (r.j.data?.penarikan ?? []).some(x => x.id === wd.id && x.dariCicilan === true))
  const harap = Math.round(rg.omzetBersihOrder - rg.ditarik - rg.tertahan - rg.manualUsaha - rg.saldoPlatform.jumlah - rg.belumDibayar.jumlah)
  cek('"Belum terjelaskan" = omset − WD − tertahan − Rincian − saldo platform − belum dibayar', rg.selisih === harap, `${rg.selisih} vs ${harap}`)
  r = await panggil(`/api/circle/kas/pendapatan?studioId=${S}&bulan=${B}`, { token: mkt.t }); cek('Marketer tidak membuka Pendapatan (uang unit) → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/kas/saldo-platform?studioId=${S}&bulan=${B}`); cek('Saldo platform menyebut terakhir diperbarui', r.s === 200 && !!r.j.data?.diperbarui)
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B}`)
  cek('Tutup bulan: pemasukan tanpa rekening & saldo platform diperbarui', r.s === 200 && r.j.data?.pendapatanTanpaRekening >= 1 && !!r.j.data?.saldoPlatformDiperbarui, JSON.stringify({ t: r.j.data?.pendapatanTanpaRekening, s: r.j.data?.saldoPlatformDiperbarui }))
  r = await K(`/api/circle/beranda?studioId=${S}`)
  cek('Beranda Koordinator: pemasukan cicilan belum dipilih rekeningnya → Biaya & Kas', (r.j.data?.perhatian ?? []).some(p => p.kunci === 'rekening' && p.jumlah >= 1 && p.tab === 'kas'), JSON.stringify(r.j.data?.perhatian ?? r.j).slice(0, 200))

  // (3) hapus cicilan → Pendapatan ikut hilang; bulan ditutup tidak disentuh
  await panggil(`/api/circle/orders/${oKom.id}/termin/${t1}`, { method: 'DELETE', token: mkt.t })
  cek('Cicilan dihapus → Pendapatan ikut hilang', (await wdDari(oKom.id)).length === 0)
  const t2 = (await panggil(`/api/circle/orders/${oKom.id}/termin`, { method: 'POST', token: mkt.t, body: { label: 'Pelunasan', jumlah: 600000, dibayarPada: `${B}-20` } })).j.data?.id
  await prisma.statusBulan.upsert({ where: { studioId_bulan: { studioId: S, bulan: B } }, update: { status: 'DITUTUP' }, create: { studioId: S, bulan: B, status: 'DITUTUP' } })
  r = await panggil(`/api/circle/orders/${oKom.id}/termin/${t2}`, { method: 'PATCH', token: mkt.t, body: { jumlah: 1 } })
  cek('Bulan DITUTUP → jumlah cicilan tidak bisa diubah (409)', r.s === 409, String(r.s))
  r = await panggil(`/api/circle/orders/${oKom.id}/termin/${t2}`, { method: 'DELETE', token: mkt.t })
  w = await wdDari(oKom.id); cek('…dan tidak bisa dihapus; Pendapatan tetap (buku tertutup tetap cocok)', r.s === 409 && w.length === 1 && w[0].jumlah === 600000, `${r.s} ${w[0]?.jumlah}`)
  r = await panggil(`/api/circle/orders/${oKom.id}/termin/${t2}`, { method: 'PATCH', token: mkt.t, body: { catatan: 'boleh' } })
  cek('…catatan cicilan tetap boleh diubah', r.s === 200, String(r.s))
  // order dihapus langsung dari database → Pendapatan otomatis ikut terhapus (tidak tertinggal sebagai pemasukan tanpa sumber)
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: B } })
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: oKom.id } })
  cek('Cicilan terhapus langsung (relasi) → Pendapatan ikut terhapus', (await wdDari(oKom.id)).length === 0)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: B } })
  await prisma.saldoPlatformBulanan.deleteMany({ where: { studioId: S, bulan: B } })
  await prisma.penarikanPendapatan.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.auditOrder.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
