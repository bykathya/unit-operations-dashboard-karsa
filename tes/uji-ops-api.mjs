import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.45.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const PG = await import(DASH + '/server/src/utils/pengingat.js')
console.log('— pesan pengingat (murni) —')
const rc = PG.pesanRencana('Mira Lestari', [{ judul: 'Logo', tahap: 'Sketsa', sisa: 1, mendesak: true }, { judul: 'Banner', tahap: 'Warna', sisa: null }])
cek('Rencana: sapa nama depan, 🔥 untuk mendesak, H-1, tanpa deadline tidak ada label', rc.includes('Mira') && !rc.includes('Lestari') && rc.includes('1. 🔥 Logo — Sketsa (H-1)') && rc.includes('2. Banner — Warna') && !rc.includes('Banner — Warna ('))
cek('Rencana kosong → null; >8 tugas dipotong', PG.pesanRencana('A', []) === null && PG.pesanRencana('A', Array(10).fill({ judul: 'x', tahap: 't', sisa: 2 })).includes('dan 2 tugas lagi'))
cek('Delivery: dikelompokkan per H', PG.pesanDelivery('Keiko', [{ judul: 'A', sisa: 2 }, { judul: 'B', sisa: 1 }]).includes('H-1: B\nH-2: A'))
cek('Biaya: total dan keterangan telat / hari ini', (() => { const t = PG.pesanBiaya('K', [{ kategori: 'Gaji', jumlah: 1000000, jatuhTempo: '2031-07-05' }, { kategori: 'Iklan', deskripsi: 'FB', jumlah: 500000, jatuhTempo: '2031-07-10' }], '2031-07-10'); return t.includes('Rp 1.500.000') && t.includes('telat sejak 5 Jul') && t.includes('jatuh tempo hari ini') })())
cek('Presensi menyebut nama & jam (pengingat setoran 11/24 sudah dihapus 10 Nov)', typeof PG.pesanSetoran === 'undefined' && PG.pesanPresensi('Dewi Ayu', '09.00').includes('Dewi') && PG.pesanPresensi('Dewi Ayu', '09.00').includes('09.00'))

