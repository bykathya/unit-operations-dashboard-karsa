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

const { PRESET, aksiTersedia, bangunPreset } = await import(DASH + '/server/src/utils/alur.js')
const { JENIS_KERJA } = await import(DASH + '/server/src/utils/penugasan.js')
console.log('— mesin murni —')
const l3d = PRESET['3d'].langkah
cek('Antrean talent = KERJA, revisi (internal & klien), FINALISASI', ['KERJA', 'REVISI_INTERNAL', 'REVISI_KLIEN', 'FINALISASI'].every(j => JENIS_KERJA.includes(j)) && JENIS_KERJA.length === 4)
cek('Preset 3D: tanpa "Menunggu client"', !l3d.some(l => l.jenis === 'MENUNGGU_KLIEN'))
cek('Preset 3D: Finalisasi, Preview klien & Revisi klien menyala bawaan', ['FINALISASI', 'PREVIEW_KLIEN', 'REVISI_KLIEN'].every(j => l3d.find(l => l.jenis === j)?.aktifBawaan === true))
cek('Preset 3D: ada Delivery, Hold, Done', ['DELIVERY', 'HOLD', 'SELESAI'].every(j => l3d.some(l => l.jenis === j)))
const tmpl = []; await bangunPreset('3d', async (b) => { const id = 'x' + tmpl.length; tmpl.push({ id, ...b, indukId: b.indukId }); return id })
const inbox = tmpl.find(t => t.jenis === 'MASUK')
const aksiInbox = (peran) => aksiTersedia({ templat: tmpl, order: { tahapAktif: [] }, sekarang: inbox, riwayat: [], peran })
cek('Inbox: talent TIDAK punya aksi "Mulai kerjakan"', aksiInbox({ manajer: false, ditugaskan: true, marketer: false }).length === 0)
cek('Inbox: admin/koordinator punya "Mulai kerjakan"', aksiInbox({ manajer: true, ditugaskan: false, marketer: false }).some(a => a.aksi === 'lanjut'))

