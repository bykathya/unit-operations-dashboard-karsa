import { DASH } from './_jalur.mjs'
// Uji perbaikan audit keamanan & pipeline (21 Okt 2026): wewenang PER UNIT, talent tanpa uang, Payroll terkunci per unit,
// persetujuan biaya, bulan tertutup, menyamar, privasi check-in, akun jualan wajib. Membuat akun & data sementara lalu menghapusnya.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.36.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const tokenCircle = (id, extra = {}) => jwt.sign({ id, aud: 'circle', cs: 'bloom', ...extra }, process.env.JWT_SECRET, { expiresIn: '10m' })
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }), c: tokenCircle(u.id) } }
const S = keiko.id, BULAN_TUTUP = '2031-05'
let akunFee, orderUji
try {
  // Koordinator di Pibi, hanya KADER di Keiko — sebelumnya dianggap pengelola Keiko juga
  const campur = await user('pa_campur', [['KOORDINATOR', pibi.id], ['KADER', keiko.id]])
  const kader = await user('pa_kader', [['KADER', keiko.id]])
  const koord = await user('pa_koord', [['KOORDINATOR', keiko.id]])
  const kepala = await user('pa_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]])
  const kepalaLain = await user('pa_kepala_lain', [['KEPALA_CIRCLE', null, pibi.circleId], ['KARYAWAN', keiko.id]])
  const adv = await user('pa_adv', [['ADVISOR', null]])
  akunFee = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-PA fiverr', feePersen: 0.2 } })

  console.log('— wewenang PER UNIT: Koordinator unit lain yang hanya Kader di sini —')
  let r = await panggil(`/api/circle/papan?studioId=${S}`, { token: campur.c, web: 'bloom' }); cek('Papan penuh Keiko → 403 (bukan mode kelola)', r.s === 403)
  r = await panggil(`/api/circle/kas/biaya?studioId=${S}`, { token: campur.c, web: 'bloom' }); cek('Biaya Keiko → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/x/detail`, { token: campur.c, web: 'bloom' }); cek('(kontrol) order tak dikenal → 403', r.s === 403)
  r = await panggil(`/api/payroll/generate?studioId=${S}&bulan=5&tahun=2031`, { method: 'POST', token: campur.t }); cek('Ekosistem Payroll: generate gaji Keiko → 403', r.s === 403)
  r = await panggil(`/api/payroll?studioId=${S}&bulan=5&tahun=2031`, { token: campur.t }); cek('Ekosistem Payroll: daftar gaji Keiko hanya miliknya sendiri', r.s === 200 && r.j.data.every(p => p.userId === campur.id))
  r = await panggil(`/api/pengeluaran?studioId=${S}&dari=2031-05-01&sampai=2031-05-31`, { token: campur.t }); cek('Ekosistem Pengeluaran Keiko → 403', r.s === 403)
  r = await panggil(`/api/weekly-reports`, { method: 'POST', token: campur.t, body: { studioId: S, periodeAwal: '2031-05-05', kurs: 16000 } }); cek('Ekosistem Laporan Omset Keiko → 403', r.s === 403)
  r = await panggil(`/api/payroll/generate?studioId=${pibi.id}&bulan=5&tahun=2031`, { method: 'POST', token: campur.t }); cek('Ekosistem Payroll kini hanya memantau (18 Nov 2026): generate ditolak untuk siapa pun → 403', r.s === 403)
  await prisma.penggajian.deleteMany({ where: { studioId: pibi.id, bulan: 5, tahun: 2031 } })

  console.log('— Payroll: tidak ada lagi daftar lintas studio —')
  r = await panggil(`/api/payroll/lembur`, { token: koord.t }); cek('Catatan lembur tanpa studioId → 422', r.s === 422)
  r = await panggil(`/api/payroll/lembur?studioId=${pibi.id}`, { token: koord.t }); cek('Koordinator Keiko melihat lembur Pibi → 403', r.s === 403)
  r = await panggil(`/api/payroll/rate-card?studioId=${pibi.id}`, { token: koord.t }); cek('Rate card Ekosistem sudah dihapus (penggajian di web circle) → 404', r.s === 404)
  r = await panggil(`/api/payroll/tunjangan-template?studioId=${pibi.id}`, { token: koord.t }); cek('Template tunjangan Ekosistem sudah dihapus → 404', r.s === 404)
  r = await panggil(`/api/payroll/lembur?studioId=${S}`, { token: koord.t }); cek('(kontrol) lembur Keiko oleh Koordinator Keiko → 200', r.s === 200)

  console.log('— talent tidak melihat uang —')
  r = await panggil(`/api/circle/keuangan/bulanan`, { token: kader.c, web: 'bloom' }); cek('Kader: Laporan Omset bulanan (web circle) → 403', r.s === 403)
  r = await panggil(`/api/circle/keuangan/status`, { token: kader.c, web: 'bloom' }); cek('Kader: status laporan → 403', r.s === 403)
  r = await panggil(`/api/masterdata/studios/${S}/rekening`, { token: kader.t }); cek('Ekosistem: Kader membuka rekening unitnya → 403', r.s === 403)
  r = await panggil(`/api/circle/keuangan/bulanan`, { token: campur.c, web: 'bloom' })
  cek('Koordinator Pibi (Kader di Keiko): omset Keiko TIDAK ikut', r.s === 200 && !r.j.data.studios.some(s => s.id === S), String(r.s))
  r = await panggil(`/api/circle/keuangan/bulanan`, { token: koord.c, web: 'bloom' }); cek('(kontrol) Koordinator Keiko melihat omset Keiko', r.s === 200 && r.j.data.studios.some(s => s.id === S))

  console.log('— Kepala Circle hanya untuk circle-nya —')
  r = await panggil(`/api/circle/riwayat-login`, { token: kepalaLain.c, web: 'bloom' }); cek('Kepala Circle circle lain (Karyawan di Bloom): riwayat login Bloom → 403', r.s === 403)
  r = await panggil(`/api/circle/riwayat-login`, { token: kepala.c, web: 'bloom' }); cek('(kontrol) Kepala Circle Bloom → 200', r.s === 200)

  console.log('— persetujuan biaya —')
  const dasar = { studioId: S, kategori: 'UJI-PA sewa', tanggal: '2031-04-10', jumlah: 300000, deskripsi: 'UJI-PA biaya' }
  r = await panggil(`/api/circle/kas/biaya`, { method: 'POST', token: koord.c, web: 'bloom', body: dasar }); const b1 = r.j.data?.id; cek('Koordinator mencatat biaya', r.s === 201)
  r = await panggil(`/api/circle/kas/biaya/${b1}/bayar`, { method: 'POST', token: koord.c, web: 'bloom', body: { status: 'LUNAS' } }); cek('Bayar sebelum disetujui → 409', r.s === 409)
  r = await panggil(`/api/circle/kas/biaya/${b1}/setuju`, { method: 'POST', token: kepala.c, web: 'bloom', body: { status: 'DISETUJUI' } }); cek('Kepala Circle menyetujui', r.s === 200)
  r = await panggil(`/api/circle/kas/biaya/${b1}`, { method: 'PATCH', token: koord.c, web: 'bloom', body: { jumlah: 900000 } }); cek('Koordinator (CEO unit) mengubah biaya yang disetujui → tetap DISETUJUI (ia sendiri penyetujunya)', r.s === 200 && r.j.data.persetujuan === 'DISETUJUI')
  r = await panggil(`/api/circle/kas/biaya/${b1}/setuju`, { method: 'POST', token: kepalaLain.c, web: 'bloom', body: { status: 'DISETUJUI' } }); cek('Kepala Circle circle lain tidak bisa menyetujui → 403', r.s === 403)

  console.log('— bulan tertutup mengunci sumbernya —')
  await prisma.statusBulan.create({ data: { studioId: S, bulan: BULAN_TUTUP, status: 'DITUTUP', kasAwal: 0, masuk: 0, variabel: 0, tetap: 0, kasAkhir: 0, ditutupPada: new Date(), ditutupOleh: 'UJI-PA' } })
  r = await panggil(`/api/circle/kas/biaya`, { method: 'POST', token: koord.c, web: 'bloom', body: { ...dasar, tanggal: `${BULAN_TUTUP}-10` } }); cek('Biaya baru di bulan tertutup → 409', r.s === 409, r.j.message)
  r = await panggil(`/api/circle/kas/biaya/${b1}`, { method: 'PATCH', token: koord.c, web: 'bloom', body: { tanggal: `${BULAN_TUTUP}-11` } }); cek('Memindah biaya ke bulan tertutup → 409', r.s === 409)

  console.log('— menyamar —')
  const imp = tokenCircle(koord.id, { imp: adv.id })
  r = await panggil(`/api/circle/kehadiran/lembur`, { method: 'POST', token: imp, web: 'bloom', body: { mulai: '18:00', selesai: '20:00', catatan: 'uji' } }); cek('Saat menyamar: catat lembur → 403', r.s === 403 && /menyamar/.test(r.j.message ?? ''))
  r = await panggil(`/api/circle/kas/biaya`, { method: 'POST', token: imp, web: 'bloom', body: dasar }); cek('Saat menyamar: catat biaya → 403', r.s === 403)
  r = await panggil(`/api/circle/saya`, { token: imp, web: 'bloom' }); cek('(kontrol) saat menyamar: melihat tetap boleh', r.s === 200)

  console.log('— privasi check-in —')
  await prisma.checkInHarian.create({ data: { userId: kader.id, tanggal: new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00.000Z'), status: 'DIISI', emosi: Object.keys((await import(DASH + '/server/src/utils/kehadiran.js')).EMOSI)[0], intensitas: 3, kejernihan: 3, fokusPikiran: Object.keys((await import(DASH + '/server/src/utils/kehadiran.js')).FOKUS_PIKIRAN)[0], kebutuhan: Object.keys((await import(DASH + '/server/src/utils/kehadiran.js')).KEBUTUHAN)[0] } })
  r = await panggil(`/api/circle/checkin/tim?studioId=${S}`, { token: koord.c, web: 'bloom' })
  cek('Hanya 1 pengisi: ringkasan emosi disembunyikan', r.s === 200 && r.j.data.ringkasanDisembunyikan === true && r.j.data.emosi.length === 0 && r.j.data.rataIntensitas === null, String(r.s))

  console.log('— akun jualan wajib & ganti akun —')
  r = await panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, web: 'bloom', body: { studioId: S, judul: 'UJI-PA order', klien: 'UJI-PA k', nilaiDisepakati: 100000 } }); cek('Order tanpa akun → 422', r.s === 422)
  r = await panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, web: 'bloom', body: { studioId: S, judul: 'UJI-PA order', klien: 'UJI-PA k', nilaiDisepakati: 100000, akunId: pibi.id } }); cek('Akun bukan milik unit → 422', r.s === 422)
  r = await panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, web: 'bloom', body: { studioId: S, judul: 'UJI-PA order', klien: 'UJI-PA k', nilaiDisepakati: 100000, akunId: 'INTERNAL', deadline: '31-12-2031' } }); cek('Deadline salah format → 422 (bukan 500)', r.s === 422)
  r = await panggil(`/api/circle/orders`, { method: 'POST', token: koord.c, web: 'bloom', body: { studioId: S, judul: 'UJI-PA order', klien: 'UJI-PA k', nilaiDisepakati: 100000, akunId: 'INTERNAL' } }); orderUji = r.j.data?.id; cek('Order internal (tanpa platform) → 201', r.s === 201)
  r = await panggil(`/api/circle/orders/${orderUji}`, { method: 'PATCH', token: koord.c, web: 'bloom', body: { akunId: akunFee.id } }); const o = await prisma.orderProduksi.findUnique({ where: { id: orderUji } })
  cek('Ganti akun ke Fiverr fee 20% → nilai bersih dihitung ulang 80.000', r.s === 200 && o.akunId === akunFee.id && Math.round(o.nilaiBersih) === 80000)
  const audit = await prisma.auditOrder.findMany({ where: { orderId: orderUji, field: 'akun' } }); cek('Audit mencatat pergantian akun', audit.length === 1 && audit[0].ke === 'UJI-PA fiverr')
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  if (orderUji) await prisma.orderProduksi.deleteMany({ where: { id: orderUji } })
  await prisma.biayaStudio.deleteMany({ where: { deskripsi: 'UJI-PA biaya' } })
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: BULAN_TUTUP, ditutupOleh: 'UJI-PA' } })
  await prisma.checkInHarian.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.logLogin.deleteMany({ where: { userId: { in: dibuat } } })
  if (akunFee) await prisma.akunProduksi.deleteMany({ where: { id: akunFee.id } })
  for (const id of dibuat) { await prisma.penggajian.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
