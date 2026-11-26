import { DASH } from './_jalur.mjs'
// Uji Susunan tim (12 Nov 2026, masukan tim): Pendamping/Penasihat ditandai `pendamping` (tidak perlu fungsi kerja) & dihitung di chip
// PENDAMPING; peran kerja tetap memakai fungsi. + (12 Nov malam, keputusan user) Koordinator = posisi "Koordinator" otomatis (Susunan tim
// & Profil SDM-nya sendiri), anggota lain tetap ditetapkan manual. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const rt of roles) await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('st_koord', ['KOORDINATOR']), pend = await user('st_pend', ['PENDAMPING']), pen = await user('st_pen', ['PENASIHAT']), dua = await user('st_dua', ['PENDAMPING', 'KARYAWAN'])
  const r = await fetch(`http://localhost:3001/api/circle/manpower?studioId=${S}`, { headers: { 'X-Unit-Web': 'bloom', 'X-Forwarded-For': '172.53.1.1', Authorization: `Bearer ${koord.c}` } }); const j = await r.json()
  const o = (id) => j.data?.orang.find(x => x.userId === id)
  cek('Pendamping & Penasihat ditandai tidak perlu fungsi', r.status === 200 && o(pend.id)?.pendamping === true && o(pen.id)?.pendamping === true, String(r.status))
  cek('Koordinator & orang yang juga Karyawan tetap peran kerja', o(koord.id)?.pendamping === false && o(dua.id)?.pendamping === false)
  cek('Chip ringkasan memuat PENDAMPING', (j.data?.perFungsi?.PENDAMPING ?? 0) >= 2)
  cek('Koordinator: posisi sekarang otomatis "Koordinator" (terkunci)', o(koord.id)?.posisiSekarang === 'Koordinator' && o(koord.id)?.posisiOtomatis === true)
  cek('Anggota lain: posisi tidak otomatis', !o(dua.id)?.posisiOtomatis && !o(pend.id)?.posisiOtomatis)
  // Mulai di sini → Konfirmasi Tim menghitung PERAN KERJA saja (pendamping/penasihat tidak) — sama dengan layar Tim (laporan Najuwa 12 Nov)
  const m = await (await fetch(`http://localhost:3001/api/circle/mulai?studioId=${S}`, { headers: { 'X-Unit-Web': 'bloom', 'X-Forwarded-For': '172.53.1.3', Authorization: `Bearer ${koord.c}` } })).json()
  const kerja = new Set((await prisma.userRole.findMany({ where: { studioId: S, user: { statusAktif: true }, roleType: { in: ['KOORDINATOR', 'KADER', 'KARYAWAN', 'MAGANG'] } }, select: { userId: true } })).map(x => x.userId)).size
  const tim = m.data?.wajib?.find(l => l.kunci === 'tim')
  cek('Mulai di sini: Konfirmasi Tim "x dari N" dengan N = anggota peran kerja (tanpa pendamping/penasihat)', !!tim && tim.rinci.includes(`dari ${kerja} anggota kerja`), tim?.rinci)
  const p = await (await fetch('http://localhost:3001/api/circle/profil-sdm', { headers: { 'X-Unit-Web': 'bloom', 'X-Forwarded-For': '172.53.1.2', Authorization: `Bearer ${koord.c}` } })).json()
  cek('Profil SDM koordinator sendiri: posisi "Koordinator" otomatis', p.data?.posisiSekarang === 'Koordinator' && p.data?.posisiOtomatis === true, JSON.stringify(p.data))
} finally {
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
