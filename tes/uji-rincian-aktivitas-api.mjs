import { DASH } from './_jalur.mjs'
// Uji RINCIAN AKTIVITAS MARKETER (22 Nov 2026, masukan tim/Keiko): Koordinator membuka isi aktivitas per marketer (judul, link, target,
// hasil) dari tabel "Aktivitas per marketer". Jumlah = angka tabel (aktivitas selesai); ?semua=1 ikut yang belum selesai; saring per jenis;
// marketer hanya miliknya; admin per akun hanya akunnya; pemilik lihat-saja boleh baca; talent & unit lain ditolak. Keiko lokal; data dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, token) => { const r = await fetch('http://localhost:3001/api/circle' + path, { headers: { 'X-Forwarded-For': `172.48.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', Authorization: `Bearer ${token}` } }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const lain = (await prisma.studio.findFirst({ where: { nama: { startsWith: 'Pibi' } } })).id
const T = Date.now(), dibuat = [], akunDibuat = []
const user = async (kode, role, studioId = S, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: 'x', statusAktif: true } }); dibuat.push(u.id); if (role) await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId, fungsi, terkonfirmasi: true } }); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('ra_koord', 'KOORDINATOR'), m1 = await user('ra_m1', 'KARYAWAN', S, 'MARKETER'), m2 = await user('ra_m2', 'KARYAWAN', S, 'MARKETER')
  const tal = await user('ra_tal', 'KARYAWAN'), adm = await user('ra_adm', 'KARYAWAN'), pem = await user('ra_pem', null), kLain = await user('ra_klain', 'KOORDINATOR', lain)
  await prisma.studioPemilik.create({ data: { studioId: S, userId: pem.id, persenSaham: 1 } })
  const akA = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-RA A ${T}`, feePersen: 0 } }), akB = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Vgen', namaAkun: `UJI-RA B ${T}`, feePersen: 0 } }); akunDibuat.push(akA.id, akB.id)
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S, akunIds: [akA.id] } })
  const tgl = new Date(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) + 'T00:00:00Z'), bln = tgl.getUTCMonth() + 1, thn = tgl.getUTCFullYear()
  await prisma.aktivitasMarketer.createMany({ data: [
    { userId: m1.id, studioId: S, tanggal: tgl, jenis: 'publish_post', akunId: akA.id, judul: 'Post karakter Dopa', platform: 'X', jamPosting: '19:30', link: 'https://x.com/uji/status/1', selesai: true },
    { userId: m1.id, studioId: S, tanggal: tgl, jenis: 'engage_reply', akunId: akB.id, targetAkun: '@calonklien', pengikut: 1200, hasil: 'dibalas', jumlah: 5, selesai: true },
    { userId: m1.id, studioId: S, tanggal: tgl, jenis: 'publish_video', akunId: akA.id, judul: 'Video WIP', link: 'javascript:alert(1)', selesai: true },
    { userId: m1.id, studioId: S, tanggal: tgl, jenis: 'publish_post', akunId: akA.id, judul: 'Belum diunggah', selesai: false },
    { userId: m2.id, studioId: S, tanggal: tgl, jenis: 'publish_post', akunId: akA.id, judul: 'Milik m2', selesai: true },
  ] })
  const q = (uid, x = '') => `/marketing/aktivitas-rincian?studioId=${S}&bulan=${bln}&tahun=${thn}&userId=${uid}${x}`
  let r = await panggil(q(m1.id), koord.t)
  const b = r.j.data?.baris ?? []
  cek('Koordinator membuka rincian marketer → 200, 3 aktivitas selesai', r.s === 200 && b.length === 3, `${r.s} ${b.length}`)
  const post = b.find(x => x.judul === 'Post karakter Dopa')
  cek('Isi lengkap: judul, platform, jam, link, akun, jenis', post?.link === 'https://x.com/uji/status/1' && post.tautan === post.link && post.platform === 'X' && post.jamPosting === '19:30' && post.akun?.includes('UJI-RA A') && post.label === 'Post' && post.tahap === 'Unggah konten')
  const rep = b.find(x => x.jenis === 'engage_reply'); cek('Interaksi: akun target, follower, hasil, jumlah', rep?.targetAkun === '@calonklien' && rep.pengikut === 1200 && rep.hasil === 'dibalas' && rep.jumlah === 5)
  cek('Link bukan http(s) tidak dijadikan tautan', b.find(x => x.judul === 'Video WIP')?.tautan === null)
  const dash = await panggil(`/marketing/dashboard?studioId=${S}&bulan=${bln}&tahun=${thn}`, koord.t)
  const baris = dash.j.data?.perMarketer?.find(x => x.userId === m1.id)
  cek('Jumlah rincian = angka tabel Aktivitas per marketer', baris && baris.effort === b.reduce((s, x) => s + x.jumlah, 0) && baris.publish === b.filter(x => x.tahap === 'Unggah konten').reduce((s, x) => s + x.jumlah, 0), `${baris?.effort}`)
  r = await panggil(q(m1.id, '&tahap=engage'), koord.t); cek('Saring per jenis (Interaksi) → 1 baris', r.j.data?.baris.length === 1 && r.j.data.baris[0].jenis === 'engage_reply')
  r = await panggil(q(m1.id, '&semua=1'), koord.t); cek('?semua=1 ikut yang belum selesai', r.j.data?.baris.length === 4 && r.j.data.baris.some(x => !x.selesai))
  r = await panggil(q(m2.id), m1.t); cek('Marketer: userId orang lain diabaikan → hanya miliknya', r.s === 200 && r.j.data.baris.length === 3 && !r.j.data.baris.some(x => x.judul === 'Milik m2'))
  r = await panggil(q(m1.id), adm.t); cek('Admin per akun: hanya akun yang ia pegang', r.s === 200 && r.j.data.dibatasiAkun && r.j.data.baris.length === 2 && r.j.data.baris.every(x => x.akun?.includes('UJI-RA A')), `${r.s} ${r.j.data?.baris?.length}`)
  r = await panggil(q(m1.id), pem.t); cek('Pemilik unit (lihat saja) boleh membaca', r.s === 200 && r.j.data.baris.length === 3, String(r.s))
  r = await panggil(q(m1.id), tal.t); cek('Talent → 403', r.s === 403)
  r = await panggil(q(m1.id), kLain.t); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(q(tal.id), koord.t); cek('userId bukan marketer unit → 404', r.s === 404)
  r = await panggil(q(m1.id), koord.t); cek('Tanpa nilai uang & tanpa log suasana hati', !JSON.stringify(r.j.data).match(/nilai|mood|harga/i))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.aktivitasMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.studioPemilik.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunDibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
