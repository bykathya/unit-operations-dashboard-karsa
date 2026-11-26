import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { jamKerja, nada } = await import(DASH + '/server/src/utils/jamKerja.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.31.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const W = (s) => new Date(s + '+07:00')

console.log('— jam kerja (murni) —')
cek('Senin 09–17 = 7 jam', jamKerja(W('2026-10-19T09:00'), W('2026-10-19T17:00')) === 7)
cek('Jumat 09–17 = 6 jam (istirahat 2 jam)', jamKerja(W('2026-10-23T09:00'), W('2026-10-23T17:00')) === 6)
cek('Sabtu 09–16 = 6 jam', jamKerja(W('2026-10-24T09:00'), W('2026-10-24T16:00')) === 6)
cek('Minggu = 0', jamKerja(W('2026-10-25T00:00'), W('2026-10-25T23:59')) === 0)
cek('Jumat 16:00 → Senin 10:00 = 8 jam (1+6+1)', jamKerja(W('2026-10-23T16:00'), W('2026-10-26T10:00')) === 8)
cek('Hari libur = 0', jamKerja(W('2026-10-26T09:00'), W('2026-10-26T17:00'), new Set(['2026-10-26'])) === 0)
cek('Di luar jam kerja = 0', jamKerja(W('2026-10-19T18:00'), W('2026-10-19T23:00')) === 0)
cek('Istirahat Jumat 11:30–13:30 = 0', jamKerja(W('2026-10-23T11:30'), W('2026-10-23T13:30')) === 0)
cek('Penanda warna ok/warn/bad', nada(3.4) === 'ok' && nada(3.5) === 'warn' && nada(7) === 'bad')

const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], ordersId = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, nama: u.nama, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
let libur
try {
  const koord = await user('an_koord', [['KOORDINATOR', keiko.id], ['KOORDINATOR', pibi.id]])
  const koordPibi = await user('an_koord_pibi', [['KOORDINATOR', pibi.id]])
  const artA = await user('an_artA', [['KARYAWAN', keiko.id]]), artB = await user('an_artB', [['KARYAWAN', keiko.id]])
  const adv = await user('an_adv', [['ADVISOR', null]])
  const akun = (await prisma.akunProduksi.findFirst({ where: { studioId: keiko.id } })) ?? await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const now = Date.now()
  const buat = async (judul, data, riwayat, assign) => {
    const o = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akun.id, klien: 'KLIEN-UJI-AN', judul, nilaiKotor: 1, nilaiBersih: 1, ...data, assignments: { create: assign.map(u => ({ userId: u.id })) } } })
    ordersId.push(o.id)
    for (const r of riwayat) await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, ...r } })
    return o
  }
  // O1: sedang dikerjakan artA sejak 10 hari lalu (pasti ≥ 7 jam kerja → macet); tahap Inbox ditutup; ada 1 tahap kerja yang baru ditutup
  const o1 = await buat('UJI-AN aktif', { status: 'PROSES' }, [
    { namaTahap: 'Inbox', jenis: 'MASUK', mulai: new Date(now - 12 * 86400000), selesai: new Date(now - 10 * 86400000) },
    { namaTahap: 'Sketch', jenis: 'KERJA', mulai: new Date(now - 10 * 86400000), selesai: new Date(now - 9 * 86400000) },
    { namaTahap: 'Line Art', jenis: 'KERJA', mulai: new Date(now - 9 * 86400000) },
  ], [artA])
  // O2: selesai tepat waktu; KERJA Senin 12 Okt 09–17 WIB = 7 jam
  const o2 = await buat('UJI-AN selesai', { status: 'SELESAI', tanggalMasuk: W('2026-10-10T10:00'), tanggalSelesai: W('2026-10-13T10:00'), deadline: W('2026-10-20T10:00') }, [
    { namaTahap: 'Sketch', jenis: 'KERJA', mulai: W('2026-10-12T09:00'), selesai: W('2026-10-12T17:00') },
  ], [artB])
  // O3: dua revisi (1 internal, 1 klien)
  await buat('UJI-AN revisi', { status: 'PROSES', revisiKe: 2 }, [
    { namaTahap: 'Sketch', jenis: 'KERJA', mulai: new Date(now - 9000), selesai: new Date(now - 6000) },
    { namaTahap: 'Revisi Internal', jenis: 'REVISI_INTERNAL', mulai: new Date(now - 5000), selesai: new Date(now - 4000) },
    { namaTahap: 'Revisi Klien', jenis: 'REVISI_KLIEN', mulai: new Date(now - 4000) },
  ], [artA])
  const Q = (u) => `studioId=${keiko.id}`

  console.log('— akses —')
  let r = await panggil(`/api/circle/analitik/nadi?${Q()}`, { token: artA.t }); cek('Anggota membuka papan nadi → 403', r.s === 403)
  r = await panggil(`/api/circle/analitik/kinerja?${Q()}`, { token: artA.t }); cek('Anggota membuka kinerja tim → 403', r.s === 403)
  r = await panggil(`/api/circle/analitik/nadi?${Q()}`, { token: koordPibi.t }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`/api/circle/analitik/revisi?${Q()}`, { token: koordPibi.t }); cek('Revisi: koordinator circle lain → 403', r.s === 403)

  console.log('— papan nadi —')
  r = await panggil(`/api/circle/analitik/nadi?${Q()}`, { token: koord.t })
  const a = r.j.data?.orang?.find(p => p.userId === artA.id)
  cek('Nadi memuat artA dengan tugas aktif', r.s === 200 && a && a.jumlahWip >= 1, JSON.stringify(a)?.slice(0, 120))
  cek('Tugas 10 hari tanpa selesai ditandai macet (bad)', a?.wip.some(w => w.nada === 'bad') && a.macet >= 1)
  cek('Selesai hari ini terhitung untuk artA', a?.selesaiHariIni >= 1)
  cek('Alur per fase memuat daftar order (jumlahnya = angka batang, tanpa uang) — 9 Nov 2026', r.j.data.alir.every(f => Array.isArray(f.order) && f.order.length === f.jumlah && f.order.every(o => o.orderId && o.judul && !('nilaiBersih' in o))) && r.j.data.alir.some(f => f.order.length > 0))
  cek('Alur punya 6 fase dengan Produksi ≥ 1', r.j.data.alir.length === 6 && r.j.data.alir.find(f => f.kunci === 'produksi').jumlah >= 1)
  const kunciNadi = new Set(); JSON.stringify(r.j.data, (k, v) => { kunciNadi.add(k); return v })
  cek('Tidak ada kunci uang di nadi', ![...kunciNadi].some(k => /nilai|fee|rp|omset|uang|harga/i.test(k)), [...kunciNadi].filter(k => /nilai|fee|rp|omset|uang|harga/i.test(k)).join())

  console.log('— kinerja —')
  const P = `studioId=${keiko.id}&dari=2026-10-01T00:00:00%2B07:00&sampai=2026-10-31T23:59:59%2B07:00`
  r = await panggil(`/api/circle/analitik/kinerja?${P}`, { token: koord.t })
  const b = r.j.data?.orang?.find(p => p.userId === artB.id)
  cek('Kinerja artB: 1 order selesai, 1 tahap, median produksi 7 jam', r.s === 200 && b?.selesai === 1 && b.tahapSelesai === 1 && b.medianProduksi === 7, JSON.stringify(b)?.slice(0, 160))
  cek('Tepat waktu 100% (selesai sebelum deadline)', b?.tepatWaktu === 100)
  cek('Porsi produksi 100%', b?.porsiProduksi === 100)
  r = await panggil(`/api/circle/analitik/kinerja-saya?${P}`, { token: artB.t })
  cek('Kinerja-saya: hanya baris sendiri', r.s === 200 && r.j.data.saya?.userId === artB.id && !('orang' in r.j.data))
  r = await panggil(`/api/circle/analitik/kinerja-saya?${P}`, { token: koordPibi.t }); cek('Kinerja-saya studio lain → 403', r.s === 403)

  console.log('— kalender libur memengaruhi hitungan —')
  r = await panggil('/api/circle/kalender/libur', { method: 'POST', token: koord.t, body: { tanggal: '2026-10-12', nama: 'UJI libur' } }); cek('Koordinator mengatur libur → 403', r.s === 403)
  r = await panggil('/api/circle/kalender/libur', { method: 'POST', token: adv.t, body: { tanggal: '12-10-2026', nama: 'UJI libur' } }); cek('Tanggal salah format → 422', r.s === 422)
  r = await panggil('/api/circle/kalender/libur', { method: 'POST', token: adv.t, body: { tanggal: '2026-10-12', nama: 'UJI libur' } }); cek('Super Admin menambah libur → 201', r.s === 201); libur = r.j.data?.id
  r = await panggil('/api/circle/kalender/libur', { method: 'POST', token: adv.t, body: { tanggal: '2026-10-12', nama: 'UJI libur' } }); cek('Tanggal ganda → 409', r.s === 409)
  r = await panggil('/api/circle/kalender/libur?tahun=2026', { token: artA.t }); cek('Anggota boleh MELIHAT libur, tidak boleh ubah', r.s === 200 && r.j.data.libur.some(l => l.id === libur) && r.j.data.bisaUbah === false)
  r = await panggil(`/api/circle/analitik/kinerja?${P}`, { token: koord.t })
  cek('Setelah 12 Okt libur: tahap itu = 0 jam kerja', r.j.data.orang.find(p => p.userId === artB.id)?.medianProduksi === 0)
  r = await panggil('/api/circle/kalender/libur/' + libur, { method: 'DELETE', token: adv.t }); cek('Hapus libur', r.s === 200); libur = null
  r = await panggil(`/api/circle/analitik/kinerja?${P}`, { token: koord.t }); cek('Setelah dihapus: kembali 7 jam', r.j.data.orang.find(p => p.userId === artB.id)?.medianProduksi === 7)

  console.log('— revisi & tren —')
  r = await panggil(`/api/circle/analitik/revisi?${Q()}&dari=2026-01-01`, { token: koord.t })
  const rv = r.j.data?.teratas?.find(x => x.judul === 'UJI-AN revisi')
  cek('Laporan revisi: order dengan 2 revisi (1 internal, 1 klien)', r.s === 200 && rv?.total === 2 && rv.revisiInternal === 1 && rv.revisiKlien === 1, JSON.stringify(rv))
  cek('Ringkasan revisi terisi', r.j.data.ringkasan.totalRevisi >= 2 && r.j.data.perBulan.length >= 1)
  r = await panggil(`/api/circle/analitik/tren?${Q()}&grain=minggu`, { token: koord.t })
  cek('Tren mingguan: 12 titik, masuk minggu ini ≥ 2', r.s === 200 && r.j.data.titik.length === 12 && r.j.data.titik.at(-1).masuk >= 2, JSON.stringify(r.j.data.titik.at(-1)))
  r = await panggil(`/api/circle/analitik/tren?${Q()}&grain=bulan`, { token: koord.t }); cek('Tren bulanan: 12 titik', r.s === 200 && r.j.data.titik.length === 12)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  if (libur) await prisma.hariLiburKerja.deleteMany({ where: { id: libur } })
  await prisma.hariLiburKerja.deleteMany({ where: { nama: 'UJI libur' } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: ordersId } } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-AN' } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
