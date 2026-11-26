import { DASH } from './_jalur.mjs'
// Uji LOKASI KANTOR UNIT → WFO/WFA otomatis (20 Nov 2026, keputusan user): Koordinator menyimpan titik kantor + radius; presensi datang di dalam
// radius = WFO (walau memilih WFA), di luar = wajib WFA, lokasi tidak terbaca / sangat kasar = pilihan sendiri bertanda; titik anggota tidak
// disimpan; Admin Market & talent tidak mengatur; Kehadiran tim menampilkan tanda. Unit Keiko lokal; lokasi kantor Keiko dipulihkan.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { jarakMeter, cekLokasiMasuk } = await import(DASH + '/server/src/utils/lokasiKantor.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
// Presensi tidak bisa dicatat di hari libur (Minggu / libur nasional) → cek yang butuh presensi DILEWATI hari itu, bukan gagal
const { jenisHari, hariIniWIB } = await import(DASH + '/server/src/utils/kehadiran.js')
const hariIniUji = hariIniWIB(), liburUji = await (async () => { const p0 = (await import(DASH + '/server/src/prisma.js')).default; const b = await p0.hariLiburKerja.findMany({ where: { tanggal: new Date(hariIniUji + 'T00:00:00.000Z') } }); return ['LIBUR', 'LIBUR_MINGGU'].includes(jenisHari(hariIniUji, new Map(b.map(x => [hariIniUji, x.jenis])))) })()
const cekP = (l, ok, i = '') => (liburUji ? console.log(`⏭ ${l} — dilewati: hari ini libur (${hariIniUji}), presensi tidak bisa dicatat`) : cek(l, ok, i))
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.3.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-lk-' + T, 4), dibuat = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const kantorLama = await prisma.lokasiKantorUnit.findUnique({ where: { studioId: S } })
const KANTOR = { lat: -7.005145, lng: 110.438125 }
const geser = (m) => ({ lat: KANTOR.lat + m / 111320, lng: KANTOR.lng }) // m meter ke utara
try {
  // helper murni
  cek('Jarak 1 derajat lintang ≈ 111 km', Math.abs(jarakMeter({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111195) < 200)
  cek('Tanpa lokasi kantor → tidak dicek', cekLokasiMasuk(null, geser(10)).cekLokasi === null)
  const k0 = { ...KANTOR, radius: 200 }
  cek('Akurasi sangat kasar di luar radius → tidak terbaca (tidak dipaksa WFA)', cekLokasiMasuk(k0, { ...geser(3000), akurasi: 5000 }).cekLokasi === 'TIDAK_TERBACA')

  const koord = await user('lk_koord', 'KOORDINATOR'), adm = await user('lk_adm', 'KARYAWAN'), tal = await user('lk_tal', 'KARYAWAN')
  const t1 = await user('lk_t1', 'KARYAWAN'), t2 = await user('lk_t2', 'KARYAWAN'), t3 = await user('lk_t3', 'KARYAWAN'), t4 = await user('lk_t4', 'KARYAWAN')
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  await prisma.lokasiKantorUnit.deleteMany({ where: { studioId: S } })

  // tanpa lokasi kantor: presensi seperti biasa
  let r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: t4.t, body: { jenis: 'MASUK', modeKerja: 'WFO', studioId: S, lokasi: geser(5000) } })
  let e = await prisma.kehadiranEvent.findFirst({ where: { userId: t4.id, jenis: 'MASUK' } })
  cekP('Unit tanpa lokasi kantor → presensi biasa, tanpa tanda', r.s === 201 && e?.modeKerja === 'WFO' && e.cekLokasi === null, `${r.s} ${r.j.message ?? ''}`)

  r = await panggil(`/api/circle/kehadiran/lokasi-kantor`, { method: 'PUT', token: adm.t, body: { studioId: S, ...KANTOR } }); cek('Admin Market mengatur lokasi kantor → 403 (data SDM, aturan 8a)', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/kehadiran/lokasi-kantor?studioId=${S}`, { token: tal.t }); cek('Talent melihat lokasi kantor → 403', r.s === 403, String(r.s))
  r = await K('/api/circle/kehadiran/lokasi-kantor', { method: 'PUT', body: { studioId: S, lat: 95, lng: 110 } }); cek('Titik tidak valid → 422', r.s === 422, String(r.s))
  r = await K('/api/circle/kehadiran/lokasi-kantor', { method: 'PUT', body: { studioId: S, ...KANTOR, radius: 10 } }); cek('Radius < 50 m → 422', r.s === 422, String(r.s))
  r = await K('/api/circle/kehadiran/lokasi-kantor', { method: 'PUT', body: { studioId: S, ...KANTOR, radius: 200, label: 'Studio uji' } })
  cek('Koordinator menyimpan lokasi kantor', r.s === 200 && r.j.data?.kantor?.radius === 200, `${r.s} ${r.j.message}`)
  r = await panggil(`/api/circle/kehadiran/hari-ini?studioId=${S}`, { token: tal.t })
  cek('Layar presensi anggota: tahu unit memakai lokasi kantor, tanpa koordinat kantor', r.j.data?.kantor?.radius === 200 && r.j.data.kantor.lat === undefined, JSON.stringify(r.j.data?.kantor))

  // di kantor (±50 m) walau memilih WFA → WFO
  r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: t1.t, body: { jenis: 'MASUK', modeKerja: 'WFA', lokasiWfa: 'RUMAH_KOS', studioId: S, lokasi: { ...geser(50), akurasi: 20 } } })
  e = await prisma.kehadiranEvent.findFirst({ where: { userId: t1.id, jenis: 'MASUK' } })
  cekP('Di dalam radius → WFO otomatis, cocok, jarak dibulatkan 10 m', r.s === 201 && e?.modeKerja === 'WFO' && !e.lokasiWfa && e.cekLokasi === 'COCOK' && e.jarakMeter === 50, JSON.stringify({ s: r.s, m: e?.modeKerja, c: e?.cekLokasi, j: e?.jarakMeter }))
  // jauh (2 km) memilih WFO → ditolak; memilih WFA → DI_LUAR
  r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: t2.t, body: { jenis: 'MASUK', modeKerja: 'WFO', studioId: S, lokasi: { ...geser(2000), akurasi: 15 } } })
  cekP('Di luar radius memilih WFO → 422 (diminta pilih tempat WFA)', r.s === 422 && /WFA/.test(r.j.message ?? ''), `${r.s} ${r.j.message}`)
  r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: t2.t, body: { jenis: 'MASUK', modeKerja: 'WFA', lokasiWfa: 'CAFE', studioId: S, lokasi: { ...geser(2000), akurasi: 15 } } })
  e = await prisma.kehadiranEvent.findFirst({ where: { userId: t2.id, jenis: 'MASUK' } })
  cekP('…memilih WFA → tercatat WFA di luar kantor (±2 km)', r.s === 201 && e?.modeKerja === 'WFA' && e.lokasiWfa === 'CAFE' && e.cekLokasi === 'DI_LUAR' && Math.abs(e.jarakMeter - 2000) <= 10, JSON.stringify({ s: r.s, c: e?.cekLokasi, j: e?.jarakMeter }))
  // lokasi tidak dikirim (izin ditolak / PC) → pilihan sendiri, bertanda
  r = await panggil('/api/circle/kehadiran/catat', { method: 'POST', token: t3.t, body: { jenis: 'MASUK', modeKerja: 'WFO', studioId: S } })
  e = await prisma.kehadiranEvent.findFirst({ where: { userId: t3.id, jenis: 'MASUK' } })
  cekP('Lokasi tidak terbaca → tetap bisa presensi sesuai pilihan, ditandai', r.s === 201 && e?.modeKerja === 'WFO' && e.cekLokasi === 'TIDAK_TERBACA' && e.jarakMeter === null, JSON.stringify({ s: r.s, c: e?.cekLokasi }))

  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  r = await K(`/api/circle/kehadiran/roster?studioId=${S}&tanggal=${hariIni}`)
  const rr = (r.j.data?.hadir ?? []), ro = (id) => rr.find(x => x.userId === id)
  cekP('Kehadiran tim: tanda di kantor / di luar kantor / tidak terbaca', ro(t1.id)?.cekLokasi === 'COCOK' && ro(t2.id)?.labelCek === 'di luar kantor' && ro(t3.id)?.cekLokasi === 'TIDAK_TERBACA' && ro(t4.id)?.cekLokasi == null, JSON.stringify(rr.filter(x => [t1.id, t2.id, t3.id, t4.id].includes(x.userId)).map(x => [x.cekLokasi, x.jarakMeter])))

  r = await K(`/api/circle/kehadiran/lokasi-kantor?studioId=${S}`, { method: 'DELETE' })
  cek('Hapus lokasi kantor → kembali pilih sendiri', r.s === 200 && !(await prisma.lokasiKantorUnit.findUnique({ where: { studioId: S } })), String(r.s))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.lokasiKantorUnit.deleteMany({ where: { studioId: S } })
  if (kantorLama) { const { updatedAt, ...isi } = kantorLama; await prisma.lokasiKantorUnit.create({ data: isi }) }
  await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
