import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const api = (uid, web = 'app') => { const t = jwt.sign({ id: uid }, process.env.JWT_SECRET, { expiresIn: '10m' }); return async (path, method = 'GET', body) => { const r = await fetch('http://localhost:3001/api/circle' + path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Forwarded-For': `172.20.${(++xff >> 8) & 255}.${xff & 255}` }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } } }

const studio = await prisma.studio.findFirst({ where: { nama: 'Zanyland' } })
const lain = await prisma.studio.findFirst({ where: { nama: { startsWith: 'Pibi' } } })
const dibuat = []
const buat = async (kode, role, studioId) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: 'x', statusAktif: true } }); dibuat.push(u.id); await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId } }); return u.id }
let orderId
try {
  const idK = await buat('alur_koord', 'KOORDINATOR', studio.id), idT = await buat('alur_talent', 'KARYAWAN', studio.id), idLain = await buat('alur_koord_lain', 'KOORDINATOR', lain.id)
  const K = api(idK), T = api(idT), L = api(idLain)
  const lihat = async () => (await K(`/templat?studioId=${studio.id}`)).j.data.langkah
  const idNama = (l, n) => l.find(x => x.nama === n)?.id

  console.log('— templat per studio —')
  let r = await K(`/templat?studioId=${studio.id}`); cek('Koordinator membaca templat (bawaan sederhana, 6 langkah) + daftar preset', r.s === 200 && r.j.data.langkah.length === 6 && r.j.data.preset.length === 4)
  r = await T(`/templat?studioId=${studio.id}`); cek('Talent tidak boleh membuka pengaturan alur → 403', r.s === 403)
  r = await L(`/templat?studioId=${studio.id}`); cek('Koordinator studio lain → 403', r.s === 403)
  r = await T('/templat?studioId=' + studio.id, 'PUT', { preset: 'ilustrasi' }); cek('Talent menerapkan preset → 403', r.s === 403)
  r = await L('/templat?studioId=' + studio.id, 'PUT', { preset: 'ilustrasi' }); cek('Koordinator studio lain menerapkan preset → 403', r.s === 403)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { preset: 'tidakada' }); cek('Preset tak dikenal → 422', r.s === 422)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { preset: 'ilustrasi' }); cek('Preset Ilustrasi diterapkan', r.s === 200)
  let langkah = await lihat(); cek('Templat sekarang 20 langkah: Sketch→Line Art→Base Color→Finishing + QC & revisi tiap tahap + ujung klien/delivery', langkah.length === 20 && langkah.filter(l => l.jenis === 'QC').length === 4, langkah.map(l => l.nama).join('>'))
  cek('Gerbang menunjuk induknya (QC: Sketch → Sketch)', langkah.find(l => l.nama === 'QC: Sketch').indukId === idNama(langkah, 'Sketch'))
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: langkah.filter(l => l.jenis !== 'SELESAI') }); cek('Simpan templat tanpa langkah Selesai → 422', r.s === 422, r.j.message)

  console.log('— alur penuh dengan gerbang —')
  r = await K('/orders', 'POST', { studioId: studio.id, judul: 'UJI-ALUR ilustrasi', klien: 'KLIEN-UJI', nilaiDisepakati: 250000, talentUserId: idT, akunId: 'INTERNAL' }); orderId = r.j.data?.id; cek('Order dibuat di Inbox', r.s === 201)
  const aksi = (u, a) => u(`/orders/${orderId}/aksi`, 'POST', { aksi: a })
  const posisi = async () => { const o = await prisma.orderProduksi.findUnique({ where: { id: orderId } }); return o }
  r = await aksi(T, 'lanjut'); cek('Talent TIDAK bisa memulai dari Inbox → 409', r.s === 409)
  r = await aksi(K, 'lanjut'); cek('Koordinator: Mulai kerjakan → Sketch', r.s === 200 && r.j.data.tahap === 'Sketch')
  r = await aksi(T, 'lanjut'); cek('Talent: Siap QC → QC: Sketch', r.s === 200 && r.j.data.tahap === 'QC: Sketch')
  r = await aksi(T, 'lanjut'); cek('Talent TIDAK bisa meloloskan QC → 409', r.s === 409)
  r = await aksi(T, 'gagal'); cek('Talent TIDAK bisa menggagalkan QC → 409', r.s === 409)
  r = await aksi(K, 'gagal'); cek('Koordinator: QC gagal → Revisi: Sketch', r.s === 200 && r.j.data.tahap === 'Revisi: Sketch')
  let o = await posisi(); cek('  …hitungan revisi 1, status PROSES', o.revisiKe === 1 && o.status === 'PROSES')
  r = await aksi(T, 'lanjut'); cek('Talent: Revisi selesai → kembali ke QC: Sketch', r.s === 200 && r.j.data.tahap === 'QC: Sketch')
  r = await aksi(K, 'lanjut'); cek('Koordinator: QC lolos → Line Art', r.s === 200 && r.j.data.tahap === 'Line Art')
  r = await aksi(K, 'hold'); cek('Koordinator: Hold', r.s === 200 && r.j.data.tahap === 'Hold')
  r = await aksi(T, 'lanjut'); cek('Talent tidak bisa melanjutkan Hold → 409', r.s === 409)
  r = await aksi(K, 'lanjut'); cek('Koordinator: Lanjutkan Hold → kembali ke Line Art', r.s === 200 && r.j.data.tahap === 'Line Art')

  console.log('— tahap opsional per order —')
  langkah = await lihat()
  const idPk = idNama(langkah, 'Preview klien'), idRk = idNama(langkah, 'Revisi klien'), idSketch = idNama(langkah, 'Sketch')
  r = await K(`/orders/${orderId}/opsional`, 'PATCH', { tahapAktif: [idSketch] }); cek('Menyalakan tahap yang bukan opsional → 422', r.s === 422)
  r = await T(`/orders/${orderId}/opsional`, 'PATCH', { tahapAktif: [idPk] }); cek('Talent mengatur opsional → 403', r.s === 403)
  const idDlv = idNama(langkah, 'Delivery')
  r = await K(`/orders/${orderId}/opsional`, 'PATCH', { tahapAktif: [idPk, idRk, idDlv] }); cek('Preview klien + Revisi klien + Delivery dinyalakan untuk order ini', r.s === 200)
  let papan = (await K(`/papan?studioId=${studio.id}`)).j.data; let po = papan.orders.find(x => x.id === orderId)
  cek('Papan menampilkan tahap opsional yang menyala di order', po.tahapAktif.includes(idPk) && po.tahapAktif.includes(idRk))
  cek('Papan mengirim fase makro (Antrian, Produksi, QC, Revisi, Klien, Finalisasi, Delivery, Hold, Selesai)', papan.fase.map(f => f.label).join() === 'Antrian,Produksi,QC,Revisi,Klien,Finalisasi,Delivery,Hold,Selesai', papan.fase.map(f => f.label).join())
  const pindah = (nama) => K(`/orders/${orderId}/tahap`, 'PATCH', { tahapId: idNama(langkah, nama) })
  r = await pindah('Finishing'); cek('Koordinator memindahkan manual ke Finishing (koreksi)', r.s === 200)
  r = await aksi(T, 'lanjut'); cek('Talent: Finishing → QC: Finishing', r.j.data?.tahap === 'QC: Finishing', r.j.message)
  r = await aksi(K, 'lanjut'); cek('QC lolos → Preview klien (karena dinyalakan)', r.j.data?.tahap === 'Preview klien', r.j.message)
  r = await aksi(K, 'revisi_klien'); cek('Klien minta revisi → Revisi klien', r.j.data?.tahap === 'Revisi klien', r.j.message)
  o = await posisi(); cek('  …hitungan revisi sekarang 2', o.revisiKe === 2)
  r = await aksi(T, 'lanjut'); cek('Talent: revisi selesai → Preview klien', r.j.data?.tahap === 'Preview klien')
  r = await aksi(T, 'lanjut'); cek('Talent tidak bisa menyetujui preview ("Klien setuju") → 409', r.s === 409)
  r = await aksi(K, 'lanjut'); cek('Koordinator: Klien setuju → Delivery', r.j.data?.tahap === 'Delivery', r.j.message)
  r = await aksi(T, 'lanjut'); cek('Talent tidak bisa mengirim ke klien (Delivery milik marketer) → 409', r.s === 409)
  r = await aksi(K, 'lanjut'); o = await posisi(); cek('Koordinator: Terkirim → Done (tanggal selesai terisi, status SELESAI)', r.j.data?.tahap === 'Done' && o.status === 'SELESAI' && !!o.tanggalSelesai)
  r = await aksi(K, 'buka'); o = await posisi(); cek('Buka kembali dari Done → Delivery, tanggal selesai dikosongkan', r.j.data?.tahap === 'Delivery' && o.tanggalSelesai === null)
  const rw = await prisma.riwayatTahapOrder.findMany({ where: { orderId }, orderBy: { mulai: 'asc' } })
  cek(`Riwayat lengkap & hanya satu langkah terbuka (${rw.length} langkah)`, rw.length >= 16 && rw.filter(x => !x.selesai).length === 1)

  console.log('— menyunting templat yang sedang dipakai —')
  langkah = await lihat()
  const ganti = (mut) => langkah.map(l => ({ ...l, ...mut(l) }))
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: ganti(l => l.nama === 'Line Art' ? { nama: 'Lineart' } : {}) }); cek('Ganti NAMA tahap yang dipakai order → boleh', r.s === 200)
  langkah = await lihat(); cek('  …nama baru tersimpan, id tetap', !!idNama(langkah, 'Lineart') && !idNama(langkah, 'Line Art'))
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: ganti(l => l.nama === 'Hold' ? { nama: 'Sketch' } : {}) }); cek('Nama ganda → ditolak 422', r.s === 422)
  const pakai = langkah.find(l => l.order > 0)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: ganti(l => l.id === pakai.id ? { jenis: 'HOLD' } : {}) }); cek(`Ubah JENIS langkah yang dipakai order ("${pakai.nama}") → 409`, r.s === 409 || r.s === 422, `${r.s} ${r.j.message?.slice(0, 50)}`)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: langkah.filter(l => l.id !== pakai.id) }); cek('Hapus langkah yang dipakai order → 409/422', r.s === 409 || r.s === 422, `${r.s} ${r.j.message?.slice(0, 60)}`)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { preset: '3d' }); cek('Ganti preset saat ada order memakai alur lama → 409', r.s === 409)
  const baru = [...ganti(() => ({})).map(l => ({ ...l, urutan: l.urutan >= 5 ? l.urutan + 1 : l.urutan })), { kunci: 'baru', nama: 'Coloring', jenis: 'KERJA', urutan: 5, opsional: false, aktifBawaan: true }]
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: baru }); langkah = await lihat(); cek('Tambah tahap kerja baru ("Coloring") di tengah alur', r.s === 200 && langkah.some(l => l.nama === 'Coloring'), r.j.message)
  r = await K('/templat?studioId=' + studio.id, 'PUT', { langkah: langkah.filter(l => l.nama !== 'Coloring') }); langkah = await lihat(); cek('Hapus tahap baru yang belum dipakai → boleh', r.s === 200 && !langkah.some(l => l.nama === 'Coloring'))

  console.log('— order lama (tanpa tahapId) di templat yang punya langkah opsional mati —')
  const akunZ = (await prisma.akunProduksi.findFirst({ where: { studioId: studio.id } })) ?? await prisma.akunProduksi.create({ data: { studioId: studio.id, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const lama = {}
  for (const [kode, status, sub] of [['revisi', 'PROSES', 'Revision'], ['preview', 'PROSES', 'Preview'], ['kerja', 'PROSES', 'On Progress'], ['masuk', 'MASUK', null], ['selesai', 'SELESAI', 'Completed'], ['hold', 'PROSES', 'On Hold']]) {
    lama[kode] = (await prisma.orderProduksi.create({ data: { studioId: studio.id, akunId: akunZ.id, klien: 'lama', judul: `UJI-LAMA ${kode}`, nilaiKotor: 1, nilaiBersih: 1, status, subStatus: sub } })).id
  }
  papan = (await K(`/papan?studioId=${studio.id}`)).j.data
  for (const [kode, id] of Object.entries(lama)) {
    const o = papan.orders.find(x => x.id === id)
    cek(`Order lama "${kode}" punya jalan keluar (aksi tersedia untuk koordinator)`, !!o && o.aksi.length > 0, o ? o.aksi.map(a => a.label).join(' | ') : 'tidak muncul di papan')
  }
  await prisma.orderProduksi.deleteMany({ where: { id: { in: Object.values(lama) } } })

  console.log('— alur sederhana PiBi tidak terganggu —')
  const pb = await K(`/papan?studioId=${studio.id}`); cek('Papan studio tetap terbaca setelah templat diubah', pb.s === 200 && pb.j.data.orders.every(x => x.tahapId))
} catch (e) { console.error('GALAT:', e); gagal++ } finally {
  if (orderId) await prisma.orderProduksi.delete({ where: { id: orderId } })
  await prisma.tahapProduksi.deleteMany({ where: { studioId: studio.id } })   // kembalikan ke keadaan awal (templat dibuat ulang saat dibutuhkan)
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect(); process.exit(gagal ? 1 : 0)
}
