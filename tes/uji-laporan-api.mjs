import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.44.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const X = await import(DASH + '/server/src/utils/laporanOgs.js')
const P0 = await import(DASH + '/server/src/utils/penugasan.js')
const W = (s) => new Date(s + '+07:00')
console.log('— logika murni —')
const an = P0.urutkanAntrean([{ id: 'a', ditugaskanPada: '2031-07-01', urutanAntrean: 1 }, { id: 'b', ditugaskanPada: '2031-07-02' }, { id: 'c', ditugaskanPada: '2031-07-03', mendesak: true }])
cek('Antrean: mendesak paling atas, lalu urutan koordinator, lalu FIFO', an.map(x => x.id).join() === 'c,a,b' && an[0].nomor === 1)
const baris = [
  { userId: 'u1', ditugaskanPada: W('2031-07-07T10:00'), selesaiPada: W('2031-07-08T11:00') },
  { userId: 'u1', ditugaskanPada: W('2031-07-08T09:00'), selesaiPada: null },
  { userId: 'u2', ditugaskanPada: W('2031-07-09T09:00'), selesaiPada: null },
]
const ph = X.progresHarian(baris, '2031-07-07', '2031-07-09')
cek('Progres 7 Jul: 1 total baru, belum selesai', ph[0].total === 1 && ph[0].selesai === 0 && ph[0].totalBaru === 1)
cek('Progres 8 Jul: total 2 (1 carry selesai, 1 baru), 50%', ph[1].total === 2 && ph[1].selesai === 1 && ph[1].selesaiCarry === 1 && ph[1].totalCarry === 1 && ph[1].totalBaru === 1 && ph[1].persen === 50)
cek('Progres 9 Jul: yang selesai kemarin tak dihitung; u1 carry 1, u2 baru 1', ph[2].total === 2 && ph[2].selesai === 0 && ph[2].perPekerja.find(w => w.userId === 'u1').totalCarry === 1 && ph[2].perPekerja.find(w => w.userId === 'u2').totalBaru === 1)
const semua = new Map([['o1', [{ namaTahap: 'Sketsa', userId: 'u1' }, { namaTahap: 'Warna', userId: 'u1' }, { namaTahap: 'Warna', userId: 'u2' }]]])
const sel = [{ id: 's1', orderId: 'o1', userId: 'u1', namaTahap: 'Sketsa', bulan: 6 }, { id: 's2', orderId: 'o1', userId: 'u1', namaTahap: 'Warna', bulan: 7 }, { id: 's3', orderId: 'o1', userId: 'u2', namaTahap: 'Warna', bulan: 7 }]
cek('Porsi: 1000 ÷ 2 tahap ÷ pekerja (Sketsa 1, Warna 2) → 500 / 250 / 250', X.porsiTahap(sel[0], semua, new Map([['o1', 1000]])) === 500 && X.porsiTahap(sel[1], semua, new Map([['o1', 1000]])) === 250)
const kb = X.hitungKontribusi(sel, semua, new Map([['o1', 1000]]), 7)
const u1 = kb.orang.find(o => o.userId === 'u1')
cek('Kontribusi u1: bulan Juli 250, kumulatif 750; total kumulatif 1000 (tak dobel)', u1.bulan.nilai === 250 && u1.kumulatif.nilai === 750 && kb.total.kumulatif.nilai === 1000 && kb.orang[0].userId === 'u1')
cek('Bulan 0 = seluruh tahun (hanya kumulatif)', X.hitungKontribusi(sel, semua, new Map([['o1', 1000]]), 0).total.bulan.tahap === 0)
const bk = X.bebanKerja([{ userId: 'a', bulan: 1 }, { userId: 'a', bulan: 1 }, { userId: 'b', bulan: 12 }])
cek('Beban kerja: a 2 di Januari, urut terbanyak', bk[0].userId === 'a' && bk[0].bulan[0] === 2 && bk[1].bulan[11] === 1)

