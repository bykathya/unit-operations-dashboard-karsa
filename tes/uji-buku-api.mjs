import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.35.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const B = '/api/circle/buku'
const S = keiko.id, M = '2031-04', M2 = '2031-05'
// Angka Bio (biaya rutin, THP, SHU) ikut dihitung buku besar sejak 12 Nov 2026 — dinolkan sementara agar hitungan eksak, dipulihkan di finally
const { nolkanBio } = await import('./_isolasi-bio.mjs')
const pulihkanBio = await nolkanBio(prisma, [S])
try {
  const koord = await user('bk_koord', [['KOORDINATOR', S]]), koordLain = await user('bk_koord_lain', [['KOORDINATOR', pibi.id]])
  const kar = await user('bk_kar', [['KARYAWAN', S]]), kepala = await user('bk_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]]), adv = await user('bk_adv', [['ADVISOR', null]])

  console.log('— kategori buku besar —')
  let r = await panggil(`${B}/kategori`, { token: kar.t }); cek('Karyawan melihat kategori → 403', r.s === 403)
  r = await panggil(`${B}/kategori`, { token: koord.t }); const kat = r.j.data?.kategori ?? []
  const id = (nama) => kat.find(k => k.nama === nama)?.id
  cek('Kategori bawaan OGS tersedia (≥ 12; income & expense; tetap & variabel)', r.s === 200 && kat.length >= 12 && kat.some(k => k.arus === 'INCOME') && kat.some(k => k.sifat === 'TETAP') && kat.some(k => k.sifat === 'VARIABEL'))
  r = await panggil(`${B}/kategori`, { method: 'POST', token: kepala.t, body: { nama: 'UJI-BK kat', arus: 'INCOME' } }); cek('Kategori baru oleh non-Super → 403', r.s === 403)
  r = await panggil(`${B}/kategori`, { method: 'POST', token: adv.t, body: { nama: 'UJI-BK kat', arus: 'EXPENSE' } }); cek('Pengeluaran tanpa sifat → 422', r.s === 422)
  r = await panggil(`${B}/kategori`, { method: 'POST', token: adv.t, body: { nama: 'UJI-BK kat', arus: 'INCOME' } }); cek('Super Admin membuat kategori', r.s === 201)

  console.log('— menyiapkan sumber data bulan ' + M + ' —')
  await prisma.kategoriBiaya.createMany({ data: [{ nama: 'UJI-BK ops', kategoriLedgerId: id('Biaya Usaha') }, { nama: 'UJI-BK lain' }] })
  const wd = await prisma.penarikanPendapatan.create({ data: { nomor: 'UJI-BK-WD-1', studioId: S, tanggal: new Date('2031-04-05'), jumlah: 3000000, dariPlatform: 'fiverr', bankTujuan: 'UJI-BK Bank', atasNama: 'UJI-BK', bulan: M, status: 'SELESAI' } })
  await prisma.transferPendapatan.createMany({ data: [{ penarikanId: wd.id, studioId: S, tanggal: new Date('2031-04-06'), jumlah: 3000000, dariBank: 'UJI-BK Bank', dariAtasNama: 'UJI-BK', bulan: M, status: 'DITRANSFER' }, { penarikanId: wd.id, studioId: S, tanggal: new Date('2031-04-07'), jumlah: 999, dariBank: 'UJI-BK Bank', dariAtasNama: 'UJI-BK', bulan: M, status: 'MENUNGGU' }] })
  const bi = (kategori, jumlah, persetujuan, hari) => ({ studioId: S, kategori, tanggal: new Date(`2031-04-${hari}`), jumlah, deskripsi: 'UJI-BK ' + kategori + ' ' + persetujuan, persetujuan })
  await prisma.biayaStudio.createMany({ data: [bi('UJI-BK ops', 400000, 'DISETUJUI', '10'), bi('UJI-BK lain', 50000, 'DISETUJUI', '11'), bi('UJI-BK ops', 70000, 'MENUNGGU', '12'), bi('UJI-BK ops', 80000, 'DITOLAK', '13')] })

  console.log('— item tetap —')
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: kar.t, body: { studioId: S, kategoriId: id('Biaya Gaji & Uang Makan'), nama: 'UJI-BK gaji', jumlahBawaan: 1000000 } }); cek('Karyawan menambah item tetap → 403', r.s === 403)
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: koordLain.t, body: { studioId: S, kategoriId: id('Biaya Gaji & Uang Makan'), nama: 'UJI-BK gaji', jumlahBawaan: 1000000 } }); cek('Koordinator unit LAIN menambah item tetap → 403', r.s === 403)
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: kepala.t, body: { studioId: S, kategoriId: id('Biaya Usaha'), nama: 'UJI-BK salah', jumlahBawaan: 1 } }); cek('Item pada kategori VARIABEL → 422', r.s === 422)
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: kepala.t, body: { studioId: S, kategoriId: id('Biaya Gaji & Uang Makan'), nama: 'UJI-BK gaji', jumlahBawaan: 1000000 } }); cek('Kepala Circle menambah item tetap unit', r.s === 201); const itGaji = r.j.data?.id
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: kepala.t, body: { kategoriId: id('Biaya Rumah Tangga'), nama: 'UJI-BK listrik', jumlahBawaan: 200000 } }); cek('Item untuk SEMUA unit oleh Kepala Circle → 403', r.s === 403)
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: adv.t, body: { kategoriId: id('Biaya Rumah Tangga'), nama: 'UJI-BK listrik', jumlahBawaan: 200000 } }); cek('Item global oleh Super Admin', r.s === 201); const itGlobal = r.j.data?.id
  r = await panggil(`${B}/item-tetap/${itGaji}/bulan`, { method: 'PUT', token: koord.t, body: { studioId: S, bulan: M, jumlah: 1200000, catatan: 'naik' } }); cek('Koordinator mengubah jumlah item bulan ini', r.s === 200)
  r = await panggil(`${B}/item-tetap/${itGaji}/bulan`, { method: 'PUT', token: koordLain.t, body: { studioId: S, bulan: M, jumlah: 1 } }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${B}/item-tetap?studioId=${S}&bulan=${M}`, { token: koord.t }); const it = r.j.data?.item?.find(x => x.id === itGaji)
  cek('Daftar item: gaji bulan ini 1.200.000 (diubah), listrik global tampil', it?.jumlahBulanIni === 1200000 && it.jumlahBawaan === 1000000 && it.diubah && r.j.data.item.some(x => x.id === itGlobal && x.global))

  console.log('— entri manual —')
  r = await panggil(`${B}/entri`, { method: 'POST', token: kar.t, body: { studioId: S, kategoriId: id('Pendapatan Lain-lain'), tanggal: '2031-04-15', deskripsi: 'x', jumlah: 1 } }); cek('Karyawan membuat entri → 403', r.s === 403)
  r = await panggil(`${B}/entri`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: 'tidak-ada', tanggal: '2031-04-15', deskripsi: 'x', jumlah: 1 } }); cek('Kategori tak valid → 422', r.s === 422)
  r = await panggil(`${B}/entri`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: id('Pendapatan Lain-lain'), tanggal: '2031-04-15', deskripsi: 'UJI-BK bonus klien', jumlah: 500000 } }); cek('Entri pemasukan manual 500.000', r.s === 201); const eIn = r.j.data?.id
  r = await panggil(`${B}/entri`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: id('Pengeluaran Lain-lain'), tanggal: '2031-04-16', deskripsi: 'UJI-BK lain-lain', jumlah: 100000 } }); cek('Entri pengeluaran manual 100.000', r.s === 201)

  console.log('— ringkasan bulan berjalan (dihitung langsung) —')
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: kar.t }); cek('Karyawan melihat ringkasan → 403', r.s === 403)
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: koord.t }); let d = r.j.data
  cek('Pemasukan = transfer terkirim 3.000.000 + manual 500.000 (transfer MENUNGGU tidak dihitung)', d.masuk === 3500000, String(d.masuk))
  cek('Variabel = biaya disetujui 400.000 + biaya kategori tanpa pemetaan 50.000 (masuk Pengeluaran Lain-lain sejak 12 Nov 2026) + manual 100.000', d.variabel === 550000, String(d.variabel))
  cek('Tetap = gaji 1.200.000 (override) + listrik global 200.000', d.tetap === 1400000, String(d.tetap))
  cek('Keluar 1.950.000, hasil 1.550.000, kas akhir 1.550.000 (kas awal 0)', d.keluar === 1950000 && d.hasil === 1550000 && d.kasAkhir === 1550000 && d.kasAwal === 0, JSON.stringify([d.keluar, d.hasil, d.kasAkhir]))
  cek('Biaya MENUNGGU dilewati (70.000, 1 item); kategori tanpa pemetaan kini dihitung (tak terpetakan 0); DITOLAK tak muncul', d.menungguPersetujuan.jumlah === 70000 && d.menungguPersetujuan.jumlahItem === 1 && d.takTerpetakan.jumlah === 0 && d.takTerpetakan.jumlahItem === 0, JSON.stringify([d.menungguPersetujuan, d.takTerpetakan]))
  cek('Status BERJALAN; Koordinator (CEO unit) bisa tutup bulan, tapi tidak bisa membuka lagi', d.status === 'BERJALAN' && d.bisaTutup === true && d.bisaBukaLagi === false)
  const sblmTutup = await prisma.entriLedger.count({ where: { studioId: S, bulan: M } }); cek('Bulan terbuka TIDAK menulis snapshot (hanya 2 entri manual)', sblmTutup === 2, String(sblmTutup))
  r = await panggil(`${B}/kas-awal`, { method: 'PUT', token: kar.t, body: { studioId: S, bulan: M, jumlah: 10000000 } }); cek('Karyawan mengisi kas awal → 403', r.s === 403)
  r = await panggil(`${B}/kas-awal`, { method: 'PUT', token: koordLain.t, body: { studioId: S, bulan: M, jumlah: 10000000 } }); cek('Koordinator unit LAIN mengisi kas awal → 403', r.s === 403)
  r = await panggil(`${B}/kas-awal`, { method: 'PUT', token: kepala.t, body: { studioId: S, bulan: M, jumlah: 10000000 } }); cek('Kepala Circle mengisi kas awal 10.000.000', r.s === 200)
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: kepala.t }); d = r.j.data; cek('Kas akhir = 11.550.000; Kepala bisa tutup', d.kasAkhir === 11550000 && d.kasAwalDari === 'diisi manual' && d.bisaTutup === true, JSON.stringify([d.kasAkhir, d.kasAwalDari]))
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); const sumber = r.j.data.baris.map(b => b.sumber)
  cek('Rincian memuat WD (penarikan = pemasukan), BIAYA, MANUAL×2, ITEM_TETAP×2', ['WD', 'BIAYA', 'ITEM_TETAP'].every(x => sumber.includes(x)) && sumber.filter(x => x === 'MANUAL').length === 2 && sumber.filter(x => x === 'ITEM_TETAP').length === 2 && r.j.data.baris.length === 7, sumber.join()) // 2 BIAYA: terpetakan + kategori tanpa pemetaan (Pengeluaran Lain-lain)

  console.log('— tutup bulan —')
  r = await panggil(`${B}/tutup`, { method: 'POST', token: kar.t, body: { studioId: S, bulan: M } }); cek('Karyawan menutup → 403', r.s === 403)
  r = await panggil(`${B}/tutup`, { method: 'POST', token: koordLain.t, body: { studioId: S, bulan: M } }); cek('Kepala/koordinator di luar unit → 403', r.s === 403)
  r = await panggil(`${B}/tutup`, { method: 'POST', token: koord.t, body: { studioId: S, bulan: M } }); cek('Koordinator (CEO unit) menutup bulan: kas akhir 11.550.000', r.s === 200 && r.j.data.kasAkhir === 11550000, JSON.stringify(r.j.data))
  const entri = await prisma.entriLedger.findMany({ where: { studioId: S, bulan: M } })
  cek('Snapshot terkunci: 2 manual + 1 transfer + 2 biaya + 2 item = 7 entri, semua terkunci', entri.length === 7 && entri.every(e => e.terkunci))
  r = await panggil(`${B}/tutup`, { method: 'POST', token: kepala.t, body: { studioId: S, bulan: M } }); cek('Tutup dua kali → 409', r.s === 409)
  r = await panggil(`${B}/entri`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: id('Pendapatan Lain-lain'), tanggal: '2031-04-20', deskripsi: 'x', jumlah: 1 } }); cek('Entri baru di bulan ditutup → 409', r.s === 409)
  r = await panggil(`${B}/entri/${eIn}`, { method: 'DELETE', token: koord.t }); cek('Hapus entri di bulan ditutup → 409', r.s === 409)
  r = await panggil(`${B}/item-tetap/${itGaji}/bulan`, { method: 'PUT', token: koord.t, body: { studioId: S, bulan: M, jumlah: 5 } }); cek('Ubah item di bulan ditutup → 409', r.s === 409)
  await prisma.biayaStudio.updateMany({ where: { studioId: S, deskripsi: { startsWith: 'UJI-BK UJI-BK ops MENUNGGU' } }, data: { persetujuan: 'DISETUJUI' } })
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: koord.t }); d = r.j.data
  cek('Bulan ditutup tidak berubah walau sumber berubah (snapshot): status DITUTUP, kas akhir 11.550.000, variabel 550.000', d.status === 'DITUTUP' && d.kasAkhir === 11550000 && d.variabel === 550000 && d.ditutupOleh === 'Uji bk_koord', JSON.stringify([d.status, d.kasAkhir, d.variabel]))
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); cek('Rincian bulan ditutup dari snapshot (7 baris)', r.j.data.ditutup && r.j.data.baris.length === 7)
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M2}`, { token: koord.t }); cek('Bulan berikutnya: kas awal = kas akhir bulan lalu (11.550.000) dari bulan ditutup', r.j.data.kasAwal === 11550000 && r.j.data.kasAwalDari === 'bulan sebelumnya (ditutup)', JSON.stringify([r.j.data.kasAwal, r.j.data.kasAwalDari]))

  console.log('— buka lagi & rantai kas —')
  r = await panggil(`${B}/tutup`, { method: 'POST', token: kepala.t, body: { studioId: S, bulan: M2 } }); cek('Tutup bulan berikutnya', r.s === 200)
  r = await panggil(`${B}/buka-lagi`, { method: 'POST', token: kepala.t, body: { studioId: S, bulan: M } }); cek('Kepala Circle membuka lagi → 403', r.s === 403)
  r = await panggil(`${B}/buka-lagi`, { method: 'POST', token: adv.t, body: { studioId: S, bulan: M } }); cek('Buka lagi saat bulan berikutnya sudah ditutup → 409', r.s === 409, r.j.message)
  r = await panggil(`${B}/buka-lagi`, { method: 'POST', token: adv.t, body: { studioId: S, bulan: M2 } }); cek('Buka bulan berikutnya dulu', r.s === 200)
  r = await panggil(`${B}/buka-lagi`, { method: 'POST', token: adv.t, body: { studioId: S, bulan: M } }); cek('Lalu buka bulan ini', r.s === 200)
  const sesudah = await prisma.entriLedger.findMany({ where: { studioId: S, bulan: M } })
  cek('Snapshot sumber dihapus, tinggal 2 entri manual & tidak terkunci', sesudah.length === 2 && sesudah.every(e => e.sumberTipe === 'MANUAL' && !e.terkunci))
  r = await panggil(`${B}/ringkasan?studioId=${S}&bulan=${M}`, { token: koord.t }); d = r.j.data; cek('Kembali BERJALAN; biaya yang baru disetujui (70.000) kini ikut dihitung → variabel 620.000', d.status === 'BERJALAN' && d.variabel === 620000, JSON.stringify([d.status, d.variabel]))

  console.log('— ringkasan circle —')
  const tokC = (u, cs = 'bloom') => jwt.sign({ id: u.id, aud: 'circle', cs }, process.env.JWT_SECRET, { expiresIn: '10m' })
  r = await panggil(`${B}/ringkasan-circle?bulan=${M}`, { token: kepala.t }); cek('Tanpa alamat circle (alamat Ekosistem) → daftar unit kosong', r.s === 200 && r.j.data.unit.length === 0)
  r = await panggil(`${B}/ringkasan-circle?bulan=${M}`, { token: tokC(kepala), web: 'bloom' }); const rc = r.j.data
  const bar = rc?.unit?.find(u => u.studioId === S)
  cek('Jalur circle: Kepala Circle melihat semua unit Bloom, status circle & total dihitung', r.s === 200 && rc.unit.length >= 2 && !!bar && bar.masuk === 3500000 && bar.status === 'BERJALAN' && rc.statusCircle === 'BERJALAN' && rc.total.masuk >= 3500000, JSON.stringify(bar))
  r = await panggil(`${B}/ringkasan-circle?bulan=${M}`, { token: tokC(koord), web: 'bloom' }); cek('Koordinator hanya melihat unitnya sendiri (Keiko)', r.s === 200 && r.j.data.unit.length === 1 && r.j.data.unit[0].studioId === S)
  r = await panggil(`${B}/ringkasan-circle?bulan=${M}`, { token: tokC(koordLain), web: 'bloom' }); cek('Koordinator circle lain di alamat Bloom → tidak melihat unit Bloom', r.s === 403 || (r.s === 200 && r.j.data.unit.length === 0), String(r.s))
  r = await panggil(`${B}/ringkasan-circle?bulan=${M}`, { token: tokC(kepala, 'naya'), web: 'bloom' }); cek('Token NAYA di alamat Bloom → 403', r.s === 403, String(r.s))
  r = await panggil(`${B}/ringkasan-circle?bulan=2031-13`, { token: kepala.t }); cek('Bulan tidak valid → 422', r.s === 422)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await pulihkanBio()
  await prisma.entriLedger.deleteMany({ where: { studioId: keiko.id, bulan: { in: [M, M2] } } })
  await prisma.statusBulan.deleteMany({ where: { studioId: keiko.id, bulan: { in: [M, M2] } } })
  await prisma.itemTetap.deleteMany({ where: { nama: { startsWith: 'UJI-BK' } } })
  await prisma.kategoriLedger.deleteMany({ where: { nama: { startsWith: 'UJI-BK' } } })
  await prisma.biayaStudio.deleteMany({ where: { deskripsi: { startsWith: 'UJI-BK' } } })
  await prisma.kategoriBiaya.deleteMany({ where: { nama: { startsWith: 'UJI-BK' } } })
  await prisma.penarikanPendapatan.deleteMany({ where: { nomor: 'UJI-BK-WD-1' } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
