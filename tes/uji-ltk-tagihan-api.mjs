import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.42.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const K = await import(DASH + '/server/src/utils/ltk.js')
const T = await import(DASH + '/server/src/utils/tagihan.js')
console.log('— logika murni —')
cek('Kode: PO-2031-0001, lanjut 0002; LMP terpisah', K.kodeBerikut('TERIMA', 2031, null) === 'PO-2031-0001' && K.kodeBerikut('TERIMA', 2031, 'PO-2031-0001') === 'PO-2031-0002' && K.kodeBerikut('LEMPAR', 2031, null) === 'LMP-2031-0001')
cek('Transisi: draft→diajukan ok; draft→deal langsung ok (9 Nov 2026); deal final; ditolak tidak bisa deal', K.bolehPindah('DRAFT', 'DIAJUKAN') && K.bolehPindah('DRAFT', 'DEAL') && K.final('DEAL') && K.bolehPindah('NEGOSIASI', 'DEAL') && !K.bolehPindah('DITOLAK', 'DEAL'))
cek('Tautan: https ok, javascript: ditolak, >5 ditolak', K.bersihTautan(['https://a.id']).data.length === 1 && K.bersihTautan(['javascript:alert(1)']).galat && K.bersihTautan(Array(6).fill('https://a.id')).galat)
cek('Konversi butuh Deal+Terima+harga+akun', K.validasiKonversi({ status: 'DRAFT' }) && K.validasiKonversi({ status: 'DEAL', arah: 'LEMPAR' }) && K.validasiKonversi({ status: 'DEAL', arah: 'TERIMA', hargaSepakat: 5, akunId: null }) && K.validasiKonversi({ status: 'DEAL', arah: 'TERIMA', hargaSepakat: 5, akunId: 'x' }) === null)
cek('Tagihan: nomor INV-2031-0003; transisi', T.nomorBerikut(2031, 'INV-2031-0002') === 'INV-2031-0003' && T.bolehPindah('DRAFT', 'DITAGIH') && T.bolehPindah('DITAGIH', 'BATAL') && !T.bolehPindah('LUNAS', 'BATAL') && !T.bolehPindah('LUNAS', 'DRAFT')) // 17 Nov 2026: Ditagih boleh dibatalkan
cek('Layak: klien sama (tak peka huruf), belum lunas/batal/ditagih', T.layak({ id: 'a', klien: ' Acme ', status: 'PROSES', statusBayar: 'BELUM_LUNAS', nilaiKotor: 5 }, 'acme', new Set()) && !T.layak({ id: 'a', klien: 'Acme', status: 'PROSES', statusBayar: 'LUNAS', nilaiKotor: 5 }, 'acme', new Set()) && !T.layak({ id: 'a', klien: 'Acme', status: 'PROSES', statusBayar: 'DP', nilaiKotor: 5 }, 'acme', new Set(['a'])))

