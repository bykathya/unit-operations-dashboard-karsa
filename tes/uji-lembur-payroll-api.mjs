import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.52.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const PY = await import(DASH + '/server/src/utils/payroll.js')
console.log('— logika murni —')
const rs = PY.ringkasLemburPresensi([{ menit: 90, tanggalKerja: '2031-05-02' }, { menit: 30, tanggalKerja: '2031-05-02' }, { menit: 60, tanggalKerja: '2031-05-09' }], 20000)
cek('Ringkasan: 180 menit, 2 hari, 3 jam, Rp 60.000 pada tarif 20.000/jam', rs.menit === 180 && rs.hari === 2 && rs.jam === 3 && rs.uang === 60000)
cek('Tanpa tarif → uang 0 (hanya acuan)', PY.ringkasLemburPresensi([{ menit: 120, tanggalKerja: '2031-05-02' }], null).uang === 0 && PY.ringkasLemburPresensi([{ menit: 120, tanggalKerja: '2031-05-02' }], 0).uang === 0)
cek('Pembulatan ke rupiah terdekat (50 menit × 15.000/jam = 12.500)', PY.ringkasLemburPresensi([{ menit: 50, tanggalKerja: '2031-05-02' }], 15000).uang === 12500)

const tahun = 2031, bulan = 5
const orderIds = []; let rc
try {
  const koord = await user('lp_koord', [['KOORDINATOR', S]]), a = await user('lp_a', [['KARYAWAN', S]]), b = await user('lp_b', [['KARYAWAN', S]]), lain = await user('lp_lain', [['KOORDINATOR', pibi.id]])
  const ymd = (d) => new Date(d + 'T00:00:00Z')
  const L = async (u, tgl, menit, sumber = 'MANUAL') => prisma.lemburKehadiran.create({ data: { userId: u.id, tanggalKerja: ymd(tgl), sumber, mulai: new Date(tgl + 'T10:00:00Z'), selesai: new Date(new Date(tgl + 'T10:00:00Z').getTime() + menit * 60000), menit, catatan: 'UJI-LP' } })
  const l1 = await L(a, '2031-05-02', 90), l2 = await L(a, '2031-05-09', 60), l3 = await L(b, '2031-05-12', 30)
  const lMeiLain = await L(a, '2031-06-03', 45)
  const P = '/api/payroll'
  console.log('— tarif & laporan —')
  let r = await panggil(`${P}/lembur-presensi?studioId=${S}&bulan=${bulan}&tahun=${tahun}`, { token: a.tApp }); cek('Karyawan melihat laporan → 403', r.s === 403)
  r = await panggil(`${P}/lembur-presensi?studioId=${S}&bulan=${bulan}&tahun=${tahun}`, { token: lain.tApp }); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${P}/lembur-presensi?studioId=${S}&bulan=${bulan}&tahun=${tahun}`, { token: koord.tApp }); const oa = r.j.data?.orang?.find(o => o.userId === a.id)
  cek('Tanpa tarif: A 150 menit (2,5 jam) acuan saja, otomatis=false, uang 0', r.s === 200 && oa?.total.menit === 150 && oa.total.jam === 2.5 && r.j.data.otomatis === false && oa.total.uang === 0)
  r = await panggil(`${P}/tarif-lembur`, { method: 'PUT', token: a.tApp, body: { studioId: S, tarifPerJam: 20000 } }); cek('Karyawan mengatur tarif → 403', r.s === 403)
  r = await panggil(`${P}/tarif-lembur`, { method: 'PUT', token: lain.tApp, body: { studioId: S, tarifPerJam: 20000 } }); cek('Koordinator unit lain mengatur tarif → 403', r.s === 403)
  // 18 Nov 2026 (keputusan user): Payroll di Management Dashboard = PEMANTAUAN. Tarif, generate, final & bayar slip pindah ke web circle › Penggajian — alur
  // lembur di slip (tanpa/dengan tarif, tidak dobel, susulan, slip Final tidak berubah) kini diuji di uji-gaji-api, uji-lembur-aturan & uji-lembur-susulan-api.
  console.log('— Payroll di Management Dashboard hanya memantau —')
  r = await panggil(`${P}/tarif-lembur`, { method: 'PUT', token: koord.tApp, body: { studioId: S, tarifPerJam: 20000 } }); cek('Atur tarif lembur di Ekosistem → 403 (dikelola di web circle)', r.s === 403, String(r.s))
  r = await panggil(`${P}/generate?studioId=${S}&bulan=${bulan}&tahun=${tahun}`, { method: 'POST', token: koord.tApp }); cek('Generate slip di Ekosistem → 403', r.s === 403 && /web circle/.test(r.j.message ?? ''), String(r.s))
  cek('Lembur presensi tetap belum diklaim slip mana pun', (await prisma.lemburKehadiran.count({ where: { id: { in: [l1.id, l2.id] }, penggajianId: null } })) === 2)
} finally {
  await prisma.lemburKehadiran.updateMany({ where: { catatan: 'UJI-LP' }, data: { penggajianId: null } })
  await prisma.lemburKehadiran.deleteMany({ where: { catatan: 'UJI-LP' } })
  await prisma.tunjanganPenggajian.deleteMany({ where: { penggajian: { userId: { in: dibuat } } } })
  // Generate membuat slip untuk SEMUA anggota unit di bulan uji (bukan hanya akun uji) — bersihkan seluruh slip bulan uji unit ini (12 Nov 2026:
  // sisa slip ini dulu tertinggal dan kini ikut terhitung di buku besar circle karena gaji dibaca dari slip)
  const slipUji = (await prisma.penggajian.findMany({ where: { OR: [{ userId: { in: dibuat } }, { studioId: S, tahun, bulan }] }, select: { id: true } })).map(x => x.id)
  await prisma.lemburKehadiran.updateMany({ where: { penggajianId: { in: slipUji } }, data: { penggajianId: null } })
  await prisma.catatanLembur.updateMany({ where: { penggajianId: { in: slipUji } }, data: { penggajianId: null } })
  await prisma.tunjanganPenggajian.deleteMany({ where: { penggajianId: { in: slipUji } } })
  await prisma.penggajian.deleteMany({ where: { id: { in: slipUji } } })
  await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
