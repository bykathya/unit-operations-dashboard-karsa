import { DASH } from './_jalur.mjs'
// Uji TUNDA ANTREAN (12 Nov 2026, masukan tim): pengelola memindah kartu ke tahap kerja dengan antrean:false → tugas talent dibuat DITUNDA
// (tidak di Antreanku, tetap di Tugas saya dengan tanda ditunda); bisa dimasukkan lagi di Penugasan; talent tidak bisa mengubahnya.
// Tanpa antrean:false perilaku lama (langsung masuk antrean). Memakai Keiko lokal. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.46.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-tunda-' + T, 4)
const dibuat = [], orderIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('td_koord', [['KOORDINATOR', S]]), tal = await user('td_tal', [['KARYAWAN', S]])
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o }), A = (p, o = {}) => panggil(p, { token: tal.t, ...o })
  const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
  const tahap = await pastikanTahap(S), inbox = tahap.find(t => t.jenis === 'MASUK'), kerja = tahap.find(t => t.jenis === 'KERJA')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const ord = async (judul) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-TD klien', judul: `${judul} ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId: inbox.id, status: 'MASUK', tanggalMasuk: new Date() } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } }); return o }
  const oT = await ord('UJI-TD tunda'), oL = await ord('UJI-TD langsung')

  // Folder proyek (12 Nov 2026, masukan tim): tautan[0] terkirim sebagai `folder` di Antreanku & Tugas saya
  await prisma.orderProduksi.update({ where: { id: oL.id }, data: { tautan: ['https://drive.google.com/drive/folders/uji', 'https://lain'] } })
  let r = await K(`/api/circle/papan?studioId=${S}`); const kartu = r.j.data?.orders.find(o => o.id === oT.id)
  cek('Papan: aksi membawa tujuan (ke) & tanda talent internal', !!kartu?.adaTalentInternal && kartu.aksi.some(a => a.aksi === 'lanjut' && a.ke === kerja.id), JSON.stringify(kartu?.aksi))
  r = await K(`/api/circle/orders/${oT.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut', antrean: false } }); cek('Koordinator memindah ke Pengerjaan dengan antrean:false → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${oL.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } }); cek('Order lain dipindah biasa → 200', r.s === 200)
  const bT = await prisma.penugasanTahap.findFirst({ where: { orderId: oT.id, userId: tal.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } }), bL = await prisma.penugasanTahap.findFirst({ where: { orderId: oL.id, userId: tal.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })
  cek('Tugas talent order pertama dibuat DITUNDA; order kedua tidak', bT?.tunda === true && bL?.tunda === false, `${bT?.tunda} / ${bL?.tunda}`)
  r = await A(`/api/circle/antrean-saya?studioId=${S}`); cek('Antreanku talent: hanya order yang tidak ditunda', r.s === 200 && r.j.data.some(x => x.orderId === oL.id) && !r.j.data.some(x => x.orderId === oT.id))
  cek('Antreanku: folder proyek = tautan pertama', r.j.data.find(x => x.orderId === oL.id)?.folder === 'https://drive.google.com/drive/folders/uji')
  r = await A(`/api/circle/tugas-saya?studioId=${S}`); const ts = r.j.data?.tugas.find(x => x.id === oT.id)
  cek('Tugas saya: folder terkirim (null bila belum ada)', r.j.data?.tugas.find(x => x.id === oL.id)?.folder === 'https://drive.google.com/drive/folders/uji' && ts?.folder === null)
  cek('Tugas saya: order ditunda tetap ada (ditunda: true) & bisa dikerjakan', !!ts && ts.ditunda === true && ts.aksi.length > 0, JSON.stringify(ts?.aksi))
  r = await K(`/api/circle/antrean?studioId=${S}`); const baris = r.j.data?.orang.find(o => o.userId === tal.id)?.antrean ?? []
  cek('Penugasan (admin): baris ditunda terlihat dengan tanda tunda', baris.some(b => b.orderId === oT.id && b.tunda === true) && baris.some(b => b.orderId === oL.id && !b.tunda))
  r = await A(`/api/circle/penugasan/${bT.id}/tunda`, { method: 'POST', body: { tunda: false } }); cek('Talent mengubah tunda → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/penugasan/${bT.id}/tunda`, { method: 'POST', body: { tunda: false } }); cek('Koordinator "Masukkan antrean" → 200', r.s === 200, r.j.message)
  r = await A(`/api/circle/antrean-saya?studioId=${S}`); cek('Setelah dimasukkan: muncul di Antreanku talent', r.j.data.some(x => x.orderId === oT.id))
  r = await K(`/api/circle/penugasan/${bL.id}/tunda`, { method: 'POST', body: { tunda: true } }); cek('Koordinator menunda tugas yang sudah di antrean → 200', r.s === 200)
  r = await A(`/api/circle/antrean-saya?studioId=${S}`); cek('Tugas yang ditunda hilang dari Antreanku', !r.j.data.some(x => x.orderId === oL.id))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
