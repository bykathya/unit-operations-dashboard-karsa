import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.51.1.${++xff % 250}`, 'X-Unit-Web': web, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], S = keiko.id
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }), tApp: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const orderIds = []
const tg = (u) => ({ token: u.t, web: 'bloom' })
try {
  const koord = await user('ml_koord', [['KOORDINATOR', S]]), kar = await user('ml_kar', [['KARYAWAN', S]]), kepala = await user('ml_kepala', [['KEPALA_CIRCLE', null]]), lain = await user('ml_lain', [['KOORDINATOR', pibi.id]]), adv = await user('ml_adv', [['ADVISOR', null]])
  await prisma.userRole.updateMany({ where: { userId: kepala.id }, data: { circleId: keiko.circleId } })
  const M = `/api/circle/mulai?studioId=${S}`
  console.log('— daftar kesiapan —')
  let r = await panggil(M, tg(kar)); cek('Karyawan (talent) → 200, panduan pribadi tanpa langkah wajib/unit', r.s === 200 && r.j.data.peran === 'talent' && r.j.data.wajib.length === 0 && r.j.data.wajibSelesai === true && r.j.data.unitSiap === undefined && r.j.data.akun === undefined)
  r = await panggil(M, tg(lain)); cek('Koordinator unit lain → 403', r.s === 403)
  r = await panggil(M, tg(koord)); let d = r.j.data
  cek('Koordinator: 3 langkah wajib + langkah disarankan, kompatibel (akun/timTerkonfirmasi/order)', r.s === 200 && d.wajib.length === 3 && d.disarankan.length >= 5 && 'akun' in d && 'timTerkonfirmasi' in d && 'order' in d && d.wajib.map(l => l.kunci).join() === 'tim,akun,alur')
  cek('Tiap langkah punya judul, keterangan, tab tujuan, status, rincian', [...d.wajib, ...d.disarankan].every(l => l.judul && l.ket && l.tab && typeof l.selesai === 'boolean' && l.rinci))
  cek('Koordinator TIDAK menerima bagian lingkup circle / tabel semua unit', d.lingkup === undefined && d.unitSiap === undefined && d.atasan === false)
  console.log('— alur tersimpan di server —')
  r = await panggil('/api/circle/mulai/alur', { method: 'POST', ...tg(kar), body: { studioId: S, setuju: true } }); cek('Karyawan menandai alur → 403', r.s === 403)
  await panggil('/api/circle/mulai/alur', { method: 'POST', ...tg(koord), body: { studioId: S, setuju: false } })
  r = await panggil(M, tg(koord)); cek('Alur belum ditandai', r.j.data.wajib[2].selesai === false && r.j.data.alurDisetujui === false)
  r = await panggil('/api/circle/mulai/alur', { method: 'POST', ...tg(koord), body: { studioId: S, setuju: true } }); cek('Koordinator menandai sesuai → 200', r.s === 200)
  r = await panggil(M, tg(koord)); cek('Tersimpan di server: langkah 3 selesai (tidak bergantung peramban)', r.j.data.wajib[2].selesai === true)
  r = await panggil(M, tg(koord)); const sebelumWajib = r.j.data.wajibSelesai
  await panggil('/api/circle/mulai/alur', { method: 'POST', ...tg(koord), body: { studioId: S, setuju: false } })
  console.log('— langkah dihitung dari data —')
  const sekarang = new Date(Date.now() + 7 * 3600000), tahun = sekarang.getUTCFullYear(), bulan = sekarang.getUTCMonth() + 1
  const tAda = async () => (await prisma.targetOmsetUnit.count({ where: { studioId: S, tahun, bulan } })) + (await prisma.targetOmsetAkun.count({ where: { akunId: { in: (await prisma.akunProduksi.findMany({ where: { studioId: S, namaAkun: { not: 'Order Internal' } }, select: { id: true } })).map(a => a.id) }, tahun, bulan } })) > 0
  const awalTarget = await tAda(); let stT = (await panggil(M, tg(koord))).j.data.disarankan.find(l => l.kunci === 'target')
  cek('Langkah target mengikuti data (sama dengan isi tabel target)', stT.selesai === awalTarget)
  if (!awalTarget) { const tu = await prisma.targetOmsetUnit.create({ data: { studioId: S, tahun, bulan, targetUsd: 100 } }); stT = (await panggil(M, tg(koord))).j.data.disarankan.find(l => l.kunci === 'target'); cek('Setelah target diisi → langkah target selesai', stT.selesai === true); await prisma.targetOmsetUnit.delete({ where: { id: tu.id } }); stT = (await panggil(M, tg(koord))).j.data.disarankan.find(l => l.kunci === 'target'); cek('Target dihapus → kembali belum', stT.selesai === false) }
  // 11 Nov 2026: langkah koordinator diperbarui — lembur fee, Penggajian, Penerbit invoice; Telegram hanya bila pengingat aktif
  let dk = (await panggil(M, tg(koord))).j.data
  cek('Koordinator: ada langkah Penggajian & Penerbit invoice', dk.disarankan.some(l => l.kunci === 'gaji' && l.tab === 'gaji') && dk.disarankan.some(l => l.kunci === 'penerbit' && l.tab === 'tagihan'))
  cek('Langkah lembur menjelaskan fee (bukan per jam)', /fee/.test(dk.disarankan.find(l => l.kunci === 'lembur').ket))
  { const bio = dk.disarankan.find(l => l.kunci === 'bio'), buku = dk.disarankan.find(l => l.kunci === 'buku')
    cek('Langkah Bio studio (sumber gaji/rekening/biaya rutin) ada & tercentang menurut data Bio', !!bio && /Bio studio/.test(bio.ket) && typeof bio.selesai === 'boolean' && /orang ber-THP/.test(bio.rinci), bio?.rinci)
    cek('Langkah saldo awal kas: tercentang hanya dari kas awal (tidak wajib punya biaya rutin circle)', !!buku && /Saldo awal kas/.test(buku.judul) && buku.selesai === (await prisma.statusBulan.count({ where: { studioId: S, OR: [{ kasAwalManual: { not: null } }, { status: 'DITUTUP' }] } }) > 0)) }
  cek(`Langkah Telegram ${process.env.OTOMASI_AKTIF === '1' ? 'tampil (pengingat aktif)' : 'disembunyikan (pengingat belum aktif)'}`, dk.disarankan.some(l => l.kunci === 'telegram') === (process.env.OTOMASI_AKTIF === '1'))
  console.log('— panduan marketer & talent —')
  const mkt = await user('ml_mkt', [['KARYAWAN', S]]); await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  r = await panggil(M, tg(mkt)); let dm = r.j.data
  cek('Marketer → 200, peran marketer, centang akun/presensi/aktivitas/prospek', r.s === 200 && dm.peran === 'marketer' && ['akunSaya', 'presensi', 'aktivitas', 'prospek'].every(k => dm.disarankan.some(l => l.kunci === k)))
  cek('Marketer: panduan memuat order/wakil freelance, update klien, setoran, lembur, slip', ['order', 'updateklien', 'setoran', 'lembur', 'slip'].every(k => dm.panduan.some(l => l.kunci === k)) && /freelance/.test(dm.panduan.find(l => l.kunci === 'order').ket))
  cek('Marketer belum punya akun & belum presensi → belum selesai', dm.disarankan.find(l => l.kunci === 'akunSaya').selesai === false && dm.disarankan.find(l => l.kunci === 'presensi').selesai === false)
  const akunU = await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Fiverr', namaAkun: 'UJI-ML akun ' + Date.now(), feePersen: 20 } })
  await prisma.penugasanAkunMarketer.create({ data: { userId: mkt.id, akunId: akunU.id } })
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  await prisma.kehadiranEvent.create({ data: { userId: mkt.id, tanggalKerja: new Date(hariIni + 'T00:00:00Z'), jenis: 'MASUK', modeKerja: 'WFO' } })
  dm = (await panggil(M, tg(mkt))).j.data
  cek('Setelah akun ditugaskan & presensi masuk → dua langkah tercentang otomatis', dm.disarankan.find(l => l.kunci === 'akunSaya').selesai === true && dm.disarankan.find(l => l.kunci === 'presensi').selesai === true && dm.disarankanSelesai >= 2)
  const dt = (await panggil(M, tg(kar))).j.data
  cek('Talent: presensi + panduan tugas/lembur/slip, tanpa menu marketer', dt.disarankan.some(l => l.kunci === 'presensi') && ['tugas', 'lembur', 'slip'].every(k => dt.panduan.some(l => l.kunci === k)) && !dt.panduan.some(l => l.kunci === 'setoran') && !dt.disarankan.some(l => l.kunci === 'aktivitas'))
  cek('Panduan pribadi tanpa angka uang', !/Rp|\$/.test(JSON.stringify(dm) + JSON.stringify(dt)))
  await prisma.kehadiranEvent.deleteMany({ where: { userId: mkt.id } }); await prisma.penugasanAkunMarketer.deleteMany({ where: { userId: mkt.id } }); await prisma.akunProduksi.delete({ where: { id: akunU.id } }); await prisma.fungsiAnggota.deleteMany({ where: { userId: mkt.id } })
  console.log('— tampilan Kepala Circle —')
  r = await panggil(M, tg(kepala)); cek('Kepala Circle melihat lingkup circle (3 hal) dan tabel kesiapan unit', r.s === 200 && r.j.data.lingkup?.length === 3 && r.j.data.lingkup.map(l => l.kunci).join() === 'libur,pemetaan,targetSemua' && Array.isArray(r.j.data.unitSiap) && r.j.data.unitSiap.some(u => u.studioId === S))
  cek('Tabel unit memuat angka akun / anggota / konfirmasi tim / alur / target', r.j.data.unitSiap.every(u => 'akun' in u && 'anggota' in u && 'timOk' in u && 'alur' in u && 'target' in u && typeof u.siap === 'boolean'))
  cek('Unit yang belum siap diurutkan paling atas', (() => { const l = r.j.data.unitSiap.map(u => u.siap); const i = l.indexOf(true); return i === -1 || l.slice(i).every(Boolean) })())
  console.log('— Telegram dari web circle —')
  const T = '/api/circle/telegram'
  r = await panggil(T, tg(lain)); cek('Status Telegram milik sendiri: belum tertaut', r.s === 200 && r.j.data.tertaut === false)
  r = await panggil(`${T}/kode`, { method: 'POST', ...tg(lain) }); const kode = r.j.data?.kode
  cek('Kode 8 karakter tanpa huruf/angka membingungkan, masa berlaku ±10 menit', r.s === 201 || r.s === 200, String(r.s)); cek('Format kode', /^[A-HJKMNP-Z2-9]{8}$/.test(kode ?? ''))
  const row = await prisma.user.findUnique({ where: { id: lain.id }, select: { telegramKodeHash: true, telegramKodeKadaluarsa: true } })
  cek('Database hanya menyimpan hash (bukan kode mentah), kedaluwarsa ≤ 10 menit', row.telegramKodeHash && row.telegramKodeHash !== kode && !row.telegramKodeHash.includes(kode) && row.telegramKodeKadaluarsa - Date.now() <= 10 * 60 * 1000 + 5000)
  r = await panggil(T, tg(lain)); cek('Status: kode aktif', r.j.data.kodeAktif === true)
  let tolak = 0; for (let i = 0; i < 6; i++) { const x = await panggil(`${T}/kode`, { method: 'POST', ...tg(lain) }); if (x.s === 429) tolak++ }
  cek('Batas 5 permintaan kode / 15 menit per akun (selebihnya 429)', tolak >= 1)
  r = await panggil(T, { method: 'DELETE', ...tg(lain) }); cek('Putuskan tautan → 200', r.s === 200)
  r = await panggil(T, tg(lain)); cek('Setelah diputus: kode hangus, belum tertaut', r.j.data.tertaut === false && r.j.data.kodeAktif === false)
  console.log('— Beranda mengingatkan Telegram —')
  const aktif = process.env.OTOMASI_AKTIF === '1'
  r = await panggil('/api/circle/beranda?studioId=' + S, tg(koord)); cek(aktif ? 'Beranda koordinator yang belum menautkan memuat "Telegram belum tertaut"' : 'Pengingat belum aktif → Beranda TIDAK mengingatkan Telegram', r.j.data.perhatian.some(p => p.kunci === 'telegram') === aktif)
  await prisma.user.update({ where: { id: koord.id }, data: { telegramId: '8' + Date.now().toString().slice(-9) } })
  r = await panggil('/api/circle/beranda?studioId=' + S, tg(koord)); cek('Setelah tertaut, pengingat itu hilang', !r.j.data.perhatian.some(p => p.kunci === 'telegram'))
  console.log('— menyamar tidak boleh mengubah Telegram orang —')
  const imp = (await panggil('/api/circle/impersonasi', { method: 'POST', ...tg(adv), body: { userId: kar.id, alasan: 'uji' } })).j.data?.accessToken
  r = await panggil(`${T}/kode`, { method: 'POST', token: imp, web: 'bloom' }); cek('Saat menyamar tidak bisa membuat kode Telegram → 403', r.s === 403)
  r = await panggil(T, { method: 'DELETE', token: imp, web: 'bloom' }); cek('Saat menyamar tidak bisa memutus Telegram → 403', r.s === 403)
  void sebelumWajib
} finally {
  await prisma.pengaturanPenugasan.updateMany({ where: { studioId: S }, data: { alurDisetujui: false } })
  await prisma.logImpersonasi.deleteMany({ where: { adminId: { in: dibuat } } })
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.user.deleteMany({ where: { id: { in: dibuat } } })
  await prisma.$disconnect()
}
console.log(gagal ? `\n❌ ${gagal} gagal` : '\n✅ semua lulus'); process.exit(gagal ? 1 : 0)
