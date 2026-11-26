import { DASH } from './_jalur.mjs'
// Uji PANTAU PRODUKSI & ADMIN MARKET (27 Okt 2026, permintaan user):
// (1) Marketer (bukan Koordinator) boleh membuka papan Produksi dalam mode PANTAU — lihat saja, tanpa aksi/daftar anggota/total uang unit,
//     nilai uang hanya untuk order yang ia pegang. Talent biasa tetap ditolak.
// (2) Admin Market tetap mengelola order, tetapi BUKAN pengelola SDM: presensi tim, kotak izin, refleksi & profil SDM anggota tertutup.
// Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.41.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const S = keiko.id
const hash = await bcrypt.hash('uji-pantau-' + Date.now(), 4)
const dibuat = [], orderIds = []
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('pt_koord', [['KOORDINATOR', S]])
  const mkt = await user('pt_mkt', [['KARYAWAN', S]], 'MARKETER'), mkt2 = await user('pt_mkt2', [['KARYAWAN', S]], 'MARKETER')
  const kar = await user('pt_kar', [['KARYAWAN', S]])
  const adm = await user('pt_adm', [['KARYAWAN', S]]); await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const ord = async (judul, marketerId, nilai) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-PT', judul, nilaiKotor: nilai, nilaiBersih: nilai, nilaiDisepakati: nilai, marketerId, tanggalMasuk: new Date() } }); orderIds.push(o.id); return o }
  const milik = await ord('UJI-PT milik', mkt.id, 123000), lain = await ord('UJI-PT lain', mkt2.id, 456000)

  console.log('— marketer: mode pantau —')
  let r = await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.c }); const d = r.j.data
  cek('Marketer membuka papan → 200, pantau, tanpa ubah', r.s === 200 && d?.pantau === true && d?.bisaUbah === false, String(r.s))
  const om = d?.orders?.find(o => o.id === milik.id), ol = d?.orders?.find(o => o.id === lain.id)
  cek('Order miliknya: nilai tampil & milikSaya', om?.nilaiBersih === 123000 && om?.milikSaya === true)
  cek('Order marketer lain: terlihat di papan, nilai & status bayar disembunyikan', !!ol && ol.nilaiBersih === null && ol.nilaiDisepakati === null && ol.statusBayar === null && ol.milikSaya === false)
  cek('Tanpa freelance: tidak ada aksi tahap kerja (hanya fase klien), daftar anggota kosong, total uang unit disembunyikan', d?.orders?.every(o => o.wakilFreelance || o.aksi.every(x => x.aksi === 'menunggu_klien')) && d?.anggota?.length === 0 && d?.ringkasan?.total === null && typeof d?.ringkasan?.jumlahMasukBulanIni === 'number')
  r = await panggil(`/api/circle/orders/${lain.id}/detail`, { token: mkt.c }); cek('Detail order marketer lain → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/orders/${milik.id}/detail`, { token: mkt.c }); cek('Detail order miliknya → 200', r.s === 200, String(r.s))
  const tahapLain = d?.tahap?.find(t => t.id !== ol?.tahapId)
  r = await panggil(`/api/circle/orders/${lain.id}/tahap`, { method: 'PATCH', token: mkt.c, body: { tahapId: tahapLain?.id } }); cek('Marketer memindah tahap order orang lain (manual) → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: kar.c }); cek('(kontrol) Talent biasa: papan → 403', r.s === 403)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const dk = r.j.data
  cek('(kontrol) Koordinator: papan penuh dengan semua nilai', r.s === 200 && !dk?.pantau && dk?.bisaUbah === true && dk?.orders?.find(o => o.id === lain.id)?.nilaiBersih === 456000)

  console.log('— wakil freelance: marketer menggerakkan tahap kerja order freelance miliknya (9 Nov 2026) —')
  const fl = await ord('UJI-PT freelance', mkt.id, 300000), flLain = await ord('UJI-PT freelance lain', mkt2.id, 300000), internal = await ord('UJI-PT internal', mkt.id, 300000)
  for (const o of [fl, flLain]) await prisma.assignmentProduksi.create({ data: { orderId: o.id, namaEksternal: 'Freelance Uji', tipeEksternal: 'FREELANCER_PERORANGAN' } })
  await prisma.assignmentProduksi.create({ data: { orderId: internal.id, userId: kar.id } })
  const papanM = async () => (await panggil(`/api/circle/papan?studioId=${S}`, { token: mkt.c })).j.data
  let p = await papanM(); let of = p.orders.find(o => o.id === fl.id)
  cek('Order freelance miliknya: tanda wakil + tombol "Mulai kerjakan"', of?.wakilFreelance === true && of.aksi.some(x => x.aksi === 'lanjut'), JSON.stringify(of?.aksi))
  cek('Order freelance marketer LAIN: bukan wakil, tanpa aksi tahap kerja', p.orders.find(o => o.id === flLain.id)?.wakilFreelance === false && p.orders.find(o => o.id === flLain.id).aksi.every(x => x.aksi !== 'lanjut'))
  cek('Order miliknya dengan talent INTERNAL: bukan wakil (talent yang menggerakkan)', p.orders.find(o => o.id === internal.id)?.wakilFreelance === false)
  r = await panggil(`/api/circle/orders/${flLain.id}/aksi`, { method: 'POST', token: mkt.c, body: { aksi: 'lanjut' } }); cek('Menggerakkan order freelance marketer lain → ditolak', r.s === 409 || r.s === 404, String(r.s))
  r = await panggil(`/api/circle/orders/${internal.id}/aksi`, { method: 'POST', token: mkt.c, body: { aksi: 'lanjut' } }); cek('Menggerakkan order miliknya bertalent internal → ditolak', r.s === 409 || r.s === 404, String(r.s))
  let jenisAkhir = null, langkahOk = 0
  for (let i = 0; i < 12; i++) {
    p = await papanM(); of = p.orders.find(o => o.id === fl.id); jenisAkhir = p.tahap.find(t => t.id === of.tahapId)?.jenis
    if (!['MASUK', 'KERJA', 'REVISI_INTERNAL'].includes(jenisAkhir)) break
    const lanjut = of.aksi.find(x => x.aksi === 'lanjut'); if (!lanjut) break
    r = await panggil(`/api/circle/orders/${fl.id}/aksi`, { method: 'POST', token: mkt.c, body: { aksi: 'lanjut' } }); if (r.s !== 200) break; langkahOk++
  }
  cek('Marketer menggeser tahap kerja order freelance sampai keluar fase produksi', langkahOk >= 2 && ['QC', 'PREVIEW_KLIEN', 'DELIVERY', 'FINALISASI'].includes(jenisAkhir), `${langkahOk} langkah, berhenti di ${jenisAkhir}`)
  // Gerbang QC diuji langsung ke mesin alur (templat Keiko lokal tidak punya QC): wakil freelance (ditugaskan + marketer) tetap tanpa aksi QC
  const { aksiTersedia } = await import(DASH + '/server/src/utils/alur.js')
  const qcT = [{ id: 'a', nama: 'Inbox', jenis: 'MASUK', urutan: 1 }, { id: 'b', nama: 'Sketch', jenis: 'KERJA', urutan: 2 }, { id: 'c', nama: 'QC', jenis: 'QC', urutan: 3 }, { id: 'd', nama: 'Revisi internal', jenis: 'REVISI_INTERNAL', urutan: 4 }, { id: 'e', nama: 'Preview', jenis: 'PREVIEW_KLIEN', urutan: 5 }, { id: 'f', nama: 'Done', jenis: 'SELESAI', urutan: 6 }]
  const aksiQc = (peran) => aksiTersedia({ templat: qcT, order: { tahapAktif: [] }, sekarang: qcT[2], riwayat: [], peran })
  cek('Mesin alur: wakil freelance di tahap QC → tanpa aksi (QC lolos/gagal hanya Koordinator/Admin)', aksiQc({ manajer: false, ditugaskan: true, marketer: true }).length === 0 && aksiQc({ manajer: true, ditugaskan: false, marketer: false }).length === 2)
  const aksiSketch = aksiTersedia({ templat: qcT, order: { tahapAktif: [] }, sekarang: qcT[1], riwayat: [], peran: { manajer: false, ditugaskan: true, marketer: true } })
  cek('Mesin alur: wakil freelance di tahap kerja → "Siap QC"', aksiSketch.length === 1 && aksiSketch[0].label === 'Siap QC')
  const jejak = await prisma.riwayatTahapOrder.findMany({ where: { orderId: fl.id }, select: { namaPengguna: true } })
  cek('Riwayat tahap mencatat nama marketer', jejak.some(j => j.namaPengguna === 'Uji pt_mkt'))

  console.log('— marketer yang DIPINDAH unit di Ekosistem tidak lagi muncul di unit lama (9 Nov 2026) —')
  const pindah = await user('pt_pindah', [['KARYAWAN', S]], 'MARKETER')
  await prisma.penugasanAkunMarketer.create({ data: { userId: pindah.id, akunId: akun.id } })
  r = await panggil(`/api/circle/setoran?studioId=${S}`, { token: koord.c }); cek('Sebelum pindah: muncul di ringkasan setoran', r.s === 200 && r.j.data.ringkasan.some(b => b.marketerId === pindah.id))
  await prisma.userRole.deleteMany({ where: { userId: pindah.id, studioId: S } })                     // dipindah unit di SDM Ekosistem
  r = await panggil(`/api/circle/setoran?studioId=${S}`, { token: koord.c }); cek('Sesudah pindah: hilang dari ringkasan setoran unit lama', r.s === 200 && !r.j.data.ringkasan.some(b => b.marketerId === pindah.id))
  r = await panggil(`/api/circle/marketing/rencana?studioId=${S}&semua=1`, { token: koord.c }); cek('Sesudah pindah: hilang dari daftar marketer Rencana', r.s === 200 && Array.isArray(r.j.data.marketer) && r.j.data.marketer.length > 0 && !r.j.data.marketer.some(m => m.marketer?.id === pindah.id))

  console.log('— admin market: kelola order, bukan SDM —')
  r = await panggil('/api/circle/saya', { token: adm.c }); const st = r.j.data?.studios?.find(s => s.id === S)
  cek('Admin market: mode kelola + tanda adminMarket', st?.mode === 'kelola' && st?.adminMarket === true)
  r = await panggil('/api/circle/saya', { token: koord.c }); cek('(kontrol) Koordinator: adminMarket=false', r.j.data?.studios?.find(s => s.id === S)?.adminMarket === false)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: adm.c }); cek('Admin market: papan penuh tetap bisa', r.s === 200 && r.j.data?.bisaUbah === true && !r.j.data?.pantau)
  for (const [label, path] of [['Roster presensi tim', `/api/circle/kehadiran/roster?studioId=${S}`], ['Rekap presensi', `/api/circle/kehadiran/rekap?studioId=${S}`], ['Kotak izin', `/api/circle/kehadiran/kotak-cuti?studioId=${S}`], ['Refleksi tim', `/api/circle/refleksi/tim?studioId=${S}`], ['Refleksi seseorang', `/api/circle/refleksi/orang/${kar.id}`], ['Profil SDM anggota', `/api/circle/profil-sdm?userId=${kar.id}`]]) {
    r = await panggil(path, { token: adm.c }); cek(`Admin market: ${label} → 403`, r.s === 403, String(r.s))
    r = await panggil(path, { token: koord.c }); cek(`(kontrol) Koordinator: ${label} → 200`, r.s === 200, String(r.s))
  }
  console.log('— Beranda: angka SDM (izin/refleksi) tertutup untuk Admin Market (11 Nov 2026) —')
  r = await panggil(`/api/circle/beranda?studioId=${S}`, { token: adm.c }); cek('Admin market: Beranda tanpa jumlah izin & perlu dukungan (null), tanpa perhatian izin/dukungan', r.s === 200 && r.j.data.manajer?.izinMenunggu === null && r.j.data.manajer?.perluDukungan === null && !r.j.data.perhatian.some(x => ['izin', 'dukungan'].includes(x.kunci)), String(r.s))
  r = await panggil(`/api/circle/beranda?studioId=${S}`, { token: koord.c }); cek('(kontrol) Koordinator: jumlah izin & perlu dukungan berupa angka', typeof r.j.data.manajer?.izinMenunggu === 'number' && typeof r.j.data.manajer?.perluDukungan === 'number')
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.checklistSetor.deleteMany({ where: { marketerId: { in: dibuat } } }); await prisma.setoranMarketer.deleteMany({ where: { marketerId: { in: dibuat } } })
  await prisma.penugasanAkunMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