const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, P = (t, extra = {}) => ({ token: t, web: 'bloom', ...extra })
const orderIds = []
let akun
try {
  const koord = await user('lt_koord', [['KOORDINATOR', S]]), kar = await user('lt_kar', [['KARYAWAN', S]]), lain = await user('lt_lain', [['KOORDINATOR', pibi.id]])
  akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  console.log('— LTK —')
  const L = '/api/circle/ltk'
  let r = await panggil(`${L}?studioId=${S}`, P(kar.t)); cek('Karyawan membuka LTK → 403', r.s === 403)
  r = await panggil(`${L}?studioId=${S}`, P(lain.t)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${L}?studioId=${S}`, { token: koord.tNaya, web: 'bloom' }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil(L, { method: 'POST', ...P(koord.t), body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-LT Acme', judul: '' } }); cek('Judul kosong → 422', r.s === 422)
  r = await panggil(L, { method: 'POST', ...P(koord.t), body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-LT Acme', judul: 'Logo maskot', tautanRujukan: ['ftp://x'] } }); cek('Tautan non-http → 422', r.s === 422)
  r = await panggil(L, { method: 'POST', ...P(koord.t), body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-LT Acme', judul: 'Logo maskot', tautanRujukan: ['https://drive.google.com/x'] } }); cek('Buat LTK Terima → 201 berkode PO-…', r.s === 201 && /^PO-\d{4}-\d{4}$/.test(r.j.data.kode)); const id = r.j.data?.id
  r = await panggil(`${L}/${id}/deal`, { method: 'POST', ...P(koord.t), body: {} }); cek('Draft langsung Deal tanpa harga → 422 (langsung Deal boleh sejak 9 Nov 2026, harga tetap wajib)', r.s === 422)
  r = await panggil(`${L}/${id}/ajukan`, { method: 'POST', ...P(koord.t), body: {} }); cek('Ajukan → 200', r.s === 200)
  r = await panggil(`${L}/${id}/negosiasi`, { method: 'POST', ...P(koord.t), body: { catatan: 'Klien minta diskon' } }); cek('Mulai negosiasi dengan catatan → 200', r.s === 200)
  r = await panggil(`${L}/${id}/catatan`, { method: 'POST', ...P(koord.t), body: { isi: 'Sepakat 500rb' } }); cek('Tambah catatan → 201', r.s === 201)
  r = await panggil(`${L}/${id}/deal`, { method: 'POST', ...P(koord.t), body: {} }); cek('Deal tanpa harga → 422', r.s === 422)
  r = await panggil(`${L}/${id}/konversi`, { method: 'POST', ...P(koord.t), body: { akunId: akun.id } }); cek('Konversi sebelum Deal → 422', r.s === 422)
  r = await panggil(`${L}/${id}/deal`, { method: 'POST', ...P(koord.t), body: { hargaSepakat: 500000, deadlineSepakat: '2031-08-01', syarat: 'Revisi 2x' } }); cek('Deal 500.000 → 200', r.s === 200)
  r = await panggil(`${L}/${id}/konversi`, { method: 'POST', ...P(koord.t), body: { akunId: 'tidak-ada' } }); cek('Konversi akun asing → 422', r.s === 422)
  r = await panggil(`${L}/${id}/konversi`, { method: 'POST', ...P(koord.t), body: { akunId: akun.id } }); cek('Konversi → 201 jadi order', r.s === 201); const oid = r.j.data?.orderId; if (oid) orderIds.push(oid)
  const o = await prisma.orderProduksi.findUnique({ where: { id: oid } })
  cek('Order: klien Acme, nilai 500.000, tahap inbox (MASUK), deadline 1 Agu 2031', o.klien === 'UJI-LT Acme' && o.nilaiKotor === 500000 && o.status === 'MASUK' && o.deadline?.toISOString().startsWith('2031-08-01'))
  r = await panggil(`${L}/${id}/konversi`, { method: 'POST', ...P(koord.t), body: {} }); cek('Konversi dua kali → 422', r.s === 422)
  r = await panggil(`${L}/${id}`, { method: 'PATCH', ...P(koord.t), body: { judul: 'x' } }); cek('Ubah setelah jadi order → 409', r.s === 409)
  r = await panggil(`${L}/${id}`, P(koord.t)); cek('Detail memuat 3 catatan (negosiasi, manual, konversi)', r.j.data.catatan.length === 3)
  r = await panggil(`${L}/${id}`, { method: 'DELETE', ...P(koord.t) }); cek('Hapus LTK ber-order → 409', r.s === 409)
  r = await panggil(L, { method: 'POST', ...P(koord.t), body: { studioId: S, arah: 'LEMPAR', jenisPihak: 'FREELANCE', namaPihak: 'UJI-LT Freelancer', judul: 'Lempar background' } }); cek('LTK Lempar berkode LMP-…', /^LMP-/.test(r.j.data?.kode)); const id2 = r.j.data?.id
  r = await panggil(`${L}/${id2}/batal`, { method: 'POST', ...P(koord.t), body: {} }); cek('Batalkan draft → 200', r.s === 200)
  r = await panggil(`${L}/${id2}`, { method: 'DELETE', ...P(koord.t) }); cek('Hapus LTK batal → 200', r.s === 200)
  r = await panggil(`${L}?studioId=${S}&status=DEAL`, P(koord.t)); cek('Filter status Deal memuat kasus tadi', r.j.data.kasus.some(k => k.id === id))

  console.log('— Tagihan komunitas —')
  const G = '/api/circle/tagihan'
  const O = async (judul, nilai, klien = 'UJI-LT Beta') => { const x = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien, judul, nilaiKotor: nilai, nilaiBersih: nilai } }); orderIds.push(x.id); return x }
  const o1 = await O('UJI-LT order 1', 300000), o2 = await O('UJI-LT order 2', 200000), o3 = await O('UJI-LT order lain klien', 100000, 'UJI-LT Gamma')
  r = await panggil(`${G}/klien?studioId=${S}`, P(kar.t)); cek('Karyawan → 403', r.s === 403)
  r = await panggil(`${G}/klien?studioId=${S}`, P(koord.t)); cek('Daftar klien memuat Beta (2 order, 500.000)', r.s === 200 && r.j.data.some(k => k.klien === 'UJI-LT Beta' && k.order === 2 && k.total === 500000))
  r = await panggil(`${G}/layak?studioId=${S}&klien=uji-lt beta`, P(koord.t)); cek('Order layak: 2 (huruf besar-kecil tak berpengaruh)', r.j.data.length === 2)
  r = await panggil(G, { method: 'POST', ...P(koord.t), body: { studioId: S, klien: 'UJI-LT Beta', orderIds: [o1.id, o3.id] } }); cek('Campur klien lain → 422', r.s === 422)
  r = await panggil(G, { method: 'POST', ...P(koord.t), body: { studioId: S, klien: 'UJI-LT Beta', orderIds: [] } }); cek('Tanpa order → 422', r.s === 422)
  r = await panggil(G, { method: 'POST', ...P(koord.t), body: { studioId: S, klien: 'UJI-LT Beta', orderIds: [o1.id, o2.id], catatan: 'Termin 1' } }); cek('Buat tagihan → 201 INV-…', r.s === 201 && /^INV-\d{4}-\d{4}$/.test(r.j.data.nomor)); const tid = r.j.data?.id
  r = await panggil(`${G}/${tid}`, P(koord.t)); cek('Total 500.000, 2 item', r.j.data.total === 500000 && r.j.data.item.length === 2)
  r = await panggil(G, { method: 'POST', ...P(koord.t), body: { studioId: S, klien: 'UJI-LT Beta', orderIds: [o1.id] } }); cek('Order yang sudah ditagih tak bisa ditagih lagi → 422', r.s === 422)
  r = await panggil(`${G}/${tid}`, { method: 'PATCH', ...P(koord.t), body: { orderIds: [o1.id] } }); cek('Ubah jadi 1 order → total 300.000', r.s === 200 && (await panggil(`${G}/${tid}`, P(koord.t))).j.data.total === 300000)
  r = await panggil(`${G}/${tid}/lunas`, { method: 'POST', ...P(koord.t), body: {} }); cek('Draft langsung lunas → 409', r.s === 409)
  r = await panggil(`${G}/${tid}/tagih`, { method: 'POST', ...P(koord.t) }); cek('Tagih → 200', r.s === 200)
  r = await panggil(`${G}/${tid}`, { method: 'PATCH', ...P(koord.t), body: { catatan: 'x' } }); cek('Ubah tagihan yang sudah ditagih → 409', r.s === 409)
  r = await panggil(`${G}/${tid}/lunas`, { method: 'POST', ...P(koord.t), body: { tautanBukti: 'javascript:1' } }); cek('Bukti non-http → 422', r.s === 422)
  r = await panggil(`${G}/${tid}/lunas`, { method: 'POST', ...P(koord.t), body: { tanggal: '2031-07-20', tautanBukti: 'https://drive.google.com/bukti' } }); cek('Lunas → 200', r.s === 200)
  const a = await prisma.orderProduksi.findUnique({ where: { id: o1.id } }), b = await prisma.orderProduksi.findUnique({ where: { id: o2.id } })
  cek('Order 1 ikut LUNAS (tanggal 20 Jul 2031); order 2 tetap belum', a.statusBayar === 'LUNAS' && a.tanggalLunas?.toISOString().startsWith('2031-07-20') && b.statusBayar === 'BELUM_LUNAS')
  r = await panggil(`${G}/${tid}/batal`, { method: 'POST', ...P(koord.t) }); cek('Batalkan tagihan lunas → 409', r.s === 409)
  r = await panggil(G, { method: 'POST', ...P(koord.t), body: { studioId: S, klien: 'UJI-LT Beta', orderIds: [o2.id] } }); cek('Tagihan baru untuk order 2 → 201 (order 1 sudah lunas)', r.s === 201); const t2 = r.j.data.id
  r = await panggil(`${G}/${t2}/batal`, { method: 'POST', ...P(koord.t) }); cek('Batalkan draft → 200', r.s === 200)
  r = await panggil(`${G}/layak?studioId=${S}&klien=UJI-LT Beta`, P(koord.t)); cek('Setelah batal, order 2 layak lagi', r.j.data.some(x => x.id === o2.id))
  r = await panggil(`${G}/${t2}/aktifkan`, { method: 'POST', ...P(koord.t) }); cek('Aktifkan lagi → 200', r.s === 200)
  r = await panggil(`${G}?studioId=${S}`, P(koord.t)); cek('Daftar + ringkasan status', r.s === 200 && r.j.data.ringkasan.LUNAS?.jumlah >= 1)
  r = await panggil(`${G}/${t2}`, P(lain.t)); cek('Koordinator unit lain membuka tagihan → 403', r.s === 403)
} finally {
  await prisma.tagihanKomunitas.deleteMany({ where: { klien: { startsWith: 'UJI-LT' } } })
  await prisma.kasusLtk.deleteMany({ where: { namaPihak: { startsWith: 'UJI-LT' } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
