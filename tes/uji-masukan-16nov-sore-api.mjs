import { DASH } from './_jalur.mjs'
// Uji masukan tim 16 Nov 2026 sore (Marketer A, Admin A): (1) kolom khusus bisa DIUBAH (nama, tipe, pilihan) & tipe "Pilihan (boleh lebih dari
// satu)" — tetap hanya Koordinator; (2) kartu nilai Produksi per bulan (GET /papan/ringkasan, rumus nilaiBulanIni); (3) Admin Market hanya
// mengatur fungsi tim produksi (bukan dirinya & tim admin/marketing); (4) ajuan bayar freelance: admin mengajukan DP/Lunas, Koordinator
// membayar dari Tugas saya (biaya tercatat, ajuan selesai) atau menolak. Data uji dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.51.8.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m16s-' + T, 4)
const dibuat = [], orderIds = [], akunIds = [], kolomIds = []
const user = async (kode, roles, posisi = null) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true, ...(posisi ? { posisi } : {}) } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('m16s_koord', [['KOORDINATOR', S]]), adm = await user('m16s_adm', [['KARYAWAN', S]]), adm2 = await user('m16s_adm2', [['KARYAWAN', S]]), tal = await user('m16s_tal', [['KARYAWAN', S]]), mkt = await user('m16s_mkt', [['KARYAWAN', S]])
  const am = await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.fungsiAnggota.createMany({ data: [{ userId: adm2.id, studioId: S, fungsi: 'ADMIN', terkonfirmasi: true }, { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true }] })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o }), A = (p, o = {}) => panggil(p, { token: adm.t, ...o })
  const akun = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: `UJI-M16S ${T}`, feePersen: 0 } }); akunIds.push(akun.id)
  const tahap = await (await import(DASH + '/server/src/controllers/circle.js')).pastikanTahap(S)
  const id = (j) => tahap.find(t => t.jenis === j)?.id
  const ord = async (judul, data = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: `uji_m16s_${T}`, judul: `UJI-M16S ${judul} ${T}`, nilaiKotor: 500000, nilaiBersih: 500000, nilaiDisepakati: 500000, status: 'PROSES', tahapId: id('KERJA'), tanggalMasuk: new Date(), ...data } }); orderIds.push(o.id); return o }

  console.log('— (1) kolom khusus —')
  let r = await A('/api/circle/kolom-khusus', { method: 'POST', body: { studioId: S, nama: 'UJI File delivery', tipe: 'PILIHAN_BANYAK', pilihan: 'STL F, FBX, OBJ' } }); cek('Admin Market membuat kolom → 403 (Alur = Koordinator)', r.s === 403, String(r.s))
  r = await K('/api/circle/kolom-khusus', { method: 'POST', body: { studioId: S, nama: 'UJI File delivery', tipe: 'PILIHAN_BANYAK', pilihan: 'STL F, FBX, OBJ', diKartu: true } }); const kf = r.j.data; if (kf) kolomIds.push(kf.id)
  cek('Koordinator membuat kolom "Pilihan (boleh lebih dari satu)"', r.s === 201 && kf.tipe === 'PILIHAN_BANYAK' && kf.pilihan.length === 3, `${r.s} ${r.j.message ?? ''}`)
  const o1 = await ord('kolom')
  r = await K(`/api/circle/orders/${o1.id}/isian-khusus`, { method: 'PATCH', body: { [kf.id]: ['OBJ', 'STL F'] } }); cek('Isi dua pilihan sekaligus → tersimpan', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  cek('Tersimpan sebagai daftar, urut sesuai daftar pilihan', JSON.stringify((await prisma.orderProduksi.findUnique({ where: { id: o1.id } })).isianKhusus[kf.id]) === JSON.stringify(['STL F', 'OBJ']))
  r = await K(`/api/circle/orders/${o1.id}/isian-khusus`, { method: 'PATCH', body: { [kf.id]: ['STL F', 'GLB'] } }); cek('Pilihan di luar daftar → 422', r.s === 422, String(r.s))
  r = await K(`/api/circle/papan?studioId=${S}`); const kartu = r.j.data?.orders?.find(o => o.id === o1.id)
  cek('Label kartu memuat semua pilihan', kartu?.khusus?.some(x => x.nama === 'UJI File delivery' && x.nilai === 'STL F, OBJ'), JSON.stringify(kartu?.khusus))
  r = await A(`/api/circle/kolom-khusus/${kf.id}`, { method: 'PATCH', body: { nama: 'UJI ganti' } }); cek('Admin Market mengubah kolom → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/kolom-khusus/${kf.id}`, { method: 'PATCH', body: { nama: 'UJI Format file', pilihan: 'STL F, FBX, GLB' } }); cek('Koordinator mengubah nama & pilihan (OBJ dihapus, GLB ditambah)', r.s === 200 && r.j.data.nama === 'UJI Format file' && r.j.data.pilihan.includes('GLB'), `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/orders/${o1.id}/detail`); const kd = r.j.data?.khusus?.find(k => k.id === kf.id)
  cek('Isian lama tetap utuh (OBJ tetap tampil di order lama)', JSON.stringify(kd?.nilai) === JSON.stringify(['STL F', 'OBJ']), JSON.stringify(kd?.nilai))
  r = await K(`/api/circle/kolom-khusus/${kf.id}`, { method: 'PATCH', body: { tipe: 'PILIHAN' } }); r = await K(`/api/circle/orders/${o1.id}/detail`)
  cek('Tipe diubah ke satu pilihan → nilai lama tampil digabung, tidak hilang', r.j.data?.khusus?.find(k => k.id === kf.id)?.nilai === 'STL F, OBJ', JSON.stringify(r.j.data?.khusus?.find(k => k.id === kf.id)?.nilai))

  console.log('— (2) kartu nilai Produksi per bulan —')
  const kini = new Date(), lalu = new Date(Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth() - 1, 10)), bLalu = lalu.toISOString().slice(0, 7)
  r = await K(`/api/circle/papan/ringkasan?studioId=${S}&bulan=${bLalu}`); const sebelum = r.j.data?.ringkasan
  const oLalu = await ord('bulan lalu', { status: 'SELESAI', tahapId: id('SELESAI'), tanggalMasuk: lalu, tanggalSelesai: lalu, nilaiBersih: 777000, nilaiKotor: 777000 })
  r = await K(`/api/circle/papan/ringkasan?studioId=${S}&bulan=${bLalu}`); const ses = r.j.data?.ringkasan
  cek('Bulan lalu: order masuk +1, nilai +777.000, Done +777.000, Selesai +1', r.s === 200 && r.j.data.bulan === bLalu && ses.jumlahMasukBulanIni === sebelum.jumlahMasukBulanIni + 1 && Math.round(ses.total - sebelum.total) === 777000 && Math.round(ses.done - sebelum.done) === 777000 && ses.jumlahSelesai === sebelum.jumlahSelesai + 1, JSON.stringify({ sebelum, ses }))
  const { nilaiBulanIni } = await import(DASH + '/server/src/controllers/circle.js')
  const nb = await nilaiBulanIni(S, {}, new Date(`${bLalu}-15T00:00:00Z`))
  cek('Satu rumus: sama dengan nilaiBulanIni (dipakai juga halaman Web Circle Ekosistem)', Math.round(nb.total) === Math.round(ses.total) && nb.jumlahMasuk === ses.jumlahMasukBulanIni)
  r = await K(`/api/circle/papan/ringkasan?studioId=${S}&bulan=2099-01`); cek('Bulan depan → kembali ke bulan berjalan', r.j.data?.bulan === kini.toISOString().slice(0, 7), r.j.data?.bulan)
  r = await panggil(`/api/circle/papan/ringkasan?studioId=${S}&bulan=${bLalu}`, { token: tal.t }); cek('Talent → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/papan/ringkasan?studioId=${S}&bulan=${bLalu}`, { token: mkt.t }); cek('Marketer (pantau): jumlah ada, nilai uang unit tidak dikirim', r.s === 200 && r.j.data.ringkasan.total === null && r.j.data.ringkasan.jumlahMasukBulanIni >= 1, String(r.s))

  console.log('— (3) fungsi Tim oleh Admin Market —')
  r = await A(`/api/circle/tim?studioId=${S}`); const row = (u) => r.j.data?.anggota?.find(a => a.userId === u.id)
  cek('Admin: talent produksi bisa diubah; dirinya, sesama admin & marketer tidak', row(tal)?.bisaUbah === true && row(adm)?.bisaUbah === false && row(adm2)?.bisaUbah === false && row(mkt)?.bisaUbah === false, JSON.stringify({ tal: row(tal)?.bisaUbah, adm: row(adm)?.bisaUbah, adm2: row(adm2)?.bisaUbah, mkt: row(mkt)?.bisaUbah }))
  r = await A(`/api/circle/tim/${tal.id}?studioId=${S}`, { method: 'PUT', body: { fungsi: [{ fungsi: 'ARTIST', bidang: '3D' }] } }); cek('Admin mengatur Artist untuk talent produksi → 200', r.s === 200, r.j.message ?? '')
  r = await A(`/api/circle/tim/${adm.id}?studioId=${S}`, { method: 'PUT', body: { fungsi: [{ fungsi: 'PM_QC' }] } }); cek('Admin mengubah fungsi dirinya sendiri → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/tim/${adm2.id}?studioId=${S}`, { method: 'PUT', body: { fungsi: [{ fungsi: 'ADMIN' }, { fungsi: 'PM_QC' }] } }); cek('Admin mengubah fungsi sesama admin → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/tim/${adm2.id}?studioId=${S}`, { method: 'PUT', body: { fungsi: [{ fungsi: 'ADMIN' }, { fungsi: 'PM_QC' }] } }); cek('Koordinator tetap bisa mengubah siapa pun → 200', r.s === 200, r.j.message ?? '')

  console.log('— (4) ajuan bayar freelance —')
  const oF = await ord('freelance')
  const asg = await prisma.assignmentProduksi.create({ data: { orderId: oF.id, namaEksternal: `UjiFree ${T}`, tipeEksternal: 'FREELANCER_PERORANGAN', feeTalent: 100000 } })
  r = await A(`/api/circle/bayar-freelance?studioId=${S}`); cek('Admin: bisa melihat & mengajukan, tidak bisa membayar', r.s === 200 && r.j.data.bisaBayar === false && r.j.data.bisaAjukan === true, String(r.s))
  r = await A(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', body: { jenis: 'DP', jumlah: 30000 } }); cek('Admin membayar langsung → 403 (kas = Koordinator)', r.s === 403, String(r.s))
  r = await A(`/api/circle/bayar-freelance/${asg.id}/ajukan`, { method: 'POST', body: { jenis: 'DP', jumlah: 100000 } }); cek('Ajuan DP sebesar fee → 422 (pakai Lunas)', r.s === 422, String(r.s))
  r = await A(`/api/circle/bayar-freelance/${asg.id}/ajukan`, { method: 'POST', body: { jenis: 'DP', jumlah: 30000, catatan: 'BCA a.n. UjiFree' } }); cek('Admin mengajukan DP 30.000 → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await panggil(`/api/circle/bayar-freelance/${asg.id}/ajukan`, { method: 'POST', token: tal.t, body: { jenis: 'DP', jumlah: 1000 } }); cek('Talent mengajukan → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/bayar-freelance?studioId=${S}&ajuan=1`); const aj = r.j.data?.baris?.find(b => b.id === asg.id)
  cek('Tugas saya Koordinator: ajuan muncul (jenis, jumlah, pengaju, catatan)', aj?.ajuan?.jenis === 'DP' && aj.ajuan.jumlah === 30000 && aj.ajuan.oleh === 'Uji m16s_adm' && aj.ajuan.catatan === 'BCA a.n. UjiFree' && r.j.data.ringkas.ajuan >= 1, JSON.stringify(aj?.ajuan))
  r = await K(`/api/circle/bayar-freelance/${asg.id}/bayar`, { method: 'POST', body: { jenis: 'DP', jumlah: 30000 } }); cek('Koordinator klik Sudah dibayar → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  let a2 = await prisma.assignmentProduksi.findUnique({ where: { id: asg.id } })
  cek('Ajuan selesai, status DP 30.000, biaya Fee Freelance tercatat', a2.ajuanJenis === null && a2.statusBayar === 'DP' && a2.dpAmount === 30000 && (await prisma.biayaStudio.count({ where: { assignmentId: asg.id } })) === 1)
  r = await A(`/api/circle/bayar-freelance/${asg.id}/ajukan`, { method: 'POST', body: { jenis: 'LUNAS' } }); a2 = await prisma.assignmentProduksi.findUnique({ where: { id: asg.id } })
  cek('Ajuan Lunas = sisa fee (70.000)', r.s === 200 && a2.ajuanJenis === 'LUNAS' && a2.ajuanJumlah === 70000, JSON.stringify({ s: r.s, j: a2.ajuanJumlah }))
  r = await K(`/api/circle/bayar-freelance/${asg.id}/batal-ajuan`, { method: 'POST' }); a2 = await prisma.assignmentProduksi.findUnique({ where: { id: asg.id } })
  cek('Koordinator menolak ajuan → ajuan hilang, pembayaran lama tetap', r.s === 200 && a2.ajuanJenis === null && a2.dpAmount === 30000)
  const akunLain = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-M16S lain ${T}`, feePersen: 0 } }); akunIds.push(akunLain.id)
  await prisma.produksiAdminMarket.update({ where: { id: am.id }, data: { akunIds: [akunLain.id] } })
  r = await A(`/api/circle/bayar-freelance/${asg.id}/ajukan`, { method: 'POST', body: { jenis: 'LUNAS' } }); cek('Admin per akun: order akun lain → 403', r.s === 403, String(r.s))
  r = await A(`/api/circle/bayar-freelance?studioId=${S}`); cek('Admin per akun: daftar hanya order akunnya', r.s === 200 && !r.j.data.baris.some(b => b.id === asg.id))
} catch (e) { console.log('❌ galat skrip:', e.message); gagal++ } finally {
  const asgIds = (await prisma.assignmentProduksi.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })).map(a => a.id)
  await prisma.biayaStudio.deleteMany({ where: { assignmentId: { in: asgIds } } })
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'catatanOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_m16s' } } }).catch(() => {})
  await prisma.talentEksternal.deleteMany({ where: { nama: { startsWith: 'UjiFree' } } }).catch(() => {})
  await prisma.kolomKhususOrder.deleteMany({ where: { id: { in: kolomIds } } })
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(e => console.log('sisa akun:', e.message))
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
