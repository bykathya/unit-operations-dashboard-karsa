import { DASH } from './_jalur.mjs'
// Uji LEMBUR SUSULAN & LEMBUR MENUNGGU (18 Nov 2026, audit alur): dulu lembur yang disetujui setelah slip bulannya Final/Dibayar (atau dicatat
// terlambat — aturan 9a membolehkan kapan saja) tidak pernah masuk slip mana pun, dan daftar "Menunggu persetujuan" hanya bulan terpilih.
// Sekarang: (1) Siapkan slip mengambil lembur DISETUJUI yang belum diklaim dari bulan sebelumnya (dihitung per bulan asal), (2) GET /lembur/menunggu
// semua bulan + tanda susulan, (3) Beranda & Penggajian memberi tahu Koordinator, (4) Admin Market/talent ditolak. Unit Keiko lokal, tahun 2031;
// aturan lembur Keiko disimpan & dipulihkan; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.46.7.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now(), TH = 2031
const hash = await bcrypt.hash('uji-ls-' + T, 4), dibuat = []
const user = async (kode, rt, thp = 0) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S, takeHomePay: thp } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const aturanLama = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
const tgl = (s) => new Date(s + 'T00:00:00.000Z'), jam = (s, h) => new Date(`${s}T${h}:00+07:00`)
const lembur = (userId, hari, menit, status = 'DISETUJUI') => prisma.lemburKehadiran.create({ data: { userId, studioId: S, status, tanggalKerja: tgl(hari), sumber: 'MANUAL', mulai: jam(hari, '18:00'), selesai: new Date(jam(hari, '18:00').getTime() + menit * 60000), menit, catatan: 'uji susulan' } })
const slip = (userId, bulan) => prisma.penggajian.findUnique({ where: { userId_studioId_bulan_tahun: { userId, studioId: S, bulan, tahun: TH } } })
try {
  await prisma.pengaturanLembur.upsert({ where: { studioId: S }, update: { mode: 'PER_JAM', tarifPerJam: 60000, minimalMenit: 0, pembulatanMenit: 0, batasJamBulanan: null, pengaliLibur: 1, perluPersetujuan: true }, create: { studioId: S, mode: 'PER_JAM', tarifPerJam: 60000 } })
  const koord = await user('ls_koord', 'KOORDINATOR'), adm = await user('ls_adm', 'KARYAWAN'), tal = await user('ls_tal', 'KARYAWAN', 3000000)
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const siapkan = (bulan) => K('/api/circle/gaji/siapkan', { method: 'POST', body: { studioId: S, bulan, tahun: TH } })

  // Maret: 1 jam disetujui → slip Maret Rp60.000 → Final
  await lembur(tal.id, `${TH}-03-10`, 60)
  let r = await siapkan(3); let s3 = await slip(tal.id, 3)
  cek('Slip Maret berisi lembur Maret (1 jam × 60rb)', r.s === 200 && s3?.lembur === 60000, `${r.s} ${s3?.lembur}`)
  r = await K(`/api/circle/gaji/${s3.id}/final`, { method: 'POST' }); cek('Slip Maret difinalkan', r.s === 200, String(r.s))

  // Sesudah Final: lembur Maret lain dicatat terlambat (menunggu) + satu disetujui terlambat
  const telat = await lembur(tal.id, `${TH}-03-20`, 30, 'MENUNGGU')
  const telat2 = await lembur(tal.id, `${TH}-03-25`, 120)
  r = await K(`/api/circle/lembur/menunggu?studioId=${S}`)
  const m = (r.j.data?.baris ?? []).find(x => x.id === telat.id)
  cek('Lembur menunggu bulan LALU muncul di daftar semua bulan, bertanda susulan (slip Maret sudah Final)', r.s === 200 && !!m && m.slipTertutup === true && m.bulan === `${TH}-03`, JSON.stringify(m ?? r.j).slice(0, 160))
  r = await panggil(`/api/circle/lembur/menunggu?studioId=${S}`, { token: adm.t }); cek('Admin Market tidak membuka lembur menunggu (aturan 8a/9a) → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/lembur/menunggu?studioId=${S}`, { token: tal.t }); cek('Talent → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/beranda?studioId=${S}`)
  cek('Beranda Koordinator: "Lembur menunggu persetujuan" → Tugas saya', r.s === 200 && (r.j.data?.perhatian ?? []).some(p => p.kunci === 'lembur' && p.jumlah >= 1 && p.tab === 'tugas') && r.j.data?.manajer?.lemburMenunggu >= 1, JSON.stringify(r.j.data?.perhatian ?? r.j).slice(0, 200))
  r = await K(`/api/circle/gaji?studioId=${S}&bulan=4&tahun=${TH}`)
  cek('Penggajian April: peringatan lembur menunggu & susulan', r.j.data?.peringatan?.lemburMenunggu >= 1 && r.j.data?.peringatan?.lemburSusulan >= 1, JSON.stringify(r.j.data?.peringatan ?? {}).slice(0, 160))
  r = await K(`/api/circle/lembur/${telat.id}/setujui`, { method: 'POST', body: { studioId: S } }); cek('Koordinator menyetujui lembur bulan lalu', r.s === 200, String(r.s))

  // April: 1 jam April + susulan Maret (30 mnt + 120 mnt) → 60rb + 150rb
  await lembur(tal.id, `${TH}-04-05`, 60)
  r = await siapkan(4); let s4 = await slip(tal.id, 4)
  cek('Slip April = lembur April + SUSULAN Maret (60rb + 150rb)', r.s === 200 && s4?.lembur === 210000, `${s4?.lembur}`)
  const klaim = await prisma.lemburKehadiran.findMany({ where: { id: { in: [telat.id, telat2.id] } }, select: { penggajianId: true } })
  cek('Lembur susulan tertaut ke slip April (tidak bisa diklaim dua kali)', klaim.every(k => k.penggajianId === s4.id))
  s3 = await slip(tal.id, 3); cek('Slip Maret yang sudah Final tidak berubah', s3.lembur === 60000 && s3.status === 'FINAL', `${s3.lembur}`)
  r = await siapkan(4); s4 = await slip(tal.id, 4); cek('Siapkan slip April diulang → tidak dobel', s4.lembur === 210000, `${s4.lembur}`)
  r = await K(`/api/circle/gaji/${s4.id}/slip`); cek('Slip cetak menyebut "susulan Maret 2031"', r.s === 200 && (r.j.data?.lemburSusulan ?? []).some(x => x.includes('Maret')), JSON.stringify(r.j.data?.lemburSusulan))

  // Batas jam bulanan dihitung PER BULAN ASAL: batas 2 jam/bulan; Mei sudah 2 jam terbayar → susulan Mei 1 jam = Rp0, bukan menambah
  await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { batasJamBulanan: 2 } })
  await lembur(tal.id, `${TH}-05-03`, 120); await siapkan(5); const s5 = await slip(tal.id, 5)
  await K(`/api/circle/gaji/${s5.id}/final`, { method: 'POST' })
  await lembur(tal.id, `${TH}-05-28`, 60) // disetujui setelah Mei final, tapi Mei sudah penuh batas
  await siapkan(6); const s6 = await slip(tal.id, 6)
  cek('Batas jam bulanan tetap per bulan asal (susulan Mei di atas batas → Rp0)', s5.lembur === 120000 && (s6?.lembur ?? 0) === 0, `${s5.lembur} / ${s6?.lembur}`)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  const sl = await prisma.penggajian.findMany({ where: { studioId: S, tahun: TH }, select: { id: true } }), ids = sl.map(x => x.id)
  await prisma.lemburKehadiran.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.tunjanganPenggajian.deleteMany({ where: { penggajianId: { in: ids } } }); await prisma.penggajian.deleteMany({ where: { id: { in: ids } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  if (aturanLama) { const { studioId, updatedAt, ...isi } = aturanLama; await prisma.pengaturanLembur.update({ where: { studioId: S }, data: isi }) } else await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
