import { DASH } from './_jalur.mjs'
// Uji masukan tim 9 Nov 2026 (sore): (1) lembur PER_PROYEK — nilai per order diisi koordinator saat menyetujui, (2) talent freelance cukup
// nama saat tambah order & di tim order, (3) LTK boleh langsung Deal dari Draft, (4) pemilik unit tidak mendapat tombol ubah order
// yang bukan miliknya. Aturan lembur unit uji dikembalikan; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { hitungLembur } = await import(DASH + '/server/src/utils/lembur.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.46.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const S = keiko.id
const hash = await bcrypt.hash('uji-9nov-' + Date.now(), 4)
const dibuat = [], orderIds = [], ltkIds = [], lemburIds = []
const aturanLama = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('n9_koord', [['KOORDINATOR', S]]), kar = await user('n9_kar', [['KARYAWAN', S]]), mkt = await user('n9_mkt', [['KARYAWAN', S]], 'MARKETER')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const ord = async (judul, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-N9', judul, nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), ...extra } }); orderIds.push(o.id); return o }

  console.log('— (1) lembur per project —')
  const hp = hitungLembur([{ tanggalKerja: '2031-05-05', menit: 120, status: 'DISETUJUI', nilaiProyek: 75000 }, { tanggalKerja: '2031-05-05', menit: 60, status: 'DISETUJUI', nilaiProyek: 25000 }, { tanggalKerja: '2031-05-06', menit: 90, status: 'MENUNGGU', nilaiProyek: 999 }], { mode: 'PER_PROYEK' })
  cek('Perhitungan murni: uang = jumlah nilai per order yang disetujui', hp.uang === 100000 && hp.adaTarif === true && hp.jam === 3, JSON.stringify({ uang: hp.uang, jam: hp.jam }))
  let r = await panggil('/api/circle/lembur/aturan', { method: 'PUT', token: koord.c, body: { studioId: S, mode: 'PER_PROYEK' } }); cek('Koordinator memilih aturan "Per project" → 200', r.s === 200, JSON.stringify(r.j).slice(0, 120))
  const o1 = await ord('UJI-N9 lembur'); await prisma.assignmentProduksi.create({ data: { orderId: o1.id, userId: kar.id } })
  r = await panggil(`/api/circle/kehadiran/order-lembur?studioId=${S}`, { token: kar.c }); cek('Pilihan order lembur: wajib & berisi order yang ia kerjakan', r.s === 200 && r.j.data.wajibOrder === true && r.j.data.order.some(o => o.id === o1.id) && !JSON.stringify(r.j).includes('nilai'))
  const l = await prisma.lemburKehadiran.create({ data: { userId: kar.id, studioId: S, status: 'MENUNGGU', tanggalKerja: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), sumber: 'MANUAL', mulai: new Date(), selesai: new Date(), menit: 90, catatan: 'uji', orderId: o1.id } }); lemburIds.push(l.id)
  r = await panggil(`/api/circle/lembur/${l.id}/setujui`, { method: 'POST', token: koord.c, body: { studioId: S } }); cek('Menyetujui tanpa nilai → 422', r.s === 422)
  r = await panggil(`/api/circle/lembur/${l.id}/setujui`, { method: 'POST', token: koord.c, body: { studioId: S, nilai: 150000 } }); cek('Menyetujui dengan nilai Rp 150.000 → 200', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/lembur/usulan?studioId=${S}`, { token: koord.c }); const b = r.j.data?.baris?.find(x => x.id === l.id), og = r.j.data?.orang?.find(x => x.userId === kar.id)
  cek('Usulan memuat judul order & nilai; rekap uang = nilai', b?.order === 'UJI-N9 lembur' && b?.nilaiProyek === 150000 && og?.uang === 150000)

  console.log('— (1b) lembur = fee pekerjaan, dicatat kapan saja (10 Nov 2026) —')
  r = await panggil(`/api/circle/lembur/aturan?studioId=${S}`, { token: koord.c }); cek('Pilihan cara hitung tidak lagi menawarkan mode per jam (unit belum memakainya)', r.s === 200 && !('PER_JAM' in r.j.data.pilihan.mode) && 'PER_PROYEK' in r.j.data.pilihan.mode)
  const kemarin = new Date(Date.now() + 7 * 3600000 - 3 * 86400000).toISOString().slice(0, 10), besok = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().slice(0, 10)
  r = await panggil('/api/circle/kehadiran/lembur', { method: 'POST', token: kar.c, body: { studioId: S, tanggal: kemarin, orderId: o1.id, catatan: 'kerja malam, baru dicatat' } })
  cek('Lembur per project untuk 3 hari lalu, tanpa jam & tanpa presensi pulang → 201', r.s === 201, JSON.stringify(r.j).slice(0, 140)); if (r.j.data?.id) lemburIds.push(r.j.data.id)
  r = await panggil('/api/circle/kehadiran/lembur', { method: 'POST', token: kar.c, body: { studioId: S, tanggal: besok, orderId: o1.id, catatan: 'x' } }); cek('Tanggal yang akan datang → 422', r.s === 422)
  await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { mode: 'PER_JAM', tarifPerJam: 10000 } })
  r = await panggil('/api/circle/kehadiran/lembur', { method: 'POST', token: kar.c, body: { studioId: S, tanggal: kemarin, catatan: 'x' } }); cek('Unit yang masih memakai mode per jam: tanpa jam → 422', r.s === 422)
  r = await panggil('/api/circle/kehadiran/lembur', { method: 'POST', token: kar.c, body: { studioId: S, tanggal: kemarin, mulai: '19:00', selesai: '21:00', catatan: 'x' } }); cek('…dengan jam (tanpa syarat setelah pulang) → 201', r.s === 201, JSON.stringify(r.j).slice(0, 140)); if (r.j.data?.id) lemburIds.push(r.j.data.id)
  r = await panggil(`/api/circle/lembur/aturan?studioId=${S}`, { token: koord.c }); cek('Unit yang memakai per jam tetap melihat pilihan itu', 'PER_JAM' in (r.j.data?.pilihan?.mode ?? {}))
  await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { mode: 'PER_PROYEK' } })

  console.log('— (2) freelance cukup nama —')
  r = await panggil('/api/circle/orders', { method: 'POST', token: koord.c, body: { studioId: S, judul: 'UJI-N9 order freelance', klien: 'KLIEN-UJI-N9', akunId: 'INTERNAL', namaFreelance: 'UJI-N9 Freelancer' } })
  cek('Tambah order dengan nama freelance → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120)); if (r.j.data?.id) orderIds.push(r.j.data.id)
  const af = await prisma.assignmentProduksi.findFirst({ where: { orderId: r.j.data?.id } })
  cek('Freelance tercatat di tim order (tanpa akun)', af?.namaEksternal === 'UJI-N9 Freelancer' && !af.userId && af.tipeEksternal === 'FREELANCER_PERORANGAN')
  r = await panggil('/api/circle/orders', { method: 'POST', token: koord.c, body: { studioId: S, judul: 'x', klien: 'x', akunId: 'INTERNAL', namaFreelance: 'A', talentUserId: kar.id } }); cek('Talent internal + freelance sekaligus → 422', r.s === 422)
  const o2 = await ord('UJI-N9 tim')
  r = await panggil(`/api/circle/orders/${o2.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: 'UJI-N9 FL Dua' } }); cek('Tambah freelance ke tim order yang ada → 201', r.s === 201)
  r = await panggil(`/api/circle/orders/${o2.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: 'uji-n9 fl dua' } }); cek('Nama freelance yang sama dua kali → 409', r.s === 409)
  r = await panggil(`/api/circle/orders/${o2.id}/tim`, { method: 'POST', token: kar.c, body: { namaFreelance: 'X' } }); cek('Karyawan menambah freelance → 403', r.s === 403)

  console.log('— (3) LTK langsung Deal —')
  r = await panggil('/api/circle/ltk', { method: 'POST', token: koord.c, body: { studioId: S, arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-N9 PO', judul: 'UJI-N9 langsung deal' } }); const lk = r.j.data?.id; if (lk) ltkIds.push(lk)
  r = await panggil(`/api/circle/ltk/${lk}/deal`, { method: 'POST', token: koord.c, body: { hargaSepakat: 500000 } }); cek('Draft → Deal langsung → 200', r.s === 200, JSON.stringify(r.j).slice(0, 120))
  cek('Status Deal tersimpan', (await prisma.kasusLtk.findUnique({ where: { id: lk } })).status === 'DEAL')

  console.log('— (4) pemilik unit: tombol ubah order —')
  const pm = await user('n9_pemilik', [['KARYAWAN', S]], 'MARKETER'); await prisma.studioPemilik.create({ data: { studioId: S, userId: pm.id, persenSaham: 1 } })
  const oLain = await ord('UJI-N9 bukan milik pemilik'), oMilik = await ord('UJI-N9 milik pemilik', { marketerId: pm.id })
  r = await panggil(`/api/circle/orders/${oLain.id}/detail`, { token: pm.c }); cek('Pemilik membuka order orang lain: lihat, tanpa tombol ubah/batal', r.s === 200 && r.j.data.bisaUbahOrder === false && r.j.data.bisaKelola === false)
  r = await panggil(`/api/circle/orders/${oMilik.id}/detail`, { token: pm.c }); cek('Pemilik yang juga marketer pemegang order: boleh ubah order miliknya', r.s === 200 && r.j.data.bisaUbahOrder === true)
  r = await panggil(`/api/circle/orders/${oLain.id}/batal`, { method: 'POST', token: pm.c, body: { alasan: 'x' } }); cek('(kontrol) server tetap menolak batal order orang lain', r.s === 403)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  if (aturanLama) await prisma.pengaturanLembur.update({ where: { studioId: S }, data: { mode: aturanLama.mode, tarifPerJam: aturanLama.tarifPerJam, tarifPerHari: aturanLama.tarifPerHari } })
  else await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } })
  await prisma.lemburKehadiran.deleteMany({ where: { id: { in: lemburIds } } })
  await prisma.kasusLtk.deleteMany({ where: { id: { in: ltkIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.studioPemilik.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
