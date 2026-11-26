import { DASH } from './_jalur.mjs'
// Uji HAPUS BIAYA RUTIN (12 Nov 2026, masukan Sinta): Koordinator unit menghapus (menonaktifkan) item biaya rutin miliknya; talent ditolak;
// item "semua unit" hanya Super Admin; bulan yang sudah DITUTUP tidak berubah (snapshot). Memakai bulan jauh (2031-10/11). Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.44.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, B1 = '2031-10', B2 = '2031-11', T = Date.now()
const hash = await bcrypt.hash('uji-br-' + T, 4)
const dibuat = [], itemIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('br_koord', [['KOORDINATOR', S]]), kar = await user('br_kar', [['KARYAWAN', S]])
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const kat = await prisma.kategoriLedger.findFirst({ where: { nama: 'Biaya Rumah Tangga' } }) // Gaji/SHU diambil dari Bio sejak 12 Nov 2026 (ditolak bila Bio berisi)
  let r = await K('/api/circle/buku/item-tetap', { method: 'POST', body: { studioId: S, kategoriId: kat.id, nama: `UJI-BR Dignity ${T}`, jumlahBawaan: 500000 } }); const id = r.j.data?.id; if (id) itemIds.push(id)
  cek('Koordinator menambah biaya rutin → 201', r.s === 201, String(r.s))
  const glob = await prisma.itemTetap.create({ data: { kategoriId: kat.id, studioId: null, nama: `UJI-BR global ${T}`, jumlahBawaan: 1, aktif: true } }); itemIds.push(glob.id)
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B1}`); const tetapAwal = r.j.data?.tetap
  r = await K('/api/circle/buku/tutup', { method: 'POST', body: { studioId: S, bulan: B1 } }); cek('Tutup bulan pertama (item ikut terhitung) → 200', r.s === 200)
  r = await panggil(`/api/circle/buku/item-tetap/${id}`, { method: 'PATCH', token: kar.t, body: { aktif: false } }); cek('Talent menghapus → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/buku/item-tetap/${glob.id}`, { method: 'PATCH', body: { aktif: false } }); cek('Koordinator menghapus item "semua unit" → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/buku/item-tetap/${id}`, { method: 'PATCH', body: { aktif: false } }); cek('Koordinator menghapus biaya rutin unitnya → 200', r.s === 200, String(r.s))
  r = await K(`/api/circle/buku/item-tetap?studioId=${S}&bulan=${B2}`); cek('Bulan berjalan berikutnya: item tidak muncul lagi', r.s === 200 && !r.j.data.item.some(i => i.id === id))
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B1}`); cek('Bulan yang sudah ditutup tidak berubah (biaya tetap sama)', r.j.data?.tetap === tetapAwal && r.j.data?.status === 'DITUTUP', `${r.j.data?.tetap} vs ${tetapAwal}`)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.entriLedger.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.itemTetapBulan.deleteMany({ where: { itemId: { in: itemIds } } })
  await prisma.itemTetap.deleteMany({ where: { id: { in: itemIds } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
