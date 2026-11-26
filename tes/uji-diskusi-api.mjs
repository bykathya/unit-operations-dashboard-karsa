import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { selisihHari, deadlineTanpaPenanggung, qcMacet, perluEskalasi, labelDeadline } = await import(DASH + '/server/src/utils/otomasi.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.37.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const W = (s) => new Date(s + '+07:00')

console.log('— logika otomatisasi murni (OGS) —')
const skrg = W('2031-06-10T10:00')
cek('Selisih hari kalender WIB', selisihHari(W('2031-06-10T23:30'), W('2031-06-11T00:30')) === 1 && selisihHari(W('2031-06-10T01:00'), W('2031-06-10T23:00')) === 0)
cek('Label deadline H-2 / H-0 / H+3', labelDeadline(2) === 'H-2' && labelDeadline(0) === 'H-0' && labelDeadline(-3) === 'H+3')
const oo = (id, hari, o = {}) => ({ id, deadline: W('2031-06-10T00:00').getTime() + hari * 86400000, dalamTahapKerja: true, adaPenanggung: false, ...o })
cek('Deadline H-1 & H-0 tanpa penanggung terjaring; H-2 / sudah ada penanggung / bukan tahap kerja tidak', JSON.stringify(deadlineTanpaPenanggung({ orders: [oo('a', 1), oo('b', 0), oo('c', 2), oo('d', 1, { adaPenanggung: true }), oo('e', 1, { dalamTahapKerja: false }), { id: 'f', deadline: null, dalamTahapKerja: true, adaPenanggung: false }], sekarang: skrg }).map(o => o.id)) === JSON.stringify(['a', 'b']))
cek('QC macet ≥ 3 hari: 3 hari lolos, 2 hari tidak', JSON.stringify(qcMacet({ orders: [{ id: 'x', dalamQc: true, mulaiTahap: W('2031-06-07T09:00') }, { id: 'y', dalamQc: true, mulaiTahap: W('2031-06-08T09:00') }, { id: 'z', dalamQc: false, mulaiTahap: W('2031-06-01T09:00') }], sekarang: skrg }).map(o => o.id)) === JSON.stringify(['x']))
cek('Eskalasi: tanpa log → ya; ada diskusi terbuka → tidak; log hari ini → tidak; 6 hari → tidak; 7 hari → ya', perluEskalasi({ adaDiskusiTerbuka: false, logTerakhir: null, sekarang: skrg }) && !perluEskalasi({ adaDiskusiTerbuka: true, logTerakhir: null, sekarang: skrg }) && !perluEskalasi({ adaDiskusiTerbuka: false, logTerakhir: W('2031-06-10T08:00'), sekarang: skrg }) && !perluEskalasi({ adaDiskusiTerbuka: false, logTerakhir: W('2031-06-04T08:00'), sekarang: skrg }) && perluEskalasi({ adaDiskusiTerbuka: false, logTerakhir: W('2031-06-03T08:00'), sekarang: skrg }))

const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], ordersId = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, C = '/api/circle'
let akunUji, tahapQc
try {
  const koord = await user('dk_koord', [['KOORDINATOR', S]]), koordLain = await user('dk_koord_lain', [['KOORDINATOR', pibi.id]])
  const artA = await user('dk_artA', [['KARYAWAN', S]]), artB = await user('dk_artB', [['KARYAWAN', S]]), artC = await user('dk_artC', [['KARYAWAN', S]]), luar = await user('dk_luar', [['KARYAWAN', pibi.id]])
  const kepala = await user('dk_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]])
  akunUji = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const lain = await prisma.orderProduksi.create({ data: { studioId: pibi.id, akunId: (await prisma.akunProduksi.findFirst({ where: { studioId: pibi.id } }) ?? await prisma.akunProduksi.create({ data: { studioId: pibi.id, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })).id, klien: 'KLIEN-UJI-DK', judul: 'UJI-DK order unit lain', nilaiKotor: 1, nilaiBersih: 1 } }); ordersId.push(lain.id)
  const ordKeiko = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunUji.id, klien: 'KLIEN-UJI-DK', judul: 'UJI-DK order keiko', nilaiKotor: 1, nilaiBersih: 1 } }); ordersId.push(ordKeiko.id)

  console.log('— diskusi: membuat —')
  const buat = (body, t = artA.t) => panggil(`${C}/diskusi`, { method: 'POST', token: t, body: { studioId: S, ...body } })
  let r = await buat({ judul: '', peserta: [artB.id] }); cek('Judul kosong → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK tanpa peserta', peserta: [] }); cek('Tanpa peserta → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK peserta luar', peserta: [luar.id] }); cek('Peserta bukan anggota unit → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK order lain', peserta: [artB.id], orderId: lain.id }); cek('Order milik unit lain → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK tautan', peserta: [artB.id], tautan: ['javascript:alert(1)'] }); cek('Tautan javascript: ditolak (tanpa unggahan berkas) → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK diskusi 1', peserta: [artB.id], orderId: ordKeiko.id, deskripsi: 'bahas revisi', tautan: ['https://drive.google.com/uji'], pesanAwal: 'Halo, mohon pendapat' }, koordLain.t); cek('Koordinator circle lain membuat di unit Keiko → 403', r.s === 403)
  r = await buat({ judul: 'UJI-DK diskusi 1', peserta: [artB.id], orderId: ordKeiko.id, deskripsi: 'bahas revisi', tautan: ['https://drive.google.com/uji'], pesanAwal: 'Halo, mohon pendapat' }); cek('Talent (artA) membuat diskusi', r.s === 201); const d1 = r.j.data?.id

  console.log('— akses —')
  r = await panggil(`${C}/diskusi/${d1}`, { token: artC.t }); cek('Bukan peserta → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}`, { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}`, { token: kepala.t }); cek('Atasan (Kepala Circle) boleh melihat, bisa mengelola', r.s === 200 && r.j.data.bisaKelola === true)
  r = await panggil(`${C}/diskusi?studioId=${S}`, { token: artC.t }); cek('Daftar diskusi bukan peserta: kosong', r.s === 200 && !r.j.data.some(d => d.id === d1))
  r = await panggil(`${C}/diskusi?studioId=${S}`, { token: artB.t }); const dB = r.j.data.find(d => d.id === d1)
  cek('Daftar peserta (artB): ada, 2 peserta, 1 belum dibaca, terkait order', !!dB && dB.jumlahPeserta === 2 && dB.belumDibaca === 1 && dB.order?.id === ordKeiko.id, JSON.stringify([dB?.jumlahPeserta, dB?.belumDibaca]))
  r = await panggil(`${C}/diskusi/belum-dibaca`, { token: artB.t }); cek('Total belum dibaca artB ≥ 1', r.j.data.belumDibaca >= 1)
  r = await panggil(`${C}/diskusi/${d1}`, { token: artB.t }); cek('Buka detail menandai terbaca; detail lengkap (tautan, order, peserta)', r.s === 200 && r.j.data.tautan.length === 1 && r.j.data.peserta.length === 2 && r.j.data.order.judul === 'UJI-DK order keiko' && r.j.data.bisaKelola === false)
  r = await panggil(`${C}/diskusi?studioId=${S}`, { token: artB.t }); cek('Setelah dibuka: belum dibaca 0', r.j.data.find(d => d.id === d1).belumDibaca === 0)
  r = await panggil(`${C}/diskusi/opsi?studioId=${S}`, { token: artA.t }); cek('Opsi pembuatan: anggota (tanpa diri sendiri) + order terbuka', r.s === 200 && !r.j.data.anggota.some(a => a.id === artA.id) && r.j.data.order.some(o => o.id === ordKeiko.id))

  console.log('— pesan, balasan, sebut —')
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artC.t, body: { isi: 'x' } }); cek('Bukan peserta mengirim pesan → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artB.t, body: { isi: '   ' } }); cek('Pesan kosong → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artB.t, body: { isi: 'x', tautan: ['ftp://x.y/z'] } }); cek('Tautan non-http → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artB.t, body: { isi: '@artC tolong lihat ini', sebut: [artC.id, luar.id] } }); cek('artB mengirim pesan, menyebut artC (+ non-anggota diabaikan)', r.s === 201); const m1 = r.j.data?.id
  r = await panggil(`${C}/diskusi/${d1}`, { token: artC.t }); cek('Yang disebut otomatis menjadi peserta (artC bisa membuka)', r.s === 200 && r.j.data.peserta.length === 3 && !r.j.data.peserta.some(p => p.userId === luar.id))
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artC.t, body: { isi: 'siap', indukId: m1 } }); cek('Balasan ke komentar tingkat atas', r.s === 201); const m2 = r.j.data?.id
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artA.t, body: { isi: 'x', indukId: m2 } }); cek('Balasan ke balasan → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}`, { token: artA.t }); const top = r.j.data.pesan.find(p => p.id === m1)
  cek('Pesan tersusun berutas: induk punya 1 balasan, nama yang disebut tampil', top?.balasan.length === 1 && top.sebut.includes('Uji dk_artC'), JSON.stringify([top?.balasan.length, top?.sebut]))
  r = await panggil(`${C}/diskusi/${d1}/pesan/${m1}`, { method: 'DELETE', token: artA.t }); cek('Menghapus pesan orang lain → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}/pesan/${m1}`, { method: 'DELETE', token: artB.t }); cek('Menghapus pesan sendiri', r.s === 200)
  r = await panggil(`${C}/diskusi/${d1}`, { token: artA.t }); cek('Pesan terhapus tetap tampil sebagai "dihapus" (isi null), balasan tetap ada', r.j.data.pesan.find(p => p.id === m1)?.dihapus === true && r.j.data.pesan.find(p => p.id === m1).isi === null && r.j.data.pesan.find(p => p.id === m1).balasan.length === 1)

  console.log('— kelola, putuskan, batalkan —')
  r = await panggil(`${C}/diskusi/${d1}`, { method: 'PATCH', token: artB.t, body: { judul: 'x' } }); cek('Peserta biasa mengubah diskusi → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}`, { method: 'PATCH', token: artA.t, body: { judul: 'UJI-DK diskusi 1 (ubah)' } }); cek('Pemilik mengubah judul', r.s === 200)
  r = await panggil(`${C}/diskusi/${d1}/peserta`, { method: 'POST', token: artB.t, body: { userIds: [koord.id] } }); cek('Peserta biasa menambah peserta → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}/peserta`, { method: 'POST', token: artA.t, body: { userIds: [luar.id] } }); cek('Menambah non-anggota → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/peserta`, { method: 'POST', token: artA.t, body: { userIds: [koord.id] } }); cek('Pemilik menambah koordinator', r.s === 200 && r.j.data.ditambahkan === 1)
  r = await panggil(`${C}/diskusi/${d1}/peserta/${artA.id}`, { method: 'DELETE', token: artA.t }); cek('Pemilik tidak bisa dihapus → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/peserta/${artC.id}`, { method: 'DELETE', token: artA.t }); cek('Pemilik menghapus peserta artC', r.s === 200)
  r = await panggil(`${C}/diskusi/${d1}`, { token: artC.t }); cek('artC tidak lagi bisa membuka → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}/putuskan`, { method: 'POST', token: artB.t, body: { ringkasan: 'ok' } }); cek('Peserta biasa memutuskan → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${d1}/putuskan`, { method: 'POST', token: artA.t, body: { ringkasan: '  ' } }); cek('Ringkasan keputusan wajib → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/putuskan`, { method: 'POST', token: artA.t, body: { ringkasan: 'Lanjut revisi 2x, deadline tetap' } }); cek('Pemilik memutuskan', r.s === 200)
  r = await panggil(`${C}/diskusi/${d1}`, { token: artB.t }); cek('Status DIPUTUSKAN + ringkasan tampil', r.j.data.status === 'DIPUTUSKAN' && r.j.data.ringkasanKeputusan.startsWith('Lanjut revisi') && r.j.data.diputuskanOleh === 'Uji dk_artA')
  r = await panggil(`${C}/diskusi/${d1}/pesan`, { method: 'POST', token: artB.t, body: { isi: 'masih mau bicara' } }); cek('Diskusi ditutup: pesan baru → 422', r.s === 422)
  r = await panggil(`${C}/diskusi/${d1}/batalkan`, { method: 'POST', token: artA.t }); cek('Diskusi ditutup: batalkan → 422', r.s === 422)
  r = await buat({ judul: 'UJI-DK diskusi 2', peserta: [artB.id] }); const d2 = r.j.data.id
  r = await panggil(`${C}/diskusi/${d2}/batalkan`, { method: 'POST', token: kepala.t }); cek('Atasan membatalkan diskusi', r.s === 200)
  r = await panggil(`${C}/diskusi?studioId=${S}&status=DIBATALKAN`, { token: artA.t }); cek('Filter status DIBATALKAN', r.j.data.every(d => d.status === 'DIBATALKAN') && r.j.data.some(d => d.id === d2))

  console.log('— otomatisasi: peringatan deadline tanpa penanggung —')
  const tdl = await panggil(`${C}/templat?studioId=${S}`, { token: koord.t }); const tahap = tdl.j.data.langkah
  const kerja = tahap.find(t => t.jenis === 'KERJA'), masuk = tahap.find(t => t.jenis === 'MASUK')
  tahapQc = await prisma.tahapProduksi.create({ data: { studioId: S, urutan: 99, nama: 'UJI-DK QC', jenis: 'QC' } })
  const besok = new Date(Date.now() + 86400000), lusa3 = new Date(Date.now() + 3 * 86400000)
  const buatO = async (judul, tahapId, deadline, data = {}) => { const t = tahap.find(x => x.id === tahapId) ?? { nama: 'UJI-DK QC' }; const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunUji.id, klien: 'KLIEN-UJI-DK', judul, nilaiKotor: 1, nilaiBersih: 1, status: 'PROSES', tahapId, subStatus: t.nama, deadline, ...data } }); ordersId.push(o.id); return o }
  const o1 = await buatO('UJI-DK tanpa penanggung H-1', kerja.id, besok)
  const o2 = await buatO('UJI-DK deadline jauh', kerja.id, lusa3)
  const o3 = await buatO('UJI-DK ada penanggung', kerja.id, besok, { assignments: { create: [{ userId: artA.id }] } })
  const o4 = await buatO('UJI-DK masih di inbox', masuk.id, besok, { status: 'MASUK' })
  r = await panggil(`${C}/otomasi/peringatan?studioId=${S}`, { token: artA.t }); cek('Anggota biasa membuka peringatan → 403', r.s === 403)
  r = await panggil(`${C}/otomasi/peringatan?studioId=${S}`, { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${C}/otomasi/peringatan?studioId=${S}`, { token: koord.t }); const dt = r.j.data.deadlineTanpaPenanggung
  cek('Peringatan: hanya order H-1 tanpa penanggung di tahap kerja', dt.some(x => x.orderId === o1.id && x.label === 'H-1') && !dt.some(x => [o2.id, o3.id, o4.id].includes(x.orderId)), JSON.stringify(dt.map(x => x.judul)))

  console.log('— otomatisasi: QC macet → diskusi otomatis —')
  const o5 = await buatO('UJI-DK QC macet', tahapQc.id, besok, { assignments: { create: [{ userId: artB.id }] } })
  await prisma.riwayatTahapOrder.create({ data: { orderId: o5.id, namaTahap: 'UJI-DK QC', jenis: 'QC', mulai: new Date(Date.now() - 5 * 86400000) } })
  r = await panggil(`${C}/otomasi/peringatan?studioId=${S}`, { token: koord.t }); const qm = r.j.data.qcMacet.find(x => x.orderId === o5.id)
  cek('QC macet terdeteksi: 5 hari, perlu eskalasi', qm?.umurHari === 5 && qm.perluEskalasi === true && qm.sudahDiskusi === false, JSON.stringify(qm))
  r = await panggil(`${C}/otomasi/eskalasi`, { method: 'POST', token: artA.t, body: { studioId: S } }); cek('Anggota biasa menjalankan eskalasi → 403', r.s === 403)
  r = await panggil(`${C}/otomasi/eskalasi`, { method: 'POST', token: koord.t, body: { studioId: S } }); const dEs = r.j.data
  cek('Eskalasi membuat 1 diskusi otomatis untuk order itu', r.s === 200 && dEs.diskusi.some(d => d.judul.includes('QC macet')) , JSON.stringify(dEs))
  const dis = await prisma.diskusiKeputusan.findFirst({ where: { orderId: o5.id, otomatis: true }, include: { peserta: true, pesan: true } })
  cek('Diskusi otomatis: dibuat "Otomasi", peserta = koordinator + penanggung (artB), pesan pembuka dari Otomasi', dis?.dibuatOleh === 'Otomasi' && dis.status === 'TERBUKA' && dis.peserta.some(p => p.userId === koord.id && p.peran === 'PEMILIK') && dis.peserta.some(p => p.userId === artB.id && p.peran === 'PESERTA') && dis.pesan[0]?.nama === 'Otomasi' && dis.pesan[0].userId === null)
  r = await panggil(`${C}/diskusi/${dis.id}`, { token: artB.t }); cek('Penanggung (artB) langsung bisa membuka & melihat pesan Otomasi', r.s === 200 && r.j.data.pesan[0].otomatis === true && r.j.data.otomatis === true)
  r = await panggil(`${C}/otomasi/eskalasi`, { method: 'POST', token: koord.t, body: { studioId: S } }); cek('Eskalasi ulang: tidak menggandakan (diskusi terbuka sudah ada)', r.j.data.diskusi.filter(d => d.judul.includes('UJI-DK QC macet')).length === 0)
  r = await panggil(`${C}/diskusi/${dis.id}/putuskan`, { method: 'POST', token: artB.t, body: { ringkasan: 'x' } }); cek('Penanggung (peserta) tidak bisa memutuskan diskusi otomatis → 403', r.s === 403)
  r = await panggil(`${C}/diskusi/${dis.id}/putuskan`, { method: 'POST', token: koord.t, body: { ringkasan: 'Lanjut QC besok' } }); cek('Koordinator (pengelola) memutuskan diskusi otomatis', r.s === 200)
  r = await panggil(`${C}/otomasi/eskalasi`, { method: 'POST', token: koord.t, body: { studioId: S } }); cek('Diskusi ditutup tapi eskalasi sudah jalan HARI INI → tidak ulang', r.j.data.diskusi.filter(d => d.judul.includes('UJI-DK QC macet')).length === 0)
  await prisma.logOtomasi.updateMany({ where: { aturan: 'qc_macet', subjekId: o5.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } })
  r = await panggil(`${C}/otomasi/eskalasi`, { method: 'POST', token: koord.t, body: { studioId: S } }); cek('Setelah masa tunggu 7 hari terlampaui → eskalasi ulang membuat diskusi baru', r.j.data.diskusi.filter(d => d.judul.includes('UJI-DK QC macet')).length === 1, JSON.stringify(r.j))
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.diskusiKeputusan.deleteMany({ where: { OR: [{ judul: { startsWith: 'UJI-DK' } }, { judul: { contains: 'UJI-DK' } }] } })
  await prisma.logOtomasi.deleteMany({ where: { OR: [{ subjekId: { in: ordersId } }] } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-DK' } })
  if (tahapQc) await prisma.tahapProduksi.deleteMany({ where: { id: tahapQc.id } })
  for (const id of dibuat) { await prisma.pesertaDiskusi.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
