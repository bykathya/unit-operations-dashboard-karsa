import { DASH } from './_jalur.mjs'
// Uji "lupa pulang" (11 Nov 2026, laporan Nadia: durasi 188 jam): sesi hari lampau tanpa pulang tidak dihitung sampai sekarang;
// koordinator unit melihat daftar & mengoreksi jam pulang; akses & validasi. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.45.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash('uji-lp-' + Date.now(), 4), dibuat = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const wib = (d) => new Date(Date.now() + 7 * 3600000 - d * 86400000).toISOString().slice(0, 10)
try {
  const koord = await user('lp_koord', 'KOORDINATOR'), nadia = await user('lp_nadia', 'KARYAWAN'), rekan = await user('lp_rekan', 'KARYAWAN')
  const kemarin = wib(1)
  await prisma.kehadiranEvent.create({ data: { userId: nadia.id, tanggalKerja: new Date(kemarin + 'T00:00:00Z'), jenis: 'MASUK', modeKerja: 'WFO', dicatatPada: new Date(`${kemarin}T07:42:00+07:00`) } })
  let r = await panggil('/api/circle/kehadiran/riwayat?hari=5', { token: nadia.c })
  const baris = r.j.data?.riwayat?.find?.(x => x.tanggal === kemarin) ?? (Array.isArray(r.j.data) ? r.j.data.find(x => x.tanggal === kemarin) : null) ?? Object.values(r.j.data ?? {}).flat().find?.(x => x?.tanggal === kemarin)
  cek('Riwayat: kemarin masuk tanpa pulang → "Lupa pulang", bukan ratusan jam', baris?.lupaPulang === true && baris.labelKerja === 'Lupa pulang' && baris.menitKerja === 0, JSON.stringify(baris)?.slice(0, 120))
  r = await panggil(`/api/circle/kehadiran/lupa-pulang?studioId=${S}`, { token: koord.c }); cek('Koordinator melihat daftar lupa pulang', r.s === 200 && r.j.data.daftar.some(x => x.userId === nadia.id && x.tanggal === kemarin && x.masuk === '07:42'), String(r.s))
  r = await panggil(`/api/circle/kehadiran/lupa-pulang?studioId=${S}`, { token: rekan.c }); cek('Anggota biasa membuka daftar → 403', r.s === 403)
  const body = (o) => ({ studioId: S, userId: nadia.id, tanggal: kemarin, jam: '17:00', ...o })
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: nadia.c, body: body() }); cek('Anggota mengoreksi sendiri → 403', r.s === 403)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body({ jam: '07:00' }) }); cek('Jam pulang sebelum masuk → 422', r.s === 422)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body({ jam: '25:00' }) }); cek('Format jam salah → 422', r.s === 422)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body({ tanggal: wib(0) }) }); cek('Hari ini tidak bisa dikoreksi → 422', r.s === 422)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body({ userId: rekan.id }) }); cek('Tanpa presensi masuk → 422', r.s === 422)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body() }); cek('Koreksi sah → 200', r.s === 200, r.j.message)
  r = await panggil('/api/circle/kehadiran/koreksi-pulang', { method: 'POST', token: koord.c, body: body() }); cek('Koreksi dua kali → 409', r.s === 409)
  r = await panggil('/api/circle/kehadiran/riwayat?hari=5', { token: nadia.c })
  const b2 = Object.values(r.j.data ?? {}).flat().find?.(x => x?.tanggal === kemarin) ?? (Array.isArray(r.j.data) ? r.j.data.find(x => x.tanggal === kemarin) : null)
  cek('Setelah koreksi: pulang 17:00, kerja bersih dihitung (istirahat dipotong), bukan lupa pulang', b2?.pulang === '17:00' && b2.lupaPulang === false && b2.menitKerja > 0 && b2.menitKerja < 600, JSON.stringify(b2)?.slice(0, 160))
  r = await panggil(`/api/circle/kehadiran/lupa-pulang?studioId=${S}`, { token: koord.c }); cek('Hilang dari daftar lupa pulang', !r.j.data.daftar.some(x => x.userId === nadia.id))
} finally { await prisma.kehadiranEvent.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect() }
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