const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tNaya: jwt.sign({ id: u.id, aud: 'circle', cs: 'naya' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, P = (t) => ({ token: t, web: 'bloom' })
const orderIds = []
let akun
try {
  const koord = await user('op_koord', [['KOORDINATOR', S]]), mk = await user('op_mk', [['KARYAWAN', S]]), kar = await user('op_kar', [['KARYAWAN', S]]), kepala = await user('op_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]]), lain = await user('op_lain', [['KOORDINATOR', pibi.id]])
  await prisma.fungsiAnggota.create({ data: { userId: mk.id, studioId: S, fungsi: 'MARKETER' } })
  akun = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const O = async (judul, data) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-OP k', judul, nilaiKotor: 1000, nilaiBersih: 800, status: 'PROSES', tahapId: tahap[0].id, ...data } }); orderIds.push(o.id); return o }
  const o1 = await O('UJI-OP milik marketer', { marketerId: mk.id, statusBayar: 'DP', dpAmount: 300 })
  const o2 = await O('UJI-OP lain', {})
  const o3 = await O('UJI-OP lunas', { statusBayar: 'LUNAS' })
  console.log('— pembayaran —')
  let r = await panggil('/api/circle/pembayaran?studioId=' + S, P(kar.t)); cek('Karyawan biasa → 403', r.s === 403)
  r = await panggil('/api/circle/pembayaran?studioId=' + S, P(lain.t)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil('/api/circle/pembayaran?semua=1&studioId=' + S, P(koord.t)); const b = r.j.data?.baris ?? []
  cek('Koordinator: o1 (sisa 500 setelah DP 300) dan o2 (800) tampil, yang lunas tidak', r.s === 200 && b.find(x => x.judul === 'UJI-OP milik marketer')?.sisa === 500 && b.find(x => x.judul === 'UJI-OP lain')?.sisa === 800 && !b.some(x => x.judul === 'UJI-OP lunas') && r.j.data.bisaLihatSemua)
  r = await panggil('/api/circle/pembayaran?semua=1&studioId=' + S, P(mk.t)); const bm = r.j.data?.baris ?? []
  cek('Marketer hanya melihat ordernya sendiri', r.s === 200 && bm.length === 1 && bm[0].judul === 'UJI-OP milik marketer' && !r.j.data.bisaLihatSemua)
  console.log('— tautan & selesaikan semua —')
  r = await panggil(`/api/circle/orders/${o2.id}/tautan`, { method: 'PUT', ...P(kar.t), body: { tautan: ['https://drive.google.com/x'] } }); cek('Karyawan tak terlibat mengubah tautan → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${o2.id}/tautan`, { method: 'PUT', ...P(koord.t), body: { tautan: ['javascript:alert(1)'] } }); cek('Tautan non-http → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o2.id}/tautan`, { method: 'PUT', ...P(koord.t), body: { tautan: Array(11).fill('https://a.id') } }); cek('11 tautan → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o2.id}/tautan`, { method: 'PUT', ...P(koord.t), body: { tautan: ['https://drive.google.com/x', 'https://figma.com/y'] } }); cek('Koordinator menyimpan 2 tautan → 200', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: o2.id } })).tautan.length === 2)
  await prisma.penugasanTahap.createMany({ data: [{ orderId: o2.id, tahapId: tahap[0].id, namaTahap: 'A', jenisTahap: 'KERJA', userId: kar.id, status: 'MENUNGGU' }, { orderId: o2.id, tahapId: tahap[0].id, namaTahap: 'B', jenisTahap: 'KERJA', userId: mk.id, status: 'DIKERJAKAN' }, { orderId: o2.id, tahapId: tahap[0].id, namaTahap: 'C', jenisTahap: 'KERJA', userId: mk.id, status: 'SELESAI', selesaiPada: new Date() }] })
  r = await panggil(`/api/circle/orders/${o2.id}/selesaikan-semua`, { method: 'POST', ...P(kar.t) }); cek('Karyawan menyelesaikan semua → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${o2.id}/selesaikan-semua`, { method: 'POST', ...P(koord.t) }); cek('Koordinator: 2 penugasan aktif ditandai selesai', r.s === 200 && r.j.data.jumlah === 2)
  r = await panggil(`/api/circle/orders/${o2.id}/selesaikan-semua`, { method: 'POST', ...P(koord.t) }); cek('Ulang tanpa penugasan aktif → 409', r.s === 409)
  r = await panggil(`/api/circle/orders/${o2.id}/profil`, { method: 'PATCH', ...P(koord.t), body: { kategori: 'visual' } }); const pr = r.s
  console.log('— pipeline —')
  r = await panggil('/api/circle/pipeline?studioId=' + S, P(mk.t)); cek('Marketer → 403 (ada uang)', r.s === 403)
  r = await panggil('/api/circle/pipeline?studioId=' + S, P(koord.t)); cek('Koordinator: total ≥ 2 order aktif, tahap pertama memuat', r.s === 200 && r.j.data.total.jumlah >= 2 && r.j.data.tahap.some(t => t.jumlah >= 2))
  console.log('— riwayat login —')
  await prisma.logLogin.createMany({ data: [{ userId: kar.id, web: 'bloom', ip: '1.2.3.4', perangkat: 'UJI-OP' }, { userId: kar.id, web: 'bloom', ip: '1.2.3.5', perangkat: 'UJI-OP' }, { userId: mk.id, web: 'app', perangkat: 'UJI-OP' }] })
  r = await panggil('/api/circle/riwayat-login', P(koord.t)); cek('Koordinator → 403 (Kepala Circle ke atas)', r.s === 403)
  r = await panggil('/api/circle/riwayat-login', { token: kepala.tNaya, web: 'bloom' }); cek('Token circle lain → 403', r.s === 403)
  r = await panggil('/api/circle/riwayat-login', P(kepala.t)); const rl = r.j.data
  cek('Kepala Circle: kar 2 login, mk 1, urut terbanyak; baris memuat IP', r.s === 200 && rl.orang.find(o => o.userId === kar.id)?.jumlah === 2 && rl.orang.find(o => o.userId === mk.id)?.jumlah === 1 && rl.baris.some(x => x.ip === '1.2.3.4'))
  r = await panggil('/api/circle/riwayat-login?userId=' + kar.id, P(kepala.t)); cek('Filter per user: hanya baris kar', r.j.data.baris.every(x => x.userId === kar.id) && r.j.data.baris.length === 2)
  r = await panggil('/api/circle/riwayat-login?userId=bukan-anggota', P(kepala.t)); cek('User di luar lingkup → daftar kosong', r.s === 200 && r.j.data.baris.length === 0)
  console.log('— pengingat (pratinjau) —')
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S, P(kar.t)); cek('Karyawan → 403', r.s === 403)
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S, P(koord.t)); cek('Daftar jenis pengingat; status aktif = mengikuti OTOMASI_AKTIF', r.s === 200 && Object.keys(r.j.data.jenis).length === 5 && !('setoran' in r.j.data.jenis) && typeof r.j.data.aktif === 'boolean')
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S + '&jenis=ngawur', P(koord.t)); cek('Jenis ngawur → 422', r.s === 422)
  await prisma.penugasanTahap.create({ data: { orderId: o1.id, tahapId: tahap[0].id, namaTahap: 'Sketsa', jenisTahap: 'KERJA', userId: kar.id, status: 'MENUNGGU', mendesak: true } })
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S + '&jenis=rencana', P(koord.t)); const pk = (r.j.data?.penerima ?? []).find(x => x.userId === kar.id)
  cek('Rencana harian untuk kar memuat tugas mendesak', r.s === 200 && pk?.teks.includes('🔥') && pk.teks.includes('UJI-OP milik marketer'))
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S + '&jenis=laporanMarketer', P(koord.t)); cek('Laporan marketer: pesan untuk pengelola memuat nama marketer uji', r.s === 200 && r.j.data.penerima.some(x => x.teks.includes('Uji op_mk')))
  r = await panggil('/api/circle/pengingat/pratinjau?studioId=' + S + '&jenis=presensi', P(koord.t)); cek('Presensi: tidak error (hasil bergantung hari/jam kerja)', r.s === 200 && Array.isArray(r.j.data.penerima))
} finally {
  await prisma.logLogin.deleteMany({ where: { perangkat: 'UJI-OP' } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
