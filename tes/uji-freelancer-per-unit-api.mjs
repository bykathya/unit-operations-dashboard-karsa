import { DASH } from './_jalur.mjs'
// Uji FREELANCER PER UNIT (13 Nov 2026, masukan tim): data freelancer milik unit pencatat; unit lain se-circle hanya melihat bila
// "Bagikan" dicentang (tanpa rekening & catatan, tidak bisa ubah/hapus); Order/Total fee dihitung dari order unit itu saja; nama yang sama
// di unit lain yang tidak dibagikan tidak tertaut. Data sementara dihapus di akhir.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { pastikanFreelancer } = await import(DASH + '/server/src/utils/freelancer.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.38.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const tetangga = await prisma.studio.findFirst({ where: { circleId: keiko.circleId, id: { not: keiko.id } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], orderIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, T = tetangga.id
const order = async (studioId, talentEksternalId, fee) => { const akun = await prisma.akunProduksi.findFirst({ where: { studioId }, select: { id: true } }); const o = await prisma.orderProduksi.create({ data: { studioId, akunId: akun.id, klien: 'UJI-FPU klien', judul: 'UJI-FPU', nilaiKotor: 1, nilaiBersih: 1 } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, namaEksternal: 'x', tipeEksternal: 'FREELANCER_PERORANGAN', talentEksternalId, feeTalent: fee } }); return o }
try {
  const kS = await user('fpu_s', [['KOORDINATOR', S]]), kT = await user('fpu_t', [['KOORDINATOR', T]])
  let r = await panggil('/api/circle/freelancer', { method: 'POST', token: kS.c, body: { studioId: S, nama: 'UJI-FPU Rahasia', kontak: '0811', bank: 'BCA', noRekening: '1111222233', catatan: 'jangan disebar' } })
  const rahasia = r.j.data; cek('Tambah freelancer: bawaan TIDAK dibagikan, milik unit pencatat', r.s === 201 && rahasia.bagikan === false && rahasia.milik === true)
  r = await panggil('/api/circle/freelancer', { method: 'POST', token: kS.c, body: { studioId: S, nama: 'UJI-FPU Terbuka', kontak: '0822', bank: 'BRI', noRekening: '4444555566', catatan: 'catatan internal', bagikan: true } })
  const terbuka = r.j.data; cek('Tambah freelancer dengan Bagikan', r.s === 201 && terbuka.bagikan === true)
  r = await panggil(`/api/circle/freelancer?studioId=${T}`, { token: kT.c })
  const dT = r.j.data ?? [], t2 = dT.find(x => x.id === terbuka.id)
  cek('Unit tetangga TIDAK melihat freelancer yang tidak dibagikan', r.s === 200 && !dT.some(x => x.id === rahasia.id))
  cek('Unit tetangga melihat yang dibagikan: nama & kontak, tanpa rekening/catatan, bertanda "dari unit"', t2?.kontak === '0822' && !t2.milik && t2.bank === null && t2.rekening === null && t2.catatan === null && t2.dariUnit === keiko.nama)
  r = await panggil(`/api/circle/ltk/opsi?studioId=${T}`, { token: kT.c }); const pihak = r.j.data?.pihak ?? []
  cek('Pilihan freelance di form order unit tetangga: yang dibagikan ada, yang rahasia tidak', pihak.some(x => x.nama === 'UJI-FPU Terbuka') && !pihak.some(x => x.nama === 'UJI-FPU Rahasia'))
  r = await panggil(`/api/circle/freelancer/${terbuka.id}`, { method: 'PATCH', token: kT.c, body: { studioId: T, kontak: '0' } }); cek('Unit tetangga mengubah freelancer milik unit lain → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer/${terbuka.id}?studioId=${T}`, { method: 'DELETE', token: kT.c }); cek('Unit tetangga menghapus freelancer milik unit lain → 403', r.s === 403)
  r = await panggil(`/api/circle/freelancer/${rahasia.id}`, { method: 'PATCH', token: kT.c, body: { studioId: T, bagikan: true } }); cek('Unit tetangga tidak bisa menyentuh yang rahasia → 404', r.s === 404)
  // nama sama di unit tetangga → dibuat terpisah, bukan menempel ke data rahasia unit lain
  const idT = await pastikanFreelancer(T, 'uji-fpu rahasia')
  cek('Freelance bernama sama dari order unit tetangga TIDAK tertaut ke data rahasia', idT !== rahasia.id && (await prisma.talentEksternal.findUnique({ where: { id: idT } })).studioId === T)
  cek('Freelance dari order unit sendiri memakai data yang ada', (await pastikanFreelancer(S, 'UJI-FPU Rahasia')) === rahasia.id)
  // fee per unit
  await order(S, terbuka.id, 300000); await order(T, terbuka.id, 700000)
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: kS.c }); const s1 = r.j.data?.find(x => x.id === terbuka.id)
  cek('Order & Total fee di unit pencatat = order unit itu saja', s1?.jumlahOrder === 1 && s1.totalFee === 300000, JSON.stringify({ n: s1?.jumlahOrder, fee: s1?.totalFee }))
  r = await panggil(`/api/circle/freelancer?studioId=${T}`, { token: kT.c }); const t3 = r.j.data?.find(x => x.id === terbuka.id)
  cek('Order & Total fee di unit tetangga = order unit tetangga saja', t3?.jumlahOrder === 1 && t3.totalFee === 700000)
  r = await panggil(`/api/circle/freelancer/${terbuka.id}`, { method: 'PATCH', token: kS.c, body: { studioId: S, bagikan: false } }); cek('Pencatat mematikan Bagikan', r.s === 200 && r.j.data.bagikan === false)
  r = await panggil(`/api/circle/freelancer?studioId=${T}`, { token: kT.c }); cek('Setelah tidak dibagikan, unit tetangga tetap melihat karena pernah mengerjakan ordernya', r.j.data?.some(x => x.id === terbuka.id))
  r = await panggil(`/api/circle/freelancer/${terbuka.id}?studioId=${S}`, { method: 'DELETE', token: kS.c }); cek('Pencatat tidak bisa menghapus bila dipakai order unit lain → 409', r.s === 409)
  const lama = await prisma.talentEksternal.create({ data: { nama: 'UJI-FPU Lama', lingkupKunci: `c:${keiko.circleId}` } })
  r = await panggil(`/api/circle/freelancer?studioId=${T}`, { token: kT.c }); cek('Data lama tanpa pencatat tetap terlihat se-circle', r.j.data?.some(x => x.id === lama.id && x.milik))
  r = await panggil(`/api/circle/freelancer/${lama.id}`, { method: 'PATCH', token: kT.c, body: { studioId: T, kontak: '0833' } })
  cek('Data lama diklaim unit yang pertama mengubahnya', r.s === 200 && (await prisma.talentEksternal.findUnique({ where: { id: lama.id } })).studioId === T)
  r = await panggil(`/api/circle/freelancer?studioId=${S}`, { token: kS.c }); cek('Setelah diklaim (tidak dibagikan), unit lain tidak melihatnya', !r.j.data?.some(x => x.id === lama.id))
} finally {
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.talentEksternal.deleteMany({ where: { nama: { startsWith: 'UJI-FPU', mode: 'insensitive' } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