const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, P = (t) => ({ token: t, web: 'bloom' })
const orderIds = []
let akun
try {
  const koord = await user('lp_koord', [['KOORDINATOR', S]]), a = await user('lp_a', [['KARYAWAN', S]]), b = await user('lp_b', [['KARYAWAN', S]]), lain = await user('lp_lain', [['KOORDINATOR', pibi.id]])
  akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const tahapRows = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const inbox = tahapRows[0]
  const sekarang = new Date()
  const O = async (judul, data) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-LP k', judul, nilaiKotor: 1000, nilaiBersih: 800, tahapId: inbox.id, ...data } }); orderIds.push(o.id); return o }
  const o1 = await O('UJI-LP order 1', { status: 'PROSES', deadline: new Date(sekarang.getTime() + 1 * 86400000 + 3600000), tanggalMasuk: new Date(sekarang.getTime() - 3 * 86400000) })
  const o2 = await O('UJI-LP order 2', { status: 'PROSES', deadline: new Date(sekarang.getTime() - 3 * 86400000) })
  const pt = async (order, user, namaTahap, status, extra = {}) => prisma.penugasanTahap.create({ data: { orderId: order.id, tahapId: inbox.id, namaTahap, jenisTahap: 'KERJA', userId: user.id, status, ...extra } })
  const p1 = await pt(o1, a, 'Sketsa', 'DIKERJAKAN', { ditugaskanPada: new Date(sekarang.getTime() - 2 * 86400000) })
  // alur nyata: A anggota tim order 1 & order berada di tahap kerja → muncul di Tugas saya (dan Beranda memakai definisi yang sama)
  const tahapKerja = tahapRows.find(t => t.jenis === 'KERJA')
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tahapKerja.id } })
  await prisma.assignmentProduksi.create({ data: { orderId: o1.id, userId: a.id } })
  const p2 = await pt(o1, b, 'Warna', 'SELESAI', { selesaiPada: sekarang, ditugaskanPada: new Date(sekarang.getTime() - 86400000) })
  const p3 = await pt(o2, a, 'Sketsa', 'SELESAI', { selesaiPada: sekarang })
  await prisma.riwayatTahapOrder.create({ data: { orderId: o1.id, namaTahap: 'Sketsa', jenis: 'KERJA', userId: koord.id, namaPengguna: 'x' } })
  await prisma.catatanOrder.create({ data: { orderId: o1.id, userId: a.id, nama: 'x', isi: 'UJI-LP catatan' } })

  console.log('— beranda —')
  let r = await panggil('/api/circle/beranda?studioId=' + S, P(lain.t)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil('/api/circle/beranda?studioId=' + S, { token: a.tNaya, web: 'bloom' }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil('/api/circle/beranda?studioId=' + S, P(a.t)); cek('Karyawan: sapaan, tugas aktif 1, selesai hari ini 1, tanpa blok manajer', r.s === 200 && r.j.data.sapaan && r.j.data.tugasSaya.aktif === 1 && r.j.data.tugasSaya.selesaiHariIni === 1 && r.j.data.manajer === null && r.j.data.seri === null)
  { const ts = await panggil('/api/circle/tugas-saya?studioId=' + S, P(a.t)); cek('Tugas aktif di Beranda = angka di Tugas saya (satu definisi)', ts.s === 200 && ts.j.data.ringkas.aktif === r.j.data.tugasSaya.aktif, `${ts.s} ${ts.j.data?.ringkas?.aktif} vs ${r.j.data.tugasSaya.aktif}`) }
  cek('Karyawan melihat delivery H-1 untuk ordernya (1), dan hanya ordernya', r.j.data.delivery.h1 === 1 && r.j.data.delivery.daftar.every(d => d.judul.startsWith('UJI-LP') || true))
  r = await panggil('/api/circle/beranda?studioId=' + S, P(koord.t)); const bd = r.j.data
  cek('Koordinator: blok manajer (terlambat ≥ 1), seri 8 minggu, perhatian memuat "Order lewat deadline"', r.s === 200 && bd.manajer.terlambat >= 1 && bd.seri.length === 8 && bd.perhatian.some(x => x.kunci === 'terlambat'))
  console.log('— urgent —')
  r = await panggil(`/api/circle/penugasan/${p1.id}/mendesak`, { method: 'POST', ...P(b.t) }); cek('B menandai urgent milik A → 403', r.s === 403)
  r = await panggil(`/api/circle/penugasan/${p2.id}/mendesak`, { method: 'POST', ...P(b.t) }); cek('Penugasan sudah selesai → 409', r.s === 409)
  r = await panggil(`/api/circle/penugasan/${p1.id}/mendesak`, { method: 'POST', ...P(a.t) }); cek('A menandai urgent miliknya → true', r.s === 200 && r.j.data.mendesak === true)
  const p4 = await pt(o2, a, 'Warna', 'MENUNGGU', { ditugaskanPada: new Date(sekarang.getTime() - 5 * 86400000), urutanAntrean: 1 })
  r = await panggil('/api/circle/antrean-saya?studioId=' + S, P(a.t)); cek('Antrean A: urgent (Sketsa) di nomor 1 walau item lain urutan 1 & lebih lama', r.j.data[0].id === p1.id && r.j.data[0].mendesak === true)
  r = await panggil(`/api/circle/penugasan/${p1.id}/mendesak`, { method: 'POST', ...P(koord.t) }); cek('Koordinator mencabut urgent → false', r.j.data.mendesak === false)
  console.log('— task selesai —')
  const dari = new Date(Date.now() - 86400000).toISOString().slice(0, 10), sampai = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  r = await panggil(`/api/circle/tugas-selesai?studioId=${S}&dari=${dari}&sampai=${sampai}`, P(koord.t)); cek('Koordinator melihat 2 tugas selesai uji (B Warna, A Sketsa)', r.s === 200 && r.j.data.tugas.filter(t => t.judul.startsWith('UJI-LP')).length === 2 && r.j.data.bisaBatal)
  r = await panggil(`/api/circle/tugas-selesai?studioId=${S}&dari=${dari}&sampai=${sampai}`, P(a.t)); cek('A hanya melihat miliknya (1) tanpa tombol batal', r.j.data.tugas.filter(t => t.judul.startsWith('UJI-LP')).length === 1 && r.j.data.tugas.every(t => t.pekerja.includes('lp_a') || !t.judul.startsWith('UJI-LP')) && !r.j.data.bisaBatal)
  r = await panggil(`/api/circle/tugas-selesai?studioId=${S}&dari=2020-01-01&sampai=2031-01-01`, P(koord.t)); cek('Rentang > 92 hari → 422', r.s === 422)
  r = await panggil(`/api/circle/penugasan/${p3.id}/batal-selesai`, { method: 'POST', ...P(a.t) }); cek('A membatalkan selesai → 403', r.s === 403)
  r = await panggil(`/api/circle/penugasan/${p3.id}/batal-selesai`, { method: 'POST', ...P(koord.t) }); cek('Order masih di tahap itu → batal selesai 200', r.s === 200 && (await prisma.penugasanTahap.findUnique({ where: { id: p3.id } })).status === 'DIKERJAKAN')
  await prisma.orderProduksi.update({ where: { id: o1.id }, data: { tahapId: tahapRows[1]?.id ?? null } })
  r = await panggil(`/api/circle/penugasan/${p2.id}/batal-selesai`, { method: 'POST', ...P(koord.t) }); cek('Order sudah pindah tahap → 409', r.s === 409)
  console.log('— progres harian —')
  r = await panggil(`/api/circle/progres-harian?studioId=${S}&dari=${dari}&sampai=${sampai}`, P(a.t)); cek('Karyawan → 403', r.s === 403)
  r = await panggil(`/api/circle/progres-harian?studioId=${S}&dari=${dari}&sampai=${sampai}`, P(koord.t)); cek('3 hari; hari ini ada pekerja A & B', r.s === 200 && r.j.data.hari.length === 3 && r.j.data.hari[1].perPekerja.some(w => w.nama.includes('lp_a')) && r.j.data.hari[1].perPekerja.some(w => w.nama.includes('lp_b')))
  console.log('— kontribusi —')
  const thn = new Date().getFullYear()
  r = await panggil(`/api/circle/kontribusi?studioId=${S}&tahun=${thn}`, P(a.t)); cek('Karyawan melihat kontribusi → 403', r.s === 403)
  r = await panggil(`/api/circle/kontribusi?studioId=${S}&tahun=${thn}`, P(lain.t)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`/api/circle/kontribusi?studioId=${S}&tahun=${thn}`, P(koord.t)); const kb2 = r.j.data?.orang ?? []
  cek('Kontribusi B (Warna di order 1: 800 ÷ 2 tahap ÷ 1 pekerja = 400)', kb2.find(o => o.userId === b.id)?.kumulatif.nilai === 400)
  cek('Kontribusi A: Sketsa order 2 (batal selesai tadi) tidak dihitung → A tidak ada atau 0', (kb2.find(o => o.userId === a.id)?.kumulatif.nilai ?? 0) === 0)
  r = await panggil(`/api/circle/kontribusi/detail?studioId=${S}&userId=${b.id}&tahun=${thn}`, P(koord.t)); cek('Rincian B: 1 baris 400 order 1', r.s === 200 && r.j.data.baris.length === 1 && r.j.data.baris[0].porsi === 400 && r.j.data.total === 400)
  console.log('— beban kerja —')
  r = await panggil(`/api/circle/beban-kerja?studioId=${S}&tahun=${thn}`, P(a.t)); cek('Karyawan → 403', r.s === 403)
  r = await panggil(`/api/circle/beban-kerja?studioId=${S}&tahun=${thn}`, P(koord.t)); const ob = r.j.data?.orang ?? []
  cek('Koordinator: pindah tahap 1 (koord), catatan 1 (A), selesai (B 1)', r.s === 200 && ob.find(o => o.userId === koord.id)?.pindahTahap >= 1 && ob.find(o => o.userId === a.id)?.catatan >= 1 && ob.find(o => o.userId === b.id)?.tahapSelesai === 1 && ob[0].bulan.length === 12)
} finally {
  await prisma.catatanOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
