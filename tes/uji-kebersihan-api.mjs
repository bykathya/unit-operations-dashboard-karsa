import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.46.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const PD = await import(DASH + '/server/src/utils/penugasanDb.js')
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, P = (t) => ({ token: t, web: 'bloom' })
const orderIds = [], biayaIds = [], mutasiIds = []
let dompet, akun
try {
  const koord = await user('cs_koord', [['KOORDINATOR', S]]), a = await user('cs_a', [['KARYAWAN', S]]), b = await user('cs_b', [['KARYAWAN', S]]), adv = await user('cs_adv', [['ADVISOR', null]])
  akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const O = async (judul, data = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-CS k', judul, nilaiKotor: 100, nilaiBersih: 100, status: 'PROSES', tahapId: tahap[0].id, ...data } }); orderIds.push(o.id); return o }
  const pt = (o, u, extra = {}) => prisma.penugasanTahap.create({ data: { orderId: o.id, tahapId: tahap[0].id, namaTahap: tahap[0].nama, jenisTahap: 'KERJA', userId: u.id, status: 'DIKERJAKAN', ...extra } })

  console.log('— tutup penugasan basi (order diubah tanpa mesin alur) —')
  const oSel = await O('UJI-CS dilegacy selesai'), oBat = await O('UJI-CS dilegacy batal'), oAman = await O('UJI-CS masih jalan')
  const pS = await pt(oSel, a), pB = await pt(oBat, a), pA = await pt(oAman, b)
  // Halaman Produksi lama sudah dihapus; skenario yang sama (status order diubah langsung di DB tanpa mesin alur) disimulasikan lalu disapu
  await prisma.orderProduksi.update({ where: { id: oSel.id }, data: { status: 'SELESAI', tanggalSelesai: new Date() } })
  await prisma.orderProduksi.update({ where: { id: oBat.id }, data: { status: 'BATAL' } })
  await PD.tutupPenugasanBasi({ studioId: S })
  let r
  const ps = await prisma.penugasanTahap.findUnique({ where: { id: pS.id } }), pb = await prisma.penugasanTahap.findUnique({ where: { id: pB.id } }), pa = await prisma.penugasanTahap.findUnique({ where: { id: pA.id } })
  cek('Order SELESAI → penugasan ikut SELESAI 100% dengan waktu selesai', ps.status === 'SELESAI' && ps.progres === 100 && !!ps.selesaiPada)
  cek('Order BATAL → penugasan DITUTUP (bukan selesai, tak ada waktu selesai)', pb.status === 'DITUTUP' && pb.selesaiPada === null)
  cek('Order lain yang masih jalan tidak tersentuh', pa.status === 'DIKERJAKAN')
  r = await panggil('/api/circle/antrean-saya?studioId=' + S, P(a.t)); cek('Antrean A tidak lagi memuat dua order itu', r.s === 200 && !r.j.data.some(x => x.judul.startsWith('UJI-CS dilegacy')))
  r = await panggil('/api/circle/beranda?studioId=' + S, P(a.t)); cek('Beranda A: task aktif 0 (tak menggantung)', r.j.data.tugasSaya.aktif === 0)
  const oSapu = await O('UJI-CS disapu cron', { status: 'SELESAI', tanggalSelesai: new Date() }), pSapu = await pt(oSapu, b)
  const hasil = await PD.tutupPenugasanBasi({ studioId: S })
  cek('Sapuan harian (cron) menutup yang lolos dari hook: order SELESAI langsung di DB', hasil.selesai >= 1 && (await prisma.penugasanTahap.findUnique({ where: { id: pSapu.id } })).status === 'SELESAI')
  const lagi = await PD.tutupPenugasanBasi({ studioId: S }); cek('Sapuan kedua idempoten (0 yang ditutup)', lagi.selesai === 0 && lagi.ditutup === 0)

  console.log('— keahlian dari riwayat —')
  await prisma.penugasanTahap.delete({ where: { id: pS.id } }) // A pernah menuntaskan 1 tahap di bagian atas (lewat penutupan otomatis); buang agar A tepat 1×
  const oK = []; for (let i = 0; i < 3; i++) oK.push(await O(`UJI-CS keahlian ${i}`, { kesulitan: i === 2 ? 'SULIT' : 'MUDAH' }))
  for (const o of oK) await pt(o, b, { status: 'SELESAI', selesaiPada: new Date() })
  await pt(oK[0], a, { status: 'SELESAI', selesaiPada: new Date() })
  await prisma.keahlianTahap.deleteMany({ where: { studioId: S, userId: { in: [a.id, b.id] } } })
  r = await panggil('/api/circle/keahlian/dari-riwayat', { method: 'POST', ...P(a.t), body: { studioId: S } }); cek('Karyawan → 403', r.s === 403)
  r = await panggil('/api/circle/keahlian/dari-riwayat', { method: 'POST', ...P(koord.t), body: { studioId: S } })
  const kb = await prisma.keahlianTahap.findMany({ where: { studioId: S, userId: { in: [a.id, b.id] } } })
  cek('B (3× selesai, ada yang SULIT) mendapat keahlian tahap itu level SULIT', r.s === 200 && kb.find(x => x.userId === b.id)?.maksKesulitan === 'SULIT')
  cek('A (hanya 1× selesai < ambang 2) tidak mendapat keahlian', !kb.some(x => x.userId === a.id))
  r = await panggil('/api/circle/keahlian/dari-riwayat', { method: 'POST', ...P(koord.t), body: { studioId: S } }); cek('Ulang: tidak menggandakan (ditambah 0)', r.j.data.ditambah === 0 && (await prisma.keahlianTahap.count({ where: { studioId: S, userId: b.id } })) === 1)
  r = await panggil('/api/circle/keahlian/dari-riwayat', { method: 'POST', ...P(koord.t), body: { studioId: S, ambang: 1 } }); cek('Ambang 1: A ikut mendapat keahlian', r.j.data.ditambah >= 1 && (await prisma.keahlianTahap.count({ where: { studioId: S, userId: a.id } })) === 1)

} finally {
  await prisma.keahlianTahap.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
