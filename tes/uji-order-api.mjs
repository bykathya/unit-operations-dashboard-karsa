import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.33.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const D = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
let akunUji
try {
  const koord = await user('od_koord', [['KOORDINATOR', keiko.id]])
  const koordLain = await user('od_koord_lain', [['KOORDINATOR', pibi.id]])
  const artA = await user('od_artA', [['KARYAWAN', keiko.id]]), artC = await user('od_artC', [['KARYAWAN', keiko.id]])
  akunUji = await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Fiverr', namaAkun: 'UJI-OD akun', feePersen: 0.2 } })
  const o = await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akunUji.id, klien: 'KLIEN-UJI-OD', judul: 'UJI-OD order', nilaiKotor: 1000000, nilaiBersih: 800000, assignments: { create: [{ userId: artA.id, feeTalent: 123456 }] } } })
  const base = `/api/circle/orders/${o.id}`

  console.log('— detail & hak lihat —')
  let r = await panggil(base + '/detail', { token: koord.t }); cek('Koordinator melihat detail lengkap dengan uang & tim fee', r.s === 200 && r.j.data.uang?.nilaiBersih === 800000 && r.j.data.timFee?.[0]?.feeTalent === 123456 && r.j.data.bisaKelola === true)
  r = await panggil(base + '/detail', { token: artA.t }); const a = r.j.data
  cek('Anggota yang ditugaskan melihat order TANPA uang/termin/fee', r.s === 200 && !a.uang && !a.termin && !a.timFee && a.bisaKelola === false && !JSON.stringify(a).includes('123456') && !JSON.stringify(a).includes('800000'))
  r = await panggil(base + '/detail', { token: artC.t }); cek('Anggota yang TIDAK ditugaskan → 403', r.s === 403)
  r = await panggil(base + '/detail', { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)

  console.log('— item & add-on —')
  r = await panggil(base + '/item', { method: 'PUT', token: artA.t, body: { item: [{ nama: 'x', hargaSatuan: 1 }] } }); cek('Anggota mengatur item → 403', r.s === 403)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: '', hargaSatuan: 1 }] } }); cek('Nama kosong → 422', r.s === 422)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: 'a', hargaSatuan: -1 }] } }); cek('Harga negatif → 422', r.s === 422)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: 'a', jumlah: 0, hargaSatuan: 1 }] } }); cek('Jumlah 0 → 422', r.s === 422)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: 'a', jenis: 'LAIN', hargaSatuan: 1 }] } }); cek('Jenis tak dikenal → 422', r.s === 422)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: 'Karakter full body', jenis: 'ITEM', jumlah: 1, hargaSatuan: 900000 }, { nama: 'Toggle', jenis: 'ADDON', jumlah: 2, hargaSatuan: 150000 }] } })
  cek('Simpan 2 baris → total 1.200.000; add-on 300.000 menambah nilai order jadi 1.300.000, selisih 100.000 (13 Nov sore)', r.s === 200 && r.j.data.totalItem === 1200000 && r.j.data.perubahanAddon === 300000 && r.j.data.nilaiKotor === 1300000 && r.j.data.selisihDenganNilaiOrder === 100000, JSON.stringify(r.j.data))
  r = await panggil(base + '/detail', { token: artA.t }); cek('Anggota melihat NAMA item tanpa harga', r.j.data.item.length === 2 && r.j.data.item.every(i => !('hargaSatuan' in i)))
  r = await panggil(base + '/detail', { token: koord.t }); cek('Koordinator melihat harga dan selisih', r.j.data.item[0].hargaSatuan === 900000 && r.j.data.uang.selisihItem === 100000 && r.j.data.uang.totalAddon === 300000)
  const sebelum = await prisma.orderProduksi.findUnique({ where: { id: o.id } }); cek('Add-on menambah nilai order: kotor 1.300.000, bersih 1.040.000 (fee 20%)', sebelum.nilaiKotor === 1300000 && Math.abs(sebelum.nilaiBersih - 1040000) < 0.01, `${sebelum.nilaiKotor}/${sebelum.nilaiBersih}`)
  r = await panggil(base + '/item', { method: 'PUT', token: koord.t, body: { item: [{ nama: 'Karakter full body', jenis: 'ITEM', jumlah: 1, hargaSatuan: 900000 }, { nama: 'Toggle', jenis: 'ADDON', jumlah: 2, hargaSatuan: 150000 }] } })
  cek('Simpan ulang tanpa mengubah add-on → nilai tidak bergeser', r.s === 200 && r.j.data.perubahanAddon === 0 && (await prisma.orderProduksi.findUnique({ where: { id: o.id } })).nilaiKotor === 1300000)
  r = await panggil(base + '/samakan-nilai', { method: 'POST', token: koord.t }); const sesudah = await prisma.orderProduksi.findUnique({ where: { id: o.id } })
  cek('Samakan nilai (eksplisit): kotor 1.200.000, bersih 960.000 (fee 20%)', r.s === 200 && sesudah.nilaiKotor === 1200000 && Math.abs(sesudah.nilaiBersih - 960000) < 0.01, `${sesudah.nilaiKotor}/${sesudah.nilaiBersih}`)

  console.log('— termin pembayaran —')
  r = await panggil(base + '/termin', { method: 'POST', token: artA.t, body: { label: 'DP', jumlah: 1 } }); cek('Anggota membuat termin → 403', r.s === 403)
  r = await panggil(base + '/termin', { method: 'POST', token: koord.t, body: { label: '', jumlah: 1 } }); cek('Label kosong → 422', r.s === 422)
  r = await panggil(base + '/termin', { method: 'POST', token: koord.t, body: { label: 'DP', jumlah: 0 } }); cek('Jumlah 0 → 422', r.s === 422)
  r = await panggil(base + '/termin', { method: 'POST', token: koord.t, body: { label: 'DP', jumlah: 100, jatuhTempo: '31-12-2030' } }); cek('Tanggal salah format → 422', r.s === 422)
  r = await panggil(base + '/termin', { method: 'POST', token: koord.t, body: { label: 'DP 50%', jumlah: 480000, jatuhTempo: D(-10), dibayarPada: D(-9) } }); cek('Buat termin DP sudah dibayar', r.s === 201); const t1 = r.j.data?.id
  let ord = await prisma.orderProduksi.findUnique({ where: { id: o.id } })
  cek('Status bayar order otomatis DP dengan dpAmount 480.000', ord.statusBayar === 'DP' && ord.dpAmount === 480000 && ord.tanggalLunas === null, `${ord.statusBayar}/${ord.dpAmount}`)
  r = await panggil(base + '/termin', { method: 'POST', token: koord.t, body: { label: 'Pelunasan', jumlah: 480000, jatuhTempo: D(-3) } }); const t2 = r.j.data?.id
  r = await panggil(base + '/detail', { token: koord.t }); cek('Ringkasan: diterima 480.000, sisa 480.000, 1 termin terlambat', r.j.data.uang.diterima === 480000 && r.j.data.uang.sisaTagihan === 480000 && r.j.data.uang.terlambat === 1, JSON.stringify(r.j.data.uang))
  r = await panggil(base + `/termin/${t2}`, { method: 'PATCH', token: koord.t, body: { dibayarPada: D(0) } }); cek('Tandai pelunasan dibayar', r.s === 200)
  ord = await prisma.orderProduksi.findUnique({ where: { id: o.id } }); cek('Status bayar order otomatis LUNAS + tanggalLunas terisi', ord.statusBayar === 'LUNAS' && !!ord.tanggalLunas && ord.dpAmount === null, ord.statusBayar)
  r = await panggil(base + `/termin/${t2}`, { method: 'PATCH', token: koord.t, body: { dibayarPada: null } }); ord = await prisma.orderProduksi.findUnique({ where: { id: o.id } }); cek('Batalkan pembayaran → kembali DP', ord.statusBayar === 'DP')
  r = await panggil(base + `/termin/${t1}`, { method: 'DELETE', token: koord.t }); cek('Hapus termin', r.s === 200)
  r = await panggil(base + `/termin/idasal`, { method: 'PATCH', token: koord.t, body: { label: 'x' } }); cek('Termin tak ada → 404', r.s === 404)
  ord = await prisma.orderProduksi.findUnique({ where: { id: o.id } }); cek('Tanpa pembayaran diterima → BELUM_LUNAS', ord.statusBayar === 'BELUM_LUNAS' && ord.dpAmount === null)

  console.log('— tagihan jatuh tempo —')
  r = await panggil(`/api/circle/piutang?studioId=${keiko.id}`, { token: artA.t }); cek('Anggota membuka tagihan → 403', r.s === 403)
  r = await panggil(`/api/circle/piutang?studioId=${keiko.id}`, { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`/api/circle/piutang?studioId=${keiko.id}`, { token: koord.t }); const pu = r.j.data
  const baris = pu.baris.find(b => b.orderId === o.id)
  cek('Tagihan memuat termin Pelunasan, telat 3 hari → kelompok 1–7', r.s === 200 && baris?.telatHari === 3 && baris.kelompok === 'telat1_7' && pu.kelompok.length === 5, JSON.stringify(baris))

  console.log('— catatan proyek —')
  r = await panggil(base + '/catatan', { method: 'POST', token: artC.t, body: { isi: 'x' } }); cek('Anggota tak ditugaskan menulis catatan → 403', r.s === 403)
  r = await panggil(base + '/catatan', { method: 'POST', token: artA.t, body: { isi: '   ' } }); cek('Catatan kosong → 422', r.s === 422)
  r = await panggil(base + '/catatan', { method: 'POST', token: artA.t, body: { isi: 'Sketsa sudah di folder Drive' } }); cek('Anggota ditugaskan menulis catatan', r.s === 201); const c1 = r.j.data?.id
  r = await panggil(base + '/detail', { token: artA.t }); cek('Catatan tampil dan ditandai milikku', r.j.data.catatanProyek[0]?.milikku === true)
  r = await panggil(base + `/catatan/${c1}`, { method: 'DELETE', token: artC.t }); cek('Orang lain menghapus catatan → 403', r.s === 403)
  r = await panggil(base + `/catatan/${c1}`, { method: 'DELETE', token: koord.t }); cek('Koordinator boleh menghapus catatan anggota', r.s === 200)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-OD' } })
  if (akunUji) await prisma.akunProduksi.deleteMany({ where: { id: akunUji.id } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
