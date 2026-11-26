import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.41.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const R = await import(DASH + '/server/src/utils/refleksi.js')
console.log('— logika murni —')
cek('Senin dari Rabu/Minggu/Senin', R.seninDari('2031-07-09') === '2031-07-07' && R.seninDari('2031-07-13') === '2031-07-07' && R.seninDari('2031-07-07') === '2031-07-07')
cek('Bisa diubah sampai Minggu, tidak setelahnya', R.masihBisaDiubah('2031-07-07', '2031-07-13') && !R.masihBisaDiubah('2031-07-07', '2031-07-14'))
cek('Validasi: kategori, tingkat, hambatan', R.validasi({ kategori: 'x', tingkat: 3, hambatan: 'a' }) && R.validasi({ kategori: R.KATEGORI[0], tingkat: 6, hambatan: 'a' }) && R.validasi({ kategori: R.KATEGORI[0], tingkat: 3, hambatan: ' ' }) && R.validasi({ kategori: R.KATEGORI[0], tingkat: 3, hambatan: 'ok' }) === null)
cek('Rekap kategori urut jumlah', R.rekapKategori([{ kategori: 'A', tingkat: 2 }, { kategori: 'B', tingkat: 5 }, { kategori: 'B', tingkat: 3 }])[0].kategori === 'B')

const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, A = '/api/circle/refleksi'
const P = (t, extra = {}) => ({ token: t, web: 'bloom', ...extra })
try {
  const koord = await user('rf_koord', [['KOORDINATOR', S]]), a = await user('rf_a', [['KARYAWAN', S]]), b = await user('rf_b', [['KARYAWAN', S]]), lain = await user('rf_lain', [['KOORDINATOR', pibi.id]])
  const isi = { kategori: 'Beban kerja', tingkat: 4, hambatan: 'Order menumpuk', komitmen: 'Atur ulang prioritas' }
  console.log('— API —')
  let r = await panggil(`${A}/saya`, { token: a.tNaya, web: 'bloom' }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil(`${A}`, { method: 'POST', ...P(a.t), body: { ...isi, tingkat: 9 } }); cek('Tingkat 9 → 422', r.s === 422)
  r = await panggil(`${A}`, { method: 'POST', ...P(a.t), body: isi }); cek('A mengisi refleksi → 201', r.s === 201); const id = r.j.data?.id
  r = await panggil(`${A}`, { method: 'POST', ...P(a.t), body: isi }); cek('Isi dua kali → 409', r.s === 409)
  r = await panggil(`${A}/saya`, P(a.t)); cek('Milik sendiri terbaca, perlu dukungan (tingkat 4)', r.j.data.mingguIni?.perluDukungan === true && r.j.data.mingguIni.bisaDiubah)
  r = await panggil(`${A}/${id}`, { method: 'PATCH', ...P(a.t), body: { ...isi, tingkat: 2 } }); cek('Ubah tingkat → 200', r.s === 200)
  r = await panggil(`${A}/saya`, P(a.t)); cek('Perlu dukungan hilang saat tingkat 2', r.j.data.mingguIni.perluDukungan === false)
  r = await panggil(`${A}/${id}`, { method: 'PATCH', ...P(b.t), body: isi }); cek('B mengubah milik A → 404', r.s === 404)
  await panggil(`${A}/${id}`, { method: 'PATCH', ...P(a.t), body: isi })
  r = await panggil(`${A}/tim?studioId=${S}`, P(a.t)); cek('Anggota biasa membuka tim → 403', r.s === 403)
  r = await panggil(`${A}/tim?studioId=${S}`, P(lain.t)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(`${A}/tim?studioId=${S}`, P(koord.t)); cek('Koordinator: A sudah, B belum, A perlu dukungan & berada di urutan teratas', r.s === 200 && r.j.data.orang[0].userId === a.id && r.j.data.orang.find(o => o.userId === b.id).sudahMingguIni === false && r.j.data.kategoriTerbanyak[0].kategori === 'Beban kerja')
  r = await panggil(`${A}/orang/${a.id}`, P(koord.t)); cek('Koordinator membaca riwayat A', r.s === 200 && r.j.data.refleksi.length === 1)
  r = await panggil(`${A}/orang/${a.id}`, P(b.t)); cek('B membaca riwayat A → 403', r.s === 403)
  r = await panggil(`${A}/orang/${a.id}`, P(lain.t)); cek('Koordinator unit lain membaca A → 403', r.s === 403)
  r = await panggil(`${A}/${id}/komentar`, { method: 'POST', ...P(b.t), body: { isi: 'x' } }); cek('B mengomentari → 403', r.s === 403)
  r = await panggil(`${A}/${id}/komentar`, { method: 'POST', ...P(koord.t), body: { isi: '' } }); cek('Komentar kosong → 422', r.s === 422)
  r = await panggil(`${A}/${id}/komentar`, { method: 'POST', ...P(koord.t), body: { isi: 'Kita bahas Kamis ya' } }); cek('Koordinator berkomentar → 201', r.s === 201); const kid = r.j.data?.id
  r = await panggil(`${A}/saya`, P(a.t)); cek('A melihat komentar di refleksinya', r.j.data.mingguIni.komentar[0]?.isi === 'Kita bahas Kamis ya')
  r = await panggil(`${A}/komentar/${kid}`, { method: 'DELETE', ...P(a.t) }); cek('A menghapus komentar orang lain → 404', r.s === 404)
  r = await panggil(`${A}/komentar/${kid}`, { method: 'DELETE', ...P(koord.t) }); cek('Penulis menghapus komentarnya → 200', r.s === 200)
} finally {
  await prisma.refleksiMingguan.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
