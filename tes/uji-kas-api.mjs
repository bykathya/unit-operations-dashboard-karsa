import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.34.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId, circleId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null, circleId: circleId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const B = '/api/circle/kas'
let akunUji
try {
  const koord = await user('ks_koord', [['KOORDINATOR', keiko.id]]), koordLain = await user('ks_koord_lain', [['KOORDINATOR', pibi.id]])
  const kar = await user('ks_kar', [['KARYAWAN', keiko.id]]), kepala = await user('ks_kepala', [['KEPALA_CIRCLE', null, keiko.circleId]]), adv = await user('ks_adv', [['ADVISOR', null]])
  akunUji = await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Fiverr', namaAkun: 'UJI-KS akun', feePersen: 0.2 } })
  await prisma.kategoriBiaya.create({ data: { nama: 'UJI-KS mgmt', khususManajemen: true } })
  const S = keiko.id

  console.log('— BIAYA: hak akses & validasi —')
  let r = await panggil(`${B}/biaya?studioId=${S}`, { token: kar.t }); cek('Karyawan melihat biaya → 403', r.s === 403)
  r = await panggil(`${B}/biaya?studioId=${S}`, { token: koordLain.t }); cek('Koordinator circle lain → 403', r.s === 403)
  const dasar = { studioId: S, kategori: 'UJI-KS sewa', tanggal: '2031-03-10', jumlah: 500000, deskripsi: 'UJI-KS biaya 1' }
  for (const [label, ubah, kode] of [['Kategori kosong', { kategori: '' }, 422], ['Jumlah 0', { jumlah: 0 }, 422], ['Tanggal salah', { tanggal: '10-03-2031' }, 422], ['Tautan javascript: ditolak', { linkInvoice: 'javascript:alert(1)' }, 422], ['Tautan file ditolak', { linkDrive: 'file:///etc/passwd' }, 422], ['Jumlah negatif', { jumlah: -5 }, 422]]) {
    r = await panggil(`${B}/biaya`, { method: 'POST', token: koord.t, body: { ...dasar, ...ubah } }); cek(`${label} → ${kode}`, r.s === kode, String(r.s))
  }
  r = await panggil(`${B}/biaya`, { method: 'POST', token: kepala.t, body: { ...dasar, kategori: 'UJI-KS mgmt', deskripsi: 'UJI-KS mgmt biaya' } }); cek('Kepala Circle boleh memakai kategori khusus manajemen', r.s === 201)
  r = await panggil(`${B}/biaya`, { method: 'POST', token: koord.t, body: { ...dasar, linkInvoice: 'https://drive.google.com/uji', jatuhTempo: '2031-03-20' } }); cek('Koordinator mencatat biaya → MENUNGGU/BELUM', r.s === 201 && r.j.data.persetujuan === 'MENUNGGU' && r.j.data.statusBayar === 'BELUM', JSON.stringify(r.j.data)?.slice(0, 100))
  const b1 = r.j.data?.id
  r = await panggil(`${B}/biaya?studioId=${S}&bulan=2031-03`, { token: koord.t }); cek('Daftar + ringkasan; Koordinator (CEO unit) juga melihat kategori khusus manajemen & bisa menyetujui', r.s === 200 && r.j.data.biaya.length === 2 && r.j.data.ringkasan.total === 1000000 && r.j.data.kategori.some(k => k.nama === 'UJI-KS mgmt') && r.j.data.bisaSetuju === true)
  r = await panggil(`${B}/biaya?studioId=${S}&bulan=2031-03`, { token: kepala.t }); cek('Kepala Circle melihat kategori khusus manajemen', r.j.data.kategori.some(k => k.nama === 'UJI-KS mgmt') && r.j.data.bisaSetuju === true)

  console.log('— BIAYA: persetujuan, bayar, kunci —')
  r = await panggil(`${B}/biaya/${b1}/setuju`, { method: 'POST', token: koordLain.t, body: { status: 'DISETUJUI' } }); cek('Koordinator unit LAIN menyetujui → 403', r.s === 403)
  r = await panggil(`${B}/biaya/${b1}/setuju`, { method: 'POST', token: kar.t, body: { status: 'DISETUJUI' } }); cek('Karyawan menyetujui → 403', r.s === 403)
  r = await panggil(`${B}/biaya/${b1}/setuju`, { method: 'POST', token: kepala.t, body: { status: 'ASAL' } }); cek('Status tak dikenal → 422', r.s === 422)
  r = await panggil(`${B}/biaya/${b1}/setuju`, { method: 'POST', token: kepala.t, body: { status: 'DISETUJUI' } }); cek('Kepala Circle menyetujui', r.s === 200 && r.j.data.persetujuan === 'DISETUJUI')
  r = await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'SEBAGIAN', jumlahDibayar: 500000 } }); cek('Sebagian ≥ jumlah → 422', r.s === 422)
  r = await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'SEBAGIAN', jumlahDibayar: 200000, dibayarPada: '2031-03-11' } }); cek('Bayar sebagian 200.000', r.s === 200 && r.j.data.statusBayar === 'SEBAGIAN' && r.j.data.jumlahDibayar === 200000)
  r = await panggil(`${B}/biaya?studioId=${S}&bulan=2031-03`, { token: koord.t }); cek('Ringkasan: dibayar 200.000, belum 800.000', r.j.data.ringkasan.dibayar === 200000 && r.j.data.ringkasan.belumDibayar === 800000, JSON.stringify(r.j.data.ringkasan))
  r = await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'LUNAS', dibayarPada: '2031-03-11' } }); cek('Lunas: jumlahDibayar = jumlah, tanggal terisi', r.s === 200 && r.j.data.jumlahDibayar === 500000 && r.j.data.dibayarPada === '2031-03-11')
  r = await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'BELUM' } }); cek('Kembali BELUM mengosongkan pembayaran', r.j.data.statusBayar === 'BELUM' && r.j.data.jumlahDibayar === null)
  await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'LUNAS', dibayarPada: '2031-03-11' } })
  r = await panggil(`${B}/biaya/${b1}/kunci`, { method: 'POST', token: koordLain.t, body: { terkunci: true } }); cek('Koordinator unit LAIN mengunci → 403', r.s === 403)
  r = await panggil(`${B}/biaya/${b1}/kunci`, { method: 'POST', token: kepala.t, body: { terkunci: true } }); cek('Kepala Circle mengunci', r.s === 200 && r.j.data.terkunci)
  r = await panggil(`${B}/biaya/${b1}`, { method: 'PATCH', token: koord.t, body: { jumlah: 1 } }); cek('Biaya terkunci tidak bisa diubah → 409', r.s === 409)
  r = await panggil(`${B}/biaya/${b1}/bayar`, { method: 'POST', token: koord.t, body: { status: 'BELUM' } }); cek('Biaya terkunci tidak bisa diubah status bayarnya → 409', r.s === 409)
  r = await panggil(`${B}/biaya/${b1}`, { method: 'DELETE', token: koordLain.t }); cek('Koordinator unit LAIN menghapus biaya → 403', r.s === 403)
  r = await panggil(`${B}/kategori-biaya`, { method: 'POST', token: kepala.t, body: { nama: 'UJI-KS kat' } }); cek('Kategori baru oleh non-Super → 403', r.s === 403)
  r = await panggil(`${B}/kategori-biaya`, { method: 'POST', token: adv.t, body: { nama: 'UJI-KS kat' } }); cek('Super Admin membuat kategori', r.s === 201)

  console.log('— PENDAPATAN: penarikan → transfer → konfirmasi —')
  const wdBody = { studioId: S, akunId: akunUji.id, tanggal: '2031-03-12', jumlah: 3000000, dariPlatform: 'fiverr', bankTujuan: 'UJI-KS Bank', atasNama: 'UJI-KS Pemilik' }
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: kar.t, body: wdBody }); cek('Karyawan membuat penarikan → 403', r.s === 403)
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: koordLain.t, body: wdBody }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: koord.t, body: { ...wdBody, dariPlatform: 'tiktok' } }); cek('Platform tak dikenal → 422', r.s === 422)
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: koord.t, body: { ...wdBody, akunId: 'akun-orang-lain' } }); cek('Akun bukan milik unit → 422', r.s === 422)
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: koord.t, body: wdBody }); const wd = r.j.data
  cek('Penarikan dibuat dengan nomor WD-203103-####, status MENUNGGU', r.s === 201 && /^WD-203103-\d{4}$/.test(wd.nomor) && wd.status === 'MENUNGGU', wd?.nomor)
  r = await panggil(`${B}/penarikan`, { method: 'POST', token: koord.t, body: wdBody }); cek('Penarikan kedua bernomor berbeda', r.s === 201 && r.j.data.nomor !== wd.nomor)
  r = await panggil(`${B}/transfer`, { method: 'POST', token: koord.t, body: { penarikanId: wd.id, tanggal: '2031-03-13', jumlah: 2900000 } }); const tf = r.j.data
  cek('Transfer dibuat (jumlah boleh beda), default bank dari penarikan', r.s === 201 && tf.status === 'MENUNGGU' && tf.dariBank === 'UJI-KS Bank' && tf.keRekening === 'Kas pusat')
  r = await panggil(`${B}/transfer/${tf.id}/konfirmasi`, { method: 'POST', token: koord.t }); cek('Konfirmasi oleh koordinator → 403', r.s === 403)
  r = await panggil(`${B}/transfer/${tf.id}/konfirmasi`, { method: 'POST', token: adv.t }); cek('Konfirmasi saat masih MENUNGGU → 422', r.s === 422)
  r = await panggil(`${B}/transfer/${tf.id}/terkirim`, { method: 'POST', token: koord.t }); cek('Tandai terkirim', r.s === 200)
  let w = await prisma.penarikanPendapatan.findUnique({ where: { id: wd.id } }); cek('Penarikan otomatis SELESAI', w.status === 'SELESAI')
  r = await panggil(`${B}/penarikan/${wd.id}`, { method: 'PATCH', token: koord.t, body: { jumlah: 1 } }); cek('Penarikan SELESAI tidak bisa diubah → 409', r.s === 409)
  r = await panggil(`${B}/transfer/${tf.id}/terkirim`, { method: 'POST', token: koord.t }); cek('Terkirim dua kali → 422', r.s === 422)
  r = await panggil(`${B}/transfer/${tf.id}/konfirmasi`, { method: 'POST', token: adv.t }); cek('Super Admin mengonfirmasi', r.s === 200)
  r = await panggil(`${B}/transfer/${tf.id}`, { method: 'PATCH', token: koord.t, body: { jumlah: 1 } }); cek('Transfer dikonfirmasi tidak bisa diubah → 409', r.s === 409)
  r = await panggil(`${B}/transfer/${tf.id}`, { method: 'DELETE', token: koord.t }); cek('Transfer dikonfirmasi tidak bisa dihapus → 409', r.s === 409)
  // transfer kedua dihapus → penarikan kembali MENUNGGU
  const wd2 = (await panggil(`${B}/penarikan`, { method: 'POST', token: koord.t, body: wdBody })).j.data
  const tf2 = (await panggil(`${B}/transfer`, { method: 'POST', token: koord.t, body: { penarikanId: wd2.id, tanggal: '2031-03-13', jumlah: 1000 } })).j.data
  await panggil(`${B}/transfer/${tf2.id}/terkirim`, { method: 'POST', token: koord.t })
  // paksa kembali: hapus tidak diizinkan saat DITRANSFER? OGS membolehkan hapus selain received → penarikan kembali MENUNGGU
  r = await panggil(`${B}/transfer/${tf2.id}`, { method: 'DELETE', token: koord.t }); w = await prisma.penarikanPendapatan.findUnique({ where: { id: wd2.id } })
  cek('Hapus transfer terkirim → penarikan kembali MENUNGGU', r.s === 200 && w.status === 'MENUNGGU')
  r = await panggil(`${B}/penarikan/${wd2.id}`, { method: 'DELETE', token: koord.t }); cek('Hapus penarikan MENUNGGU', r.s === 200)

  console.log('— PENDAPATAN: dana tertahan —')
  const hdBody = { studioId: S, tanggal: '2031-03-14', jumlah: 750000, bank: 'UJI-KS Bank', atasNama: 'UJI-KS Pemilik', dariPlatform: 'vgen' }
  r = await panggil(`${B}/tertahan`, { method: 'POST', token: koord.t, body: { ...hdBody, linkDrive: 'javascript:1' } }); cek('Tautan tidak sah → 422', r.s === 422)
  r = await panggil(`${B}/tertahan`, { method: 'POST', token: koord.t, body: hdBody }); const hd = r.j.data; cek('Dana tertahan dicatat HD-203103-####', r.s === 201 && /^HD-203103-\d{4}$/.test(hd.nomor) && hd.status === 'TERTAHAN')
  r = await panggil(`${B}/tertahan/${hd.id}/lepas`, { method: 'POST', token: koord.t, body: { tanggal: '2031-03-18', jumlah: 700000 } }); cek('Lepas → tercatat sebagai penarikan Rp700.000 (tanpa transfer ke kas pusat)', r.s === 200 && !!r.j.data.penarikanId && (await prisma.penarikanPendapatan.findUnique({ where: { id: r.j.data.penarikanId } }))?.jumlah === 700000, JSON.stringify(r.j))
  const hd2 = await prisma.pendapatanTertahan.findUnique({ where: { id: hd.id } }); cek('Tertahan DILEPAS, terhubung ke penarikan baru, tanpa transfer', hd2.status === 'DILEPAS' && !hd2.transferId && !!hd2.penarikanId)
  r = await panggil(`${B}/tertahan/${hd.id}/lepas`, { method: 'POST', token: koord.t, body: {} }); cek('Lepas dua kali → 422', r.s === 422)
  r = await panggil(`${B}/tertahan/${hd.id}`, { method: 'DELETE', token: koord.t }); cek('Hapus yang sudah dilepas → 409', r.s === 409)
  r = await panggil(`${B}/pendapatan?studioId=${S}&bulan=2031-03`, { token: koord.t }); cek('Ringkasan pendapatan memuat penarikan & tertahan (transfer lama tetap terbaca server)', r.s === 200 && r.j.data.penarikan.length >= 2 && r.j.data.transfer.length >= 1 && r.j.data.ringkasan.transferDikonfirmasi === 2900000 && r.j.data.bisaKonfirmasi === false, JSON.stringify(r.j.data.ringkasan))
  r = await panggil(`${B}/saldo-platform`, { method: 'PUT', token: koord.t, body: { studioId: S, bulan: '2031-03', platform: 'fiverr', jumlah: 1234567 } }); cek('Simpan saldo platform', r.s === 200)
  r = await panggil(`${B}/saldo-platform?studioId=${S}&bulan=2031-03`, { token: koord.t }); cek('Baca saldo platform', r.j.data.saldo.find(x => x.platform === 'fiverr').jumlah === 1234567)

  console.log('— KAS PUSAT: hanya Super Admin —')
  for (const [m, p] of [['GET', '/dompet'], ['GET', '/mutasi?bulan=2031-03'], ['GET', '/saldo-bank?bulan=2031-03'], ['GET', '/rekon/ringkasan?bulan=2031-03']]) { r = await panggil(B + p, { method: m, token: kepala.t }); cek(`${m} ${p.split('?')[0]} oleh Kepala Circle → 403`, r.s === 403) }
  r = await panggil(`${B}/dompet`, { method: 'PUT', token: adv.t, body: { kode: 'UJI-KS', nama: 'Dompet uji', tipe: 'BANK', akhiran: '12345' } }); cek('Nomor rekening >4 digit ditolak (tidak boleh simpan nomor lengkap)', r.s === 422)
  r = await panggil(`${B}/dompet`, { method: 'PUT', token: adv.t, body: { kode: 'UJI-KS', nama: 'Dompet uji', tipe: 'BANK', akhiran: '8037', pemegang: 'UJI-KS' } }); cek('Dompet dibuat (4 digit akhir)', r.s === 201)
  const dompet = await prisma.dompetKas.findUnique({ where: { kode: 'UJI-KS' } })
  const bar = (o) => ({ tanggal: '2031-03-14', arah: 'CR', jumlah: 2900000, deskripsi: 'UJI-KS masuk transfer', ...o })
  r = await panggil(`${B}/mutasi/impor`, { method: 'POST', token: adv.t, body: { dompetId: dompet.id, baris: [bar({ arah: 'XX' })] } }); cek('Arah salah → 422', r.s === 422)
  r = await panggil(`${B}/mutasi/impor`, { method: 'POST', token: adv.t, body: { dompetId: dompet.id, baris: [bar({ tanggal: '14/03/2031' })] } }); cek('Tanggal salah → 422', r.s === 422)
  const baris = [bar({}), bar({ tanggal: '2031-03-12', arah: 'DB', jumlah: 500000, deskripsi: 'UJI-KS bayar biaya' }), bar({ tanggal: '2031-03-01', jumlah: 9000000, tipe: 'OPENING', deskripsi: 'UJI-KS saldo awal' }), bar({ tanggal: '2031-03-05', arah: 'DB', jumlah: 111000, internal: true, deskripsi: 'UJI-KS internal' }), bar({ tanggal: '2031-03-20', arah: 'DB', jumlah: 424242, deskripsi: 'UJI-KS tak ada pasangan' })]
  r = await panggil(`${B}/mutasi/impor`, { method: 'POST', token: adv.t, body: { dompetId: dompet.id, baris } }); cek('Impor 5 baris → 5 baru', r.s === 201 && r.j.data.baru === 5, JSON.stringify(r.j.data))
  r = await panggil(`${B}/mutasi/impor`, { method: 'POST', token: adv.t, body: { dompetId: dompet.id, baris } }); cek('Impor ulang → idempoten (0 baru, 5 duplikat)', r.j.data.baru === 0 && r.j.data.duplikat === 5)
  r = await panggil(`${B}/mutasi/impor`, { method: 'POST', token: adv.t, body: { dompetId: dompet.id, baris: [bar({ jumlah: 111 }), bar({ jumlah: 111 })] } }); cek('Dua baris identik dalam satu impor tetap dua (urutan)', r.j.data.baru === 2)
  await prisma.mutasiKas.deleteMany({ where: { dompetId: dompet.id, jumlah: 111 } })
  r = await panggil(`${B}/mutasi?bulan=2031-03&dompetId=${dompet.id}`, { token: adv.t }); const mut = r.j.data.mutasi
  cek('Daftar 5 mutasi, semua BELUM', r.s === 200 && mut.length === 5 && r.j.data.ringkasan.belum === 5)
  const cr = mut.find(m => m.jumlah === 2900000), db = mut.find(m => m.jumlah === 500000)
  r = await panggil(`${B}/mutasi/${cr.id}/kandidat`, { token: adv.t }); cek('Kandidat CR: transfer dikonfirmasi 2.900.000 (±3 hari)', r.s === 200 && r.j.data.length === 1 && r.j.data[0].tipe === 'TRANSFER' && r.j.data[0].id === tf.id, JSON.stringify(r.j.data))
  r = await panggil(`${B}/mutasi/${db.id}/kandidat`, { token: adv.t }); cek('Kandidat DB: biaya lunas 500.000', r.j.data.length === 1 && r.j.data[0].tipe === 'BIAYA' && r.j.data[0].id === b1)
  r = await panggil(`${B}/mutasi/${cr.id}/cocok`, { method: 'POST', token: adv.t, body: { tipe: 'TRANSFER', id: tf2.id } }); cek('Cocokkan dengan transfer yang tak ada/belum konfirmasi → 404', r.s === 404)
  r = await panggil(`${B}/mutasi/${cr.id}/cocok`, { method: 'POST', token: adv.t, body: { tipe: 'LAIN', id: 'x' } }); cek('Tipe tak valid → 422', r.s === 422)
  r = await panggil(`${B}/mutasi/${cr.id}/cocok`, { method: 'POST', token: adv.t, body: { tipe: 'TRANSFER', id: tf.id } }); cek('Cocokkan manual', r.s === 200)
  r = await panggil(`${B}/mutasi/${cr.id}/cocok`, { method: 'POST', token: adv.t, body: { tipe: 'TRANSFER', id: tf.id } }); cek('Cocokkan ulang → 409', r.s === 409)
  r = await panggil(`${B}/mutasi/${cr.id}/kandidat`, { token: adv.t }); cek('Baris buku yang terpakai tidak jadi kandidat lagi', r.j.data.length === 0)
  r = await panggil(`${B}/mutasi/${cr.id}`, { method: 'DELETE', token: adv.t }); cek('Hapus mutasi yang sudah cocok → 409', r.s === 409)
  r = await panggil(`${B}/mutasi/${cr.id}/lepas`, { method: 'POST', token: adv.t }); cek('Lepas pasangan', r.s === 200)
  r = await panggil(`${B}/mutasi/${mut.find(m => m.jumlah === 424242).id}/abaikan`, { method: 'POST', token: adv.t, body: { catatan: '  ' } }); cek('Abaikan tanpa alasan → 422', r.s === 422)
  r = await panggil(`${B}/rekon/otomatis`, { method: 'POST', token: adv.t, body: { bulan: '2031-03' } }); const ot = r.j.data
  cek('Rekon otomatis: 2 diabaikan (internal + saldo awal), 2 cocok (transfer & biaya)', r.s === 200 && ot.diabaikan === 2 && ot.cocok === 2 && ot.perTipe.TRANSFER === 1 && ot.perTipe.BIAYA === 1, JSON.stringify(ot))
  cek('Sisa 1 belum cocok (424.242)', ot.belum === 1 && ot.jumlahBelum === 424242)
  r = await panggil(`${B}/mutasi/${mut.find(m => m.jumlah === 424242).id}/abaikan`, { method: 'POST', token: adv.t, body: { catatan: 'Biaya bank' } }); cek('Abaikan dengan alasan', r.s === 200)
  r = await panggil(`${B}/biaya/${b1}`, { method: 'DELETE', token: kepala.t }); cek('Biaya terkunci tidak bisa dihapus → 409', r.s === 409)
  await panggil(`${B}/biaya/${b1}/kunci`, { method: 'POST', token: kepala.t, body: { terkunci: false } })
  r = await panggil(`${B}/biaya/${b1}`, { method: 'DELETE', token: kepala.t }); cek('Biaya yang sudah direkonsiliasi tidak bisa dihapus → 409', r.s === 409, r.j.message)
  r = await panggil(`${B}/saldo-bank`, { method: 'PUT', token: adv.t, body: { bulan: '2031-03', namaRekening: 'UJI-KS Rek', jumlah: 5000000 } }); cek('Simpan saldo bank', r.s === 200)
  r = await panggil(`${B}/saldo-bank?bulan=2031-03`, { token: adv.t }); cek('Baca saldo bank + total', r.j.data.saldo.some(x => x.namaRekening === 'UJI-KS Rek' && x.jumlah === 5000000))
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.dompetKas.deleteMany({ where: { kode: 'UJI-KS' } })
  await prisma.mutasiKas.deleteMany({ where: { deskripsi: { startsWith: 'UJI-KS' } } })
  await prisma.pendapatanTertahan.deleteMany({ where: { bank: 'UJI-KS Bank' } })
  await prisma.penarikanPendapatan.deleteMany({ where: { bankTujuan: 'UJI-KS Bank' } })
  await prisma.biayaStudio.deleteMany({ where: { deskripsi: { startsWith: 'UJI-KS' } } })
  await prisma.saldoPlatformBulanan.deleteMany({ where: { bulan: '2031-03' } })
  await prisma.saldoBankBulanan.deleteMany({ where: { namaRekening: 'UJI-KS Rek' } })
  await prisma.kategoriBiaya.deleteMany({ where: { nama: { startsWith: 'UJI-KS' } } })
  if (akunUji) await prisma.akunProduksi.deleteMany({ where: { id: akunUji.id } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
