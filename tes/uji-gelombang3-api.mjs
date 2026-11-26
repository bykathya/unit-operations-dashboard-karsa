import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.50.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const LP = await import(DASH + '/server/src/utils/laporanOgs.js')
const LR = await import(DASH + '/server/src/utils/labaRugi.js')
const W = (s) => new Date(s + '+07:00')
console.log('— logika murni —')
const rk = LP.rekapKerjaBulan([
  { id: 1, judul: 'A', klien: 'k', namaTahap: 'T', status: 'SELESAI', ditugaskanPada: W('2026-03-03T09:00'), mulaiPada: W('2026-03-03T09:00'), selesaiPada: W('2026-03-03T17:00') },
  { id: 2, judul: 'B', klien: 'k', namaTahap: 'T', status: 'SELESAI', ditugaskanPada: W('2026-02-27T09:00'), mulaiPada: null, selesaiPada: W('2026-03-02T17:00') },
  { id: 3, judul: 'C', klien: 'k', namaTahap: 'T', status: 'SELESAI', ditugaskanPada: W('2026-02-10T09:00'), mulaiPada: null, selesaiPada: W('2026-02-12T17:00') },
], W('2026-03-01T00:00'), W('2026-04-01T00:00'), W('2026-04-05T00:00'))
cek('Rekap kerja: kartu A (Sel 09–17) = 7 jam bersih; B dari Jumat sebelumnya hanya dihitung mulai 1 Mar (Minggu libur → Senin 2 Mar 7 jam); C di luar bulan tak dihitung', rk.rows.length === 2 && rk.rows.find(r => r.judul === 'A').jam === 7 && rk.rows.find(r => r.judul === 'B').jam === 7 && rk.total.jam === 14 && rk.total.selesai === 2)
const rcn = LR.rencanaKas({ kasAwal: 1000, masuk: 500, tetap: 400, variabel: 200, bulanMulai: '2031-01', n: 3 })
cek('Rencana kas dasar: hasil −100/bulan → kas 900, 800, 700; pesimis lebih buruk; optimis lebih baik', rcn.dasar.bulan.map(b => b.kasAkhir).join() === '900,800,700' && rcn.pesimis.kasAkhir < rcn.dasar.kasAkhir && rcn.optimis.kasAkhir > rcn.dasar.kasAkhir)
cek('Pesimis: kas habis terdeteksi (tetap tidak ikut turun)', LR.rencanaKas({ kasAwal: 200, masuk: 500, tetap: 400, variabel: 200, bulanMulai: '2031-01', n: 4 }).pesimis.bulanKasHabis != null)