console.log('— API: Tugas saya = antrean talent —')
let xff = 0
let stu
try {
  stu = await prisma.studio.create({ data: { nama: 'UJI-AT studio', tipe: 'STUDIO', circleId: keiko.circleId } })
  const S = stu.id
  const koord = await user('at_koord', [['KOORDINATOR', S]]), A = await user('at_a', [['KARYAWAN', S]]), B = await user('at_b', [['KARYAWAN', S]]), kar = await user('at_kar', [['KARYAWAN', S]])
  await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  let r = await panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { preset: '3d' } }); cek('Terapkan templat 3D', r.s === 200)
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); const T = r.j.data.tahap
  const id = (nama) => T.find(t => t.nama === nama)?.id
  cek('Templat 3D di studio: tanpa Menunggu client, Finalisasi aktif bawaan', !T.some(t => t.jenis === 'MENUNGGU_KLIEN') && T.find(t => t.jenis === 'FINALISASI').aktifBawaan === true)
  const akun = await prisma.akunProduksi.findFirst({ where: { studioId: S } })
  const buat = async (judul, tahapNama, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-AT', judul, nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'MASUK', subStatus: 'Inbox', tahapId: id('Inbox'), tahapAktif: ['-', ...T.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)] } }); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: A.id, ...extra } }); if (tahapNama !== 'Inbox') { const x = await panggil(`/api/circle/orders/${o.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id(tahapNama) } }); if (x.s !== 200) console.log('pindah gagal', tahapNama, x.s) } return o }
  const o1 = await buat('UJI-AT inbox', 'Inbox'), o2 = await buat('UJI-AT produksi', 'Modeling'), o3 = await buat('UJI-AT qc', 'QC: Modeling'), o4 = await buat('UJI-AT finalisasi', 'Finalisasi'), o5 = await buat('UJI-AT delivery', 'Delivery'), o6 = await buat('UJI-AT hold', 'Hold'), o7 = await buat('UJI-AT revisi', 'Revisi: Modeling'), o8 = await buat('UJI-AT klien', 'Preview klien')
  r = await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token: A.c }); const d = r.j.data
  const idsTugas = d.tugas.filter(t => t.jenis !== 'SELESAI').map(t => t.id).sort(), idsLain = d.lain.map(t => t.id).sort()
  cek('Tugasku = Produksi + Revisi + Finalisasi saja', r.s === 200 && JSON.stringify(idsTugas) === JSON.stringify([o2.id, o4.id, o7.id].sort()), JSON.stringify(d.tugas.map(t => t.tahap)))
  cek('Tahap lain (Inbox, QC, Klien, Delivery, Hold) → daftar info terpisah, tanpa tombol', JSON.stringify(idsLain) === JSON.stringify([o1.id, o3.id, o5.id, o6.id, o8.id].sort()) && d.lain.every(t => !('aksi' in t) && t.pemegang))
  cek('Ringkasan: aktif = 3, dipantau = 5', d.ringkas.aktif === 3 && d.ringkas.dipantau === 5)
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: A.c }); const ids2 = (r.j.data ?? r.j).map(x => x.orderId).sort()
  cek('Antreanku sama persis dengan Tugasku (satu definisi)', JSON.stringify(ids2) === JSON.stringify(idsTugas))
  cek('Finalisasi punya baris antrean (dulu tidak)', ids2.includes(o4.id))
  const tulis = async (u) => (await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token: u })).j, ant = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: A.c })
  const detailT = await panggil(`/api/circle/orders/${o2.id}/detail`, { token: A.c })
  cek('Talent TIDAK melihat uang di Tugas saya, Antrean, maupun detail order (harga/fee/nilai/termin)', !/nilai|fee|harga|termin|"uang"|diterima|statusBayar/i.test(JSON.stringify(await tulis(A.c)) + JSON.stringify(ant.j) + JSON.stringify(detailT.j.data)) )
  r = await panggil(`/api/circle/tugas/${o1.id}/aksi`, { method: 'POST', token: A.c, body: { aksi: 'lanjut' } }); cek('Talent tidak bisa memulai dari Inbox → 409/404', [409, 404].includes(r.s))
  r = await panggil(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id('Modeling') } }); cek('Koordinator memindahkan Inbox → Modeling', r.s === 200)
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: A.c }); cek('Setelah dipindah admin, order masuk antrean talent', (r.j.data ?? r.j).some(x => x.orderId === o1.id))

  console.log('— tim per tahap —')
  const o9 = (await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-AT', judul: 'UJI-AT pertahap', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'MASUK', subStatus: 'Inbox', tahapId: id('Inbox'), tahapAktif: ['-', ...T.filter(t => t.opsional && t.aktifBawaan).map(t => t.id)] } }))
  const asgA = await prisma.assignmentProduksi.create({ data: { orderId: o9.id, userId: A.id } }), asgB = await prisma.assignmentProduksi.create({ data: { orderId: o9.id, userId: B.id } })
  const baris = async (orderId) => (await prisma.penugasanTahap.findMany({ where: { orderId, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })).map(x => x.userId).sort()
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: kar.c, body: { tahapKerjaIds: [id('Modeling')] } }); cek('Karyawan tak boleh atur tahap tim → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('QC: Modeling')] } }); cek('Tahap bukan pengerjaan/finalisasi (QC) → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: ['ngawur'] } }); cek('Tahap tak dikenal → 422', r.s === 422)
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('Modeling')] } }); cek('A hanya mengerjakan Modeling', r.s === 200, JSON.stringify(r.j))
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgB.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('Texture'), id('Rigging')] } }); cek('B mengerjakan Texture & Rigging', r.s === 200)
  r = await panggil(`/api/circle/orders/${o9.id}/detail`, { token: koord.c }); cek('Detail memuat tahapKerjaIds per anggota + pilihan tahap', r.j.data.tim.find(t => t.id === asgA.id).tahapKerjaIds.length === 1 && r.j.data.tahapKerja.length >= 4 && r.j.data.audit.some(a => String(a.field).includes('tahap dikerjakan')))
  await panggil(`/api/circle/orders/${o9.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id('Modeling') } })
  cek('Di Modeling: hanya A yang punya baris antrean', JSON.stringify(await baris(o9.id)) === JSON.stringify([A.id]))
  await panggil(`/api/circle/orders/${o9.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id('Revisi: Modeling') } })
  cek('Revisi: Modeling mengikuti induknya → hanya A', JSON.stringify(await baris(o9.id)) === JSON.stringify([A.id]))
  await panggil(`/api/circle/orders/${o9.id}/tahap`, { method: 'PATCH', token: koord.c, body: { tahapId: id('Texture') } })
  cek('Pindah ke Texture: baris A ditutup, hanya B', JSON.stringify(await baris(o9.id)) === JSON.stringify([B.id]))
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('Modeling'), id('Texture')] } })
  cek('Haknya diubah saat tahap berjalan → A langsung dapat baris Texture', JSON.stringify(await baris(o9.id)) === JSON.stringify([A.id, B.id].sort()))
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgB.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('Rigging')] } })
  cek('Hak B dicabut dari Texture → baris B ditutup', JSON.stringify(await baris(o9.id)) === JSON.stringify([A.id]))
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgA.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [] } })
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${asgB.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [] } })
  cek('Dikosongkan = semua tahap → keduanya punya baris', JSON.stringify(await baris(o9.id)) === JSON.stringify([A.id, B.id].sort()))
  r = await panggil(`/api/circle/orders/${o9.id}/tim`, { method: 'POST', token: koord.c, body: { namaFreelance: 'UJI-AT frel' } }); const fl = (await prisma.assignmentProduksi.findFirst({ where: { orderId: o9.id, namaEksternal: 'UJI-AT frel' } }))
  r = await panggil(`/api/circle/orders/${o9.id}/tim/${fl.id}`, { method: 'PATCH', token: koord.c, body: { tahapKerjaIds: [id('Modeling')] } }); cek('Freelance tak punya antrean → 422', r.s === 422)

  console.log('— skrip perapian alur 3D (templat lama) —')
  const stu2 = await prisma.studio.create({ data: { nama: 'UJI-AT lama', tipe: 'STUDIO', circleId: keiko.circleId } }); const S2 = stu2.id
  const mk = async (nama, jenis, urutan, extra = {}) => (await prisma.tahapProduksi.create({ data: { studioId: S2, nama, jenis, urutan, ...extra } })).id
  const tIn = await mk('Inbox', 'MASUK', 1), tMod = await mk('Modeling', 'KERJA', 2), tTex = await mk('Texture', 'KERJA', 3), tPk = await mk('Preview klien', 'PREVIEW_KLIEN', 4, { opsional: true, aktifBawaan: false }), tRk = await mk('Revisi klien', 'REVISI_KLIEN', 5, { opsional: true, aktifBawaan: false }), tMk = await mk('Menunggu client', 'MENUNGGU_KLIEN', 6), tFin = await mk('Finalisasi', 'FINALISASI', 7, { opsional: true, aktifBawaan: false }), tDl = await mk('Delivery', 'DELIVERY', 8, { opsional: true, aktifBawaan: true }), tHold = await mk('Hold', 'HOLD', 9), tDone = await mk('Done', 'SELESAI', 10)
  const akun2 = await prisma.akunProduksi.create({ data: { studioId: S2, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const oM = await prisma.orderProduksi.create({ data: { studioId: S2, akunId: akun2.id, klien: 'K', judul: 'UJI-AT lama menunggu', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'PROSES', subStatus: 'Menunggu client', tahapId: tMk, tahapAktif: ['-', tDl] } })
  const oF = await prisma.orderProduksi.create({ data: { studioId: S2, akunId: akun2.id, klien: 'K', judul: 'UJI-AT lama finalisasi', nilaiKotor: 1, nilaiBersih: 1, tanggalMasuk: new Date(), status: 'PROSES', subStatus: 'Finalisasi', tahapId: tFin, tahapAktif: ['-', tDl, tFin] } })
  await prisma.assignmentProduksi.create({ data: { orderId: oF.id, userId: A.id } }); await prisma.riwayatTahapOrder.create({ data: { orderId: oM.id, namaTahap: 'Menunggu client', jenis: 'MENUNGGU_KLIEN', mulai: new Date() } })
  const { execFileSync } = await import('child_process')
  const jalan = (...a) => execFileSync('node', ['scripts/rapikan-alur-3d.js', '--studio=UJI-AT lama', ...a], { cwd: DASH + '/server', encoding: 'utf8' })
  const dry = jalan(); cek('Dry-run tidak mengubah apa pun', (await prisma.tahapProduksi.count({ where: { studioId: S2 } })) === 10 && dry.includes('dry-run'))
  jalan('--yes')
  const t2 = await prisma.tahapProduksi.findMany({ where: { studioId: S2 } })
  cek('"Menunggu client" dihapus dari templat', !t2.some(t => t.jenis === 'MENUNGGU_KLIEN') && t2.length === 9)
  cek('Preview klien, Revisi klien & Finalisasi menyala bawaan', ['PREVIEW_KLIEN', 'REVISI_KLIEN', 'FINALISASI'].every(j => t2.find(t => t.jenis === j).aktifBawaan === true))
  const oM2 = await prisma.orderProduksi.findUnique({ where: { id: oM.id } }); cek('Order yang menunggu klien dipindah ke Hold (riwayat tercatat)', oM2.tahapId === tHold && oM2.subStatus === 'Hold' && (await prisma.riwayatTahapOrder.count({ where: { orderId: oM.id, namaTahap: 'Hold' } })) === 1)
  const oF2 = await prisma.orderProduksi.findUnique({ where: { id: oF.id } }); cek('Daftar tahap-aktif order berjalan ditambah Preview klien & Revisi klien', oF2.tahapAktif.includes(tPk) && oF2.tahapAktif.includes(tRk) && oF2.tahapAktif.includes(tFin))
  cek('Order di Finalisasi mendapat baris antrean untuk anggota timnya', (await prisma.penugasanTahap.count({ where: { orderId: oF.id, userId: A.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })) === 1)
  jalan('--yes'); cek('Skrip idempoten (jalan dua kali aman)', (await prisma.tahapProduksi.count({ where: { studioId: S2 } })) === 9 && (await prisma.penugasanTahap.count({ where: { orderId: oF.id, userId: A.id, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } } })) === 1)
  var stuDua = stu2
} finally {
  for (const st of [stu, typeof stuDua !== 'undefined' ? stuDua : null].filter(Boolean)) {
    const S = st.id, wh = { order: { studioId: S } }
    await prisma.penugasanTahap.deleteMany({ where: wh }); await prisma.riwayatTahapOrder.deleteMany({ where: wh }); await prisma.auditOrder.deleteMany({ where: wh }); await prisma.assignmentProduksi.deleteMany({ where: wh })
    await prisma.orderProduksi.deleteMany({ where: { studioId: S } }); await prisma.klienProduksi.deleteMany({ where: { studioId: S } }); await prisma.akunProduksi.deleteMany({ where: { studioId: S } }); await prisma.tahapProduksi.deleteMany({ where: { studioId: S } })
    await prisma.kategoriOrder.deleteMany({ where: { studioId: S } })
  }
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  for (const st of [stu, typeof stuDua !== 'undefined' ? stuDua : null].filter(Boolean)) await prisma.studio.delete({ where: { id: st.id } }).catch(e => console.log('studio sisa:', e.message.slice(0, 100)))
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
