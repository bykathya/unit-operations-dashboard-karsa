import { DASH } from './_jalur.mjs'
// Uji tandai biaya rutin dibayar (12 Nov 2026, masukan tim): baris rutin (Bio & item tetap) dicentang → tanggal & rekening bayar dipakai,
// memotong saldo rekening itu ("Saldo hari ini"); batal mengembalikan; gaji dari slip DIBAYAR otomatis dibayar; validasi & akses. Data dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { nolkanBio } = await import('./_isolasi-bio.mjs')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.52.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = []
const user = async (kode, rt) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType: rt, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const HARI = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), BLN = HARI.slice(0, 7), B = '/api/circle/buku'
const pulihkan = await nolkanBio(prisma, [S])
let bio, item, rek, slip
try {
  const koord = await user('br_koord', 'KOORDINATOR'), kar = await user('br_kar', 'KARYAWAN')
  bio = await prisma.studioPengeluaranRutin.create({ data: { studioId: S, kategori: 'SUBSCRIPTION', nama: 'UJI-BR Langganan', jumlah: 100000 } })
  const kat = await prisma.kategoriLedger.findFirst({ where: { nama: 'Biaya Rumah Tangga' } })
  item = await prisma.itemTetap.create({ data: { kategoriId: kat.id, studioId: S, nama: 'UJI-BR Sewa', jumlahBawaan: 200000 } })
  rek = await prisma.studioRekening.create({ data: { studioId: S, namaBank: 'UJI-BR Bank', nomorRekening: '1234567890', atasNama: 'UJI', saldo: 0 } })
  const ringkas = async () => (await panggil(`${B}/ringkasan?studioId=${S}&bulan=${BLN}`, { token: koord.t })).j.data?.rekening?.daftar?.find(x => x.id === rek.id)
  let r = await panggil(`${B}/rincian?studioId=${S}&bulan=${BLN}`, { token: koord.t })
  const bb = r.j.data.baris.find(b => b.sumber === 'BIO' && b.sumberId === bio.id), bi = r.j.data.baris.find(b => b.sumber === 'ITEM_TETAP' && b.sumberId === item.id)
  cek('Sebelum ditandai: baris rutin "belum dibayar", tgl 26, tanpa rekening', bb?.dibayar === false && bi?.dibayar === false && bb.tanggal === `${BLN}-26` && !bb.rekeningId)
  const body = (x = {}) => ({ studioId: S, bulan: BLN, tanggal: HARI, rekeningId: rek.id, baris: [{ sumber: 'BIO', sumberId: bio.id }, { sumber: 'ITEM_TETAP', sumberId: item.id }], ...x })
  r = await panggil(`${B}/bayar-rutin`, { method: 'POST', token: kar.t, body: body() }); cek('Talent menandai → 403', r.s === 403)
  r = await panggil(`${B}/bayar-rutin`, { method: 'POST', token: koord.t, body: body({ tanggal: '2020-01-01' }) }); cek('Tanggal di luar bulan → 422', r.s === 422)
  r = await panggil(`${B}/bayar-rutin`, { method: 'POST', token: koord.t, body: body({ baris: [{ sumber: 'BIO', sumberId: 'bukan-id' }] }) }); cek('Baris yang bukan biaya rutin bulan ini → 422', r.s === 422)
  r = await panggil(`${B}/bayar-rutin`, { method: 'POST', token: koord.t, body: body() }); cek('Tandai 2 baris dibayar hari ini dari rekening uji → 200', r.s === 200, r.j.message)
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${BLN}`, { token: koord.t })
  const b2 = r.j.data.baris.find(b => b.sumberId === bio.id), i2 = r.j.data.baris.find(b => b.sumberId === item.id)
  cek('Baris memakai tanggal bayar & rekening, status dibayar', b2?.dibayar && b2.tanggal === HARI && b2.rekeningId === rek.id && i2?.dibayar && i2.rekeningId === rek.id)
  let k = await ringkas(); cek('Saldo hari ini rekening terpotong 300.000', k?.kini === -300000 && k.keluar === 300000, JSON.stringify(k && { kini: k.kini, keluar: k.keluar }))
  r = await panggil(`${B}/bayar-rutin/batal`, { method: 'POST', token: koord.t, body: { studioId: S, bulan: BLN, sumber: 'BIO', sumberId: bio.id } }); cek('Batalkan satu → 200', r.s === 200)
  k = await ringkas(); cek('Setelah batal: hanya item tetap yang memotong (200.000)', k?.kini === -200000, String(k?.kini))
  await prisma.userRole.updateMany({ where: { userId: koord.id, studioId: S }, data: { takeHomePay: 3000000 } })
  slip = await prisma.penggajian.create({ data: { userId: koord.id, studioId: S, bulan: Number(BLN.slice(5)), tahun: Number(BLN.slice(0, 4)), gajiPokok: 3000000, thp: 3000000, status: 'DIBAYAR', tanggalBayar: new Date(HARI + 'T00:00:00Z') } })
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${BLN}`, { token: koord.t }); const g = r.j.data.baris.find(b => b.sumberId === `gaji:${koord.id}`)
  cek('Gaji dari slip DIBAYAR otomatis dianggap dibayar (tanggal gajian), tidak bisa dibatalkan di sini', g?.dibayar === true && g.tanggal === HARI && g.bisaBatal === false)
} finally {
  await prisma.bayarRutin.deleteMany({ where: { studioId: S, bulan: BLN, sumberId: { in: [bio?.id, item?.id].filter(Boolean) } } })
  if (slip) await prisma.penggajian.delete({ where: { id: slip.id } })
  if (bio) await prisma.studioPengeluaranRutin.delete({ where: { id: bio.id } }); if (item) await prisma.itemTetap.delete({ where: { id: item.id } }); if (rek) await prisma.studioRekening.delete({ where: { id: rek.id } })
  await pulihkan()
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