const user2 = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const orderIds = [], penggajianIds = []
try {
  const koord = await user2('g3_koord', [['KOORDINATOR', S]]), a = await user2('g3_a', [['KARYAWAN', S]]), b = await user2('g3_b', [['KARYAWAN', S]]), kepala = await user2('g3_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]]), adv = await user2('g3_adv', [['ADVISOR', null]]), lain = await user2('g3_lain', [['KOORDINATOR', pibi.id]])
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const o1 = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-G3 k', judul: 'UJI-G3 order', nilaiKotor: 1000000, nilaiBersih: 800000, status: 'PROSES', tahapId: tahap[0].id, statusBayar: 'BELUM_LUNAS' } }); orderIds.push(o1.id)
  await prisma.penugasanTahap.create({ data: { orderId: o1.id, tahapId: tahap[0].id, namaTahap: tahap[0].nama, jenisTahap: 'KERJA', userId: a.id, status: 'SELESAI', ditugaskanPada: W('2026-03-03T09:00'), mulaiPada: W('2026-03-03T09:00'), selesaiPada: W('2026-03-03T17:00') } })
  await prisma.penugasanTahap.create({ data: { orderId: o1.id, tahapId: tahap[0].id, namaTahap: tahap[0].nama, jenisTahap: 'KERJA', userId: b.id, status: 'DIKERJAKAN' } })

  console.log('— peta alur & rekap kerja —')
  let r = await panggil('/api/circle/peta-alur?studioId=' + S, { token: a.t }); cek('Karyawan melihat peta alur → 403', r.s === 403)
  r = await panggil('/api/circle/peta-alur?studioId=' + S, { token: koord.t }); const kol = r.j.data?.kolom ?? []
  cek('Peta alur: tahap pertama memuat B memegang kartu "UJI-G3 order"', r.s === 200 && kol.some(k => k.orang.some(o => o.nama.includes('g3_b') && o.kartu.some(c => c.judul === 'UJI-G3 order'))))
  r = await panggil(`/api/circle/rekap-kerja?studioId=${S}&bulan=2026-03`, { token: a.t }); cek('Rekap kerja milik sendiri (A): 1 kartu, 7 jam (Selasa 09–17 − istirahat)', r.s === 200 && r.j.data.total.kartu === 1 && r.j.data.total.jam === 7, JSON.stringify(r.j.data?.total))
  r = await panggil(`/api/circle/rekap-kerja?studioId=${S}&bulan=2026-03&userId=${a.id}`, { token: b.t }); cek('B melihat rekap A → 403', r.s === 403)
  r = await panggil(`/api/circle/rekap-kerja?studioId=${S}&bulan=2026-03&userId=${a.id}`, { token: koord.t }); cek('Koordinator melihat rekap A', r.s === 200 && r.j.data.rows[0].judul === 'UJI-G3 order')
  console.log('— slip saya —')
  const pg = async (user, status, thp) => { const x = await prisma.penggajian.create({ data: { userId: user.id, studioId: S, bulan: 9, tahun: 2031, gajiPokok: thp, thp, status } }); penggajianIds.push(x.id); return x }
  await pg(a, 'FINAL', 3000000); await prisma.penggajian.create({ data: { userId: a.id, studioId: S, bulan: 10, tahun: 2031, gajiPokok: 1, thp: 1, status: 'DRAFT' } }).then(x => penggajianIds.push(x.id)); await pg(b, 'DIBAYAR', 5000000)
  r = await panggil('/api/circle/slip-saya?tahun=2031', { token: a.t }); cek('A melihat slip FINAL miliknya (THP 3.000.000), DRAFT tidak tampil, slip B tidak bocor', r.s === 200 && r.j.data.slip.length === 1 && r.j.data.slip[0].thp === 3000000 && !JSON.stringify(r.j.data).includes('5000000'))
  r = await panggil('/api/circle/slip-saya?tahun=2031', { token: a.tNaya }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil('/api/circle/slip-saya?tahun=2031', { token: lain.t }); cek('Orang lain/koordinator unit lain tak melihat apa pun milik A', r.s === 200 && r.j.data.slip.length === 0)
  console.log('— dashboard manajemen —')
  r = await panggil('/api/circle/manajemen', { token: koord.t }); cek('Koordinator → 403 (Kepala Circle ke atas)', r.s === 403)
  r = await panggil('/api/circle/manajemen?bulan=13', { token: kepala.t }); cek('Bulan 13 → 422', r.s === 422)
  r = await panggil('/api/circle/manajemen', { token: kepala.t }); cek('Kepala Circle: papan memuat unit; order uji yang masih dikerjakan (sisa 800.000) TIDAK di daftar piutang tetapi terhitung "masih dikerjakan" (satu arti piutang, 14 Nov 2026)', r.s === 200 && r.j.data.papan.some(p => p.studioId === S) && !r.j.data.piutang.baris.some(x => x.judul === 'UJI-G3 order') && r.j.data.piutang.masihDikerjakan.total >= 800000)
  r = await panggil('/api/circle/buku/rentang?dari=2026-01&sampai=2026-03', { token: kepala.t }); cek('P&L rentang: semua unit lingkup + total', r.s === 200 && r.j.data.unit.length >= 1 && r.j.data.jumlahBulan === 3 && 'hasil' in r.j.data.total)
  r = await panggil('/api/circle/buku/rentang?dari=2026-05&sampai=2026-01', { token: kepala.t }); cek('Rentang terbalik → 422', r.s === 422)
  r = await panggil('/api/circle/buku/rentang?dari=2026-01&sampai=2026-03', { token: koord.t }); cek('Koordinator → 403', r.s === 403)
  console.log('— rencana keuangan —')
  r = await panggil(`/api/circle/buku/rencana?studioId=${S}&masuk=1000000&variabel=200000&tetap=500000&n=4`, { token: koord.t }); const rc = r.j.data
  cek('Rencana dengan asumsi manual: dasar +300.000/bulan, 4 bulan, 3 skenario', r.s === 200 && rc.skenario.dasar.bulan.length === 4 && rc.skenario.dasar.bulan[0].hasil === 300000 && Object.keys(rc.skenario).length === 3 && rc.sumberAsumsi.masuk === 'diisi manual')
  r = await panggil(`/api/circle/buku/rencana?studioId=${S}&masuk=abc`, { token: koord.t }); cek('Asumsi bukan angka → 422', r.s === 422)
  r = await panggil(`/api/circle/buku/rencana?studioId=${S}`, { token: a.t }); cek('Karyawan → 403', r.s === 403)
  console.log('— profil SDM & manpower —')
  r = await panggil('/api/circle/profil-sdm', { method: 'PUT', token: a.t, body: { posisiBerikut: 'Senior Artist', catatan: 'ingin belajar rigging' } }); cek('A mengisi aspirasi sendiri → 200', r.s === 200)
  r = await panggil('/api/circle/profil-sdm', { method: 'PUT', token: a.t, body: { posisiSekarang: 'Lead' } }); cek('A menetapkan posisi sekarangnya sendiri → 403', r.s === 403)
  r = await panggil('/api/circle/profil-sdm', { method: 'PUT', token: koord.t, body: { userId: a.id, posisiSekarang: 'Artist' } }); cek('Koordinator menetapkan posisi sekarang A → 200', r.s === 200)
  r = await panggil('/api/circle/profil-sdm', { method: 'PUT', token: koord.t, body: { userId: a.id, posisiBerikut: 'x' } }); cek('Koordinator mengisi aspirasi A → 403', r.s === 403)
  r = await panggil('/api/circle/profil-sdm?userId=' + a.id, { token: b.t }); cek('B membuka profil A → 403', r.s === 403)
  r = await panggil('/api/circle/profil-sdm?userId=' + a.id, { token: koord.t }); cek('Koordinator membaca profil A lengkap', r.s === 200 && r.j.data.posisiSekarang === 'Artist' && r.j.data.posisiBerikut === 'Senior Artist')
  r = await panggil('/api/circle/manpower?studioId=' + S, { token: a.t }); cek('Karyawan membuka manpower → 403', r.s === 403)
  r = await panggil('/api/circle/manpower?studioId=' + S, { token: koord.t }); cek('Manpower memuat A dengan posisi', r.s === 200 && r.j.data.orang.find(o => o.userId === a.id)?.posisiSekarang === 'Artist')
  console.log('— impersonasi —')
  r = await panggil('/api/circle/impersonasi/kandidat', { token: koord.t }); cek('Non Super Admin → 403', r.s === 403)
  r = await panggil('/api/circle/impersonasi/kandidat?q=g3_a', { token: adv.t }); cek('Super Admin melihat kandidat', r.s === 200 && r.j.data.some(u => u.userId === a.id))
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: adv.t, body: { userId: a.id } }); cek('Tanpa alasan → 422', r.s === 422)
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: adv.t, body: { userId: adv.id, alasan: 'x' } }); cek('Meniru diri sendiri → 422', r.s === 422)
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: adv.t, body: { userId: lain.id, alasan: 'uji' } }); cek('Target tidak berperan di alamat ini → 403', r.s === 403)
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: koord.t, body: { userId: a.id, alasan: 'uji' } }); cek('Koordinator mencoba meniru → 403', r.s === 403)
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: adv.t, body: { userId: a.id, alasan: 'membantu A melihat tugasnya' } }); cek('Super Admin meniru A → token', r.s === 200 && !!r.j.data.accessToken); const imp = r.j.data?.accessToken
  r = await panggil('/api/circle/saya', { token: imp }); cek('Dengan token tiruan, /saya = A (bukan admin)', r.s === 200 && r.j.data.user.id === a.id)
  r = await panggil('/api/circle/impersonasi', { method: 'POST', token: imp, body: { userId: b.id, alasan: 'berantai' } }); cek('Dalam mode menyamar tak bisa meniru lagi → 403', r.s === 403)
  r = await panggil('/api/circle/impersonasi/log', { token: adv.t }); cek('Log mencatat sesi: admin → A + alasan', r.s === 200 && r.j.data.some(l => l.target.includes('g3_a') && l.admin.includes('g3_adv') && l.alasan.includes('membantu')))
  console.log('— realtime (SSE) —')
  const buka = async (token, web) => { const ac = new AbortController(); const rs = await fetch('http://localhost:3001/api/circle/stream', { headers: { Authorization: `Bearer ${token}`, 'X-Unit-Web': web, 'X-Forwarded-For': `172.50.9.${++xff % 250}` }, signal: ac.signal }); const rd = rs.body.getReader(); const dec = new TextDecoder(); const o = { buf: '' }; (async () => { try { for (;;) { const x = await rd.read(); if (x.done) break; o.buf += dec.decode(x.value) } } catch { /* abort */ } })(); return { status: rs.status, ac, ctype: rs.headers.get('content-type'), baca: async (ms) => { const t = Date.now(); while (Date.now() - t < ms && !o.buf.includes('perubahan')) await new Promise(r => setTimeout(r, 100)); return o.buf } } }
  const tanpa = await fetch('http://localhost:3001/api/circle/stream'); cek('Tanpa token → 401', tanpa.status === 401)
  const aliran = await fetch('http://localhost:3001/api/circle/stream', { headers: { Authorization: 'Bearer ' + jwt.sign({ id: koord.id }, process.env.JWT_SECRET, { expiresIn: '5m' }) } }); cek('Token Ekosistem (bukan circle) → 403', aliran.status === 403)
  const sA = await buka(b.t, 'bloom'), sN = await buka(b.tNaya, 'naya')
  cek('Aliran terbuka: text/event-stream', sA.status === 200 && sA.ctype.includes('text/event-stream'))
  await sA.baca(600)
  const baru = await panggil('/api/circle/orders', { method: 'POST', token: koord.t, body: { studioId: S, judul: 'UJI-G3 realtime', klien: 'UJI-G3 k', nilaiDisepakati: 1, akunId: 'INTERNAL' } }); if (baru.j.data?.id) orderIds.push(baru.j.data.id)
  const terima = await sA.baca(3000)
  cek('Klien lain di alamat yang sama menerima event "perubahan" bagian "orders" (tanpa data order)', /event: perubahan/.test(terima) && /"bagian":"orders"/.test(terima) && !terima.includes('UJI-G3 realtime'))
  const naya = await sN.baca(800)
  cek('Klien di alamat circle LAIN tidak menerima apa pun', !/perubahan/.test(naya))
  sA.ac.abort(); sN.ac.abort()
} finally {
  await prisma.logImpersonasi.deleteMany({ where: { OR: [{ adminId: { in: dibuat } }, { targetId: { in: dibuat } }] } })
  await prisma.profilSdm.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.penggajian.deleteMany({ where: { OR: [{ id: { in: penggajianIds } }, { userId: { in: dibuat } }] } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
