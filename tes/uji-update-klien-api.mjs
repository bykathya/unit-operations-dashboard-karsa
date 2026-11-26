import { DASH } from './_jalur.mjs'
// Uji ATURAN LEMBUR PER UNIT (21 Okt 2026): perhitungan murni (utils/lembur.js) + alur API (koordinator mengatur, lembur manual menunggu
// persetujuan, Payroll hanya mengklaim lembur DISETUJUI milik unitnya, dihitung dengan aturan unit). Data sementara dihapus di akhir.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.37.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }

let xff = 0
let stu
try {
  stu = await prisma.studio.create({ data: { nama: 'UJI-UK studio', tipe: 'STUDIO', circleId: keiko.circleId } })
  const S = stu.id
  const koord = await user('uk_koord', [['KOORDINATOR', S]]), kar = await user('uk_kar', [['KARYAWAN', S]]), mkt = await user('uk_mkt', [['KADER', S]]), mkt2 = await user('uk_mkt2', [['KADER', S]])
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER' } }); await prisma.fungsiAnggota.create({ data: { userId: mkt2.id, studioId: S, fungsi: 'MARKETER' } })
  await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-UK akun', feePersen: 0.2 } })
  let r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: '3d' } })
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const T = r.j.data.tahap, id = (n) => T.find(t => t.nama === n)?.id
  const akun = await prisma.akunProduksi.findFirst({ where: { studioId: S } })
  const buat = async (judul, klien, tahapNama, mundurHari, marketerId = null) => {
    const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien, judul, nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(Date.now() - mundurHari * 86400000), status: 'MASUK', subStatus: 'Inbox', tahapId: id('Inbox'), marketerId, tahapAktif: ['-', ...T.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)] } })
    await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: kar.id } })
    if (tahapNama !== 'Inbox') await panggil(`/api/circle/orders/${o.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id(tahapNama) } })
    return o
  }
  const o1 = await buat('UJI-UK baru', 'Klien Satu', 'Inbox', 0, mkt.id), o2 = await buat('UJI-UK lama tanpa kabar', 'Klien Dua', 'Modeling', 5, mkt.id), o3 = await buat('UJI-UK preview', 'Klien Tiga', 'Preview klien', 4, mkt2.id), o4 = await buat('UJI-UK revisi klien', 'Klien Empat', 'Revisi klien', 3, mkt.id)
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: kar.c }); cek('Talent tidak boleh membuka Update klien → 403', r.s === 403)
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); const dk = r.j.data, baris = (o) => dk.baris.find(b => b.id === o.id)
  cek('Koordinator melihat semua 4 order aktif; batas bawaan 2 hari', r.s === 200 && dk.baris.length === 4 && dk.batasHari === 2 && dk.ringkasan.aktif === 4)
  const tenggang = Date.now() < new Date('2026-11-13T00:00:00+07:00').getTime() // masa penyesuaian peluncuran: yang belum pernah tercatat tidak merah dulu
  cek('Order baru (hari ini) tidak terlewat; order 5 hari tanpa kabar: belum tercatat' + (tenggang ? ' (masa penyesuaian: belum merah)' : ' → terlewat'), baris(o1).terlewat === false && baris(o2).belumPernah === true && baris(o2).hariLalu >= 5 && baris(o2).terlewat === !tenggang && baris(o2).masaTenggang === tenggang)
  // urutan bawaan sejak 16 Nov 2026 (masukan tim): order masuk paling lama di atas, terbaru di bawah
  cek('Urutan: order masuk paling lama di atas → terbaru di bawah', JSON.stringify(dk.baris.map(b => b.id)) === JSON.stringify([o2.id, o3.id, o4.id, o1.id]) && dk.baris.every(b => b.tanggalMasuk))
  cek('Posisi/status otomatis dari tahap: Modeling = Di talent; Preview klien = Di klien; Revisi klien = Di talent; Inbox = Di admin', baris(o2).posisi === 'Di talent' && baris(o3).posisi === 'Di klien' && baris(o4).posisi === 'Di talent' && baris(o1).posisi === 'Di admin')
  cek('Respons tanpa angka uang (nilai/fee/harga/termin)', !/nilai|\bfee\b|harga|termin|"uang"/i.test(JSON.stringify(dk)))
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: mkt.c }); cek('Marketer hanya melihat order yang ia pegang (3 dari 4)', r.s === 200 && r.j.data.baris.length === 3 && !r.j.data.baris.some(b => b.id === o3.id))
  r = await panggil(`/api/circle/update-klien?studioId=${S}&batas=10`, { token: koord.c }); cek('Batas bisa diatur (10 hari → tak ada yang terlewat)', r.j.data.batasHari === 10 && r.j.data.ringkasan.terlewat === 0)
  await prisma.updateKlien.create({ data: { orderId: o2.id, studioId: S, jenis: 'KATA', waktu: new Date(Date.now() - 4 * 86400000) } })
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); cek('Sudah pernah tercatat tapi 4 hari lalu → terlewat meski masih masa penyesuaian', r.j.data.baris.find(b => b.id === o2.id).terlewat === true)
  await prisma.updateKlien.deleteMany({ where: { orderId: o2.id } })
  // catat update
  r = await panggil('/api/circle/update-klien', { method: 'POST', token: kar.c, body: { orderId: o2.id, jenis: 'KATA' } }); cek('Talent tak boleh mencatat → 403', r.s === 403)
  r = await panggil('/api/circle/update-klien', { method: 'POST', token: mkt2.c, body: { orderId: o2.id, jenis: 'KATA' } }); cek('Marketer lain (bukan pemegang) tak boleh mencatat → 403', r.s === 403)
  r = await panggil('/api/circle/update-klien', { method: 'POST', token: mkt.c, body: { orderId: o2.id, jenis: 'NGAWUR' } }); cek('Jenis tak dikenal → 422', r.s === 422)
  r = await panggil('/api/circle/update-klien', { method: 'POST', token: mkt.c, body: { orderId: o2.id, jenis: 'KATA', catatan: 'kabar: modeling 60%' } }); cek('Marketer pemegang mencatat Kata → 201', r.s === 201)
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); const b2 = r.j.data.baris.find(b => b.id === o2.id)
  cek('Setelah dikabari: tak lagi terlewat, hari ini, Kata ✓, catatan terlihat', b2.terlewat === false && b2.belumPernah === false && b2.hariLalu === 0 && b2.kata === true && b2.catatanTerakhir === 'kabar: modeling 60%' && b2.jumlahUpdate === 1)
  cek('Setelah dikabari baris tidak melompat: order paling lama tetap di urutan pertama', r.j.data.baris[0].id === o2.id)
  r = await panggil(`/api/circle/update-klien/${o2.id}/riwayat`, { token: koord.c }); cek('Riwayat update memuat catatan + pencatat', r.s === 200 && r.j.data[0].jenis === 'KATA' && r.j.data[0].oleh === 'Uji uk_mkt')
  r = await panggil(`/api/circle/update-klien/${o2.id}/riwayat`, { token: mkt2.c }); cek('Riwayat order orang lain → 403', r.s === 403)
  // kabar lama menjadi terlewat lagi
  await prisma.updateKlien.updateMany({ where: { orderId: o2.id }, data: { waktu: new Date(Date.now() - 3 * 86400000) } })
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); cek('Kabar 3 hari lalu → terlewat lagi', r.j.data.baris.find(b => b.id === o2.id).terlewat === true && r.j.data.baris.find(b => b.id === o2.id).hariLalu === 3)
  // otomatis dari papan: keluar dari Preview klien = kontak ke klien
  r = await panggil(`/api/circle/orders/${o3.id}/aksi`, { method: 'POST', token: koord.c, body: { aksi: 'revisi_klien' } }); cek('Aksi papan: klien minta revisi', r.s === 200)
  r = await panggil(`/api/circle/update-klien/${o3.id}/riwayat`, { token: koord.c }); cek('Keluar dari Preview klien tercatat otomatis sebagai kontak ke klien', r.j.data.some(x => x.jenis === 'PREVIEW' && x.otomatis === true))
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); const b3 = r.j.data.baris.find(b => b.id === o3.id); cek('Preview ✓ & hari ini; order kini di Revisi klien → kolom feedback aktif (belum)', b3.preview === true && b3.hariLalu === 0 && b3.feedbackKeTalent === false)
  // feedback ke talent
  r = await panggil('/api/circle/update-klien/feedback', { method: 'POST', token: koord.c, body: { orderId: o2.id, selesai: true } }); cek('Feedback di luar Revisi klien → 409', r.s === 409)
  r = await panggil('/api/circle/update-klien/feedback', { method: 'POST', token: kar.c, body: { orderId: o3.id, selesai: true } }); cek('Talent tak boleh mencentang feedback → 403', r.s === 403)
  r = await panggil('/api/circle/update-klien/feedback', { method: 'POST', token: koord.c, body: { orderId: o3.id, selesai: true } }); cek('Koordinator mencentang feedback ke talent', r.s === 200)
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); cek('Centang feedback tersimpan', r.j.data.baris.find(b => b.id === o3.id).feedbackKeTalent === true)
  r = await panggil(`/api/circle/update-klien/${o3.id}/riwayat`, { token: koord.c }); cek('Centang feedback BUKAN kontak ke klien (tak mengubah update terakhir)', r.j.data.some(x => x.jenis === 'FEEDBACK_TALENT'))
  r = await panggil('/api/circle/update-klien/feedback', { method: 'POST', token: koord.c, body: { orderId: o3.id, selesai: false } }); r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); cek('Centang bisa dilepas', r.j.data.baris.find(b => b.id === o3.id).feedbackKeTalent === false)
  // pesanan lama tanpa catatan: keluar dari Preview klien dianggap kontak
  const o5 = await buat('UJI-UK lama', 'Klien Lima', 'Inbox', 9, mkt.id)
  await prisma.riwayatTahapOrder.create({ data: { orderId: o5.id, namaTahap: 'Preview klien', jenis: 'PREVIEW_KLIEN', mulai: new Date(Date.now() - 6 * 86400000), selesai: new Date(Date.now() - 1 * 86400000) } })
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: koord.c }); const b5 = r.j.data.baris.find(b => b.id === o5.id); cek('Order lama: keluar dari Preview klien 1 hari lalu dihitung kontak (tidak terlewat), Preview ✓', b5.hariLalu === 1 && b5.terlewat === false && b5.preview === true)
} finally {
  if (stu) {
    const S = stu.id, wh = { order: { studioId: S } }
    await prisma.updateKlien.deleteMany({ where: { studioId: S } }); await prisma.penugasanTahap.deleteMany({ where: wh }); await prisma.riwayatTahapOrder.deleteMany({ where: wh }); await prisma.auditOrder.deleteMany({ where: wh }); await prisma.assignmentProduksi.deleteMany({ where: wh })
    await prisma.orderProduksi.deleteMany({ where: { studioId: S } }); await prisma.klienProduksi.deleteMany({ where: { studioId: S } }); await prisma.akunProduksi.deleteMany({ where: { studioId: S } }); await prisma.tahapProduksi.deleteMany({ where: { studioId: S } }); await prisma.kategoriOrder.deleteMany({ where: { studioId: S } })
    await prisma.fungsiAnggota.deleteMany({ where: { studioId: S } })
  }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  if (stu) await prisma.studio.delete({ where: { id: stu.id } }).catch(e => console.log('studio sisa:', e.message.slice(0, 100)))
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
