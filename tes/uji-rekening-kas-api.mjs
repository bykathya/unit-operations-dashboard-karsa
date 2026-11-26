import { DASH } from './_jalur.mjs'
// Uji KAS PER REKENING (12 Nov 2026, masukan tim): rekening dari Bio studio Ekosistem (StudioRekening) dipakai di web circle —
// saldo awal per rekening, penarikan "masuk ke", biaya "dibayar dari", entri manual, pindah dana, tutup bulan → bulan berikutnya.
// Keamanan: nomor rekening & atas nama tidak dikirim; talent ditolak; rekening unit lain ditolak. Mode bayangan: saldo Bio TIDAK berubah.
// Memakai bulan jauh di depan (2031-07/08) supaya tidak bercampur data lain. Data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.42.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } }), pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const S = keiko.id, B1 = '2031-07', B2 = '2031-08', BN = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)
const statusAsli = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId: S, bulan: BN } } }) // dipulihkan di akhir
const hash = await bcrypt.hash('uji-rk-' + Date.now(), 4)
const dibuat = [], rekIds = [], katBiaya = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const rek = async (studioId, namaBank, saldo) => { const r = await prisma.studioRekening.create({ data: { studioId, namaBank, nomorRekening: '1234567890', atasNama: 'RAHASIA UJI', saldo } }); rekIds.push(r.id); return r }
try {
  const koord = await user('rk_koord', [['KOORDINATOR', S]]), kar = await user('rk_kar', [['KARYAWAN', S]])
  const bca = await rek(S, 'UJI-BCA', 1000000), tunai = await rek(S, 'UJI-Tunai', 200000), lainUnit = await rek(pibi.id, 'UJI-Mandiri', 5)
  const K = (path, o = {}) => panggil(path, { token: koord.t, ...o })

  console.log('— daftar rekening dari Bio Ekosistem —')
  let r = await K(`/api/circle/buku/rekening?studioId=${S}`)
  const daftar = r.j.data ?? []
  cek('Koordinator: rekening Bio unit ini muncul (nama bank saja)', r.s === 200 && daftar.some(x => x.id === bca.id && x.nama === 'UJI-BCA') && daftar.some(x => x.id === tunai.id))
  cek('Nomor rekening & atas nama TIDAK dikirim', !JSON.stringify(r.j).includes('1234567890') && !JSON.stringify(r.j).includes('RAHASIA'))
  cek('Rekening unit lain tidak ikut', !daftar.some(x => x.id === lainUnit.id))
  r = await panggil(`/api/circle/buku/rekening?studioId=${S}`, { token: kar.t }); cek('Talent → 403', r.s === 403, String(r.s))

  console.log('— saldo awal per rekening —')
  r = await K('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', body: { studioId: S, bulan: B1, saldo: { [bca.id]: 1000000, [tunai.id]: 200000 } } }); cek('Simpan saldo awal per rekening → 200, kas awal ikut (bulan pertama)', r.s === 200 && r.j.data?.kasAwalIkut === true, String(r.s))
  r = await K('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', body: { studioId: S, bulan: B1, saldo: { [lainUnit.id]: 1 } } }); cek('Saldo awal untuk rekening unit lain → 422', r.s === 422)
  r = await panggil('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', token: kar.t, body: { studioId: S, bulan: B1, saldo: {} } }); cek('Talent mengisi saldo awal → 403', r.s === 403)

  console.log('— catatan uang memilih rekening —')
  r = await K('/api/circle/kas/penarikan', { method: 'POST', body: { studioId: S, tanggal: `${B1}-05`, jumlah: 500000, dariPlatform: 'etsy', rekeningId: bca.id } })
  cek('Penarikan "masuk ke" BCA → bank tujuan & atas nama terisi otomatis dari Bio', r.s === 201 && r.j.data?.rekeningId === bca.id && r.j.data?.bankTujuan === 'UJI-BCA', `${r.s} ${r.j.message ?? ''}`)
  const wdId = r.j.data?.id
  r = await K('/api/circle/kas/penarikan', { method: 'POST', body: { studioId: S, tanggal: `${B1}-05`, jumlah: 1, dariPlatform: 'etsy', rekeningId: lainUnit.id } }); cek('Penarikan ke rekening unit lain → 422', r.s === 422)
  // kategori biaya yang dipasangkan ke kategori buku besar (pengeluaran variabel)
  const katLedger = await prisma.kategoriLedger.findFirst({ where: { arus: 'EXPENSE', sifat: 'VARIABEL', aktif: true } }), katMasuk = await prisma.kategoriLedger.findFirst({ where: { arus: 'INCOME', aktif: true } })
  const kb = await prisma.kategoriBiaya.create({ data: { nama: 'UJI-RK biaya ' + Date.now(), kategoriLedgerId: katLedger.id } }); katBiaya.push(kb.id)
  r = await K('/api/circle/kas/biaya', { method: 'POST', body: { studioId: S, kategori: kb.nama, tanggal: `${B1}-06`, jumlah: 100000, rekeningId: tunai.id } }); const biayaId = r.j.data?.id
  cek('Biaya "dibayar dari" Tunai → tersimpan', r.s === 201 && r.j.data?.rekeningId === tunai.id, String(r.s))
  await K(`/api/circle/kas/biaya/${biayaId}/setuju`, { method: 'POST', body: { status: 'DISETUJUI' } })
  r = await K(`/api/circle/kas/biaya/${biayaId}`, { method: 'PATCH', body: { rekeningId: lainUnit.id } }); cek('Ubah biaya ke rekening unit lain → 422', r.s === 422)
  r = await K('/api/circle/buku/entri', { method: 'POST', body: { studioId: S, kategoriId: katMasuk.id, tanggal: `${B1}-07`, deskripsi: 'UJI-RK fee LTK', jumlah: 50000, rekeningId: tunai.id } }); cek('Entri manual masuk ke Tunai → 201', r.s === 201)
  r = await K('/api/circle/buku/entri', { method: 'POST', body: { studioId: S, kategoriId: katLedger.id, tanggal: `${B1}-08`, deskripsi: 'UJI-RK tanpa rekening', jumlah: 20000 } }); cek('Entri manual tanpa rekening tetap boleh → 201', r.s === 201)
  r = await K('/api/circle/buku/pindah', { method: 'POST', body: { studioId: S, tanggal: `${B1}-10`, dariId: bca.id, keId: tunai.id, jumlah: 300000, catatan: 'tarik tunai' } }); cek('Pindah dana BCA → Tunai → 201', r.s === 201)
  r = await K('/api/circle/buku/pindah', { method: 'POST', body: { studioId: S, tanggal: `${B1}-10`, dariId: bca.id, keId: bca.id, jumlah: 1 } }); cek('Pindah ke rekening yang sama → 422', r.s === 422)
  r = await panggil('/api/circle/buku/pindah', { method: 'POST', token: kar.t, body: { studioId: S, tanggal: `${B1}-10`, dariId: bca.id, keId: tunai.id, jumlah: 1 } }); cek('Talent memindah dana → 403', r.s === 403)

  console.log('— hitungan per rekening —')
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B1}`); const d = r.j.data, rk = d?.rekening
  const pb = rk?.daftar.find(x => x.id === bca.id), pt = rk?.daftar.find(x => x.id === tunai.id)
  cek('Kas awal = jumlah saldo awal rekening (1.200.000)', d?.kasAwal === 1200000, String(d?.kasAwal))
  cek('BCA: awal 1.000.000 + WD 500.000 − pindah 300.000 = 1.200.000', pb?.awal === 1000000 && pb?.masuk === 500000 && pb?.pindahKeluar === 300000 && pb?.akhir === 1200000, JSON.stringify(pb))
  cek('Tunai: awal 200.000 − biaya 100.000 + entri 50.000 + pindah 300.000 = 450.000', pt?.akhir === 450000 && pt?.keluar === 100000 && pt?.masuk === 50000 && pt?.pindahMasuk === 300000, JSON.stringify(pt))
  const jumlahSemua = rk.daftar.reduce((a, x) => a + x.akhir, 0) + rk.belumDipilih.akhir
  cek('Semua rekening + "belum dipilih" = kas akhir total (pindah tidak mengubah total)', Math.round(jumlahSemua) === Math.round(d.kasAkhir), `${jumlahSemua} vs ${d.kasAkhir}`)
  cek('Entri tanpa rekening masuk "belum dipilih"', rk.belumDipilih.keluar >= 20000)
  cek('Saldo Bio ikut ditampilkan sebagai pembanding', pb?.saldoBio === 1000000)
  r = await K(`/api/circle/buku/rincian?studioId=${S}&bulan=${B1}`); cek('Rincian menampilkan nama rekening per baris', r.j.data?.baris.some(b => b.sumber === 'WD' && b.rekening === 'UJI-BCA') && r.j.data?.baris.some(b => b.sumber === 'BIAYA' && b.rekening === 'UJI-Tunai'))

  console.log('— tutup bulan → bulan berikutnya —')
  r = await K('/api/circle/buku/tutup', { method: 'POST', body: { studioId: S, bulan: B1 } }); cek('Tutup bulan → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B1}`); cek('Bulan ditutup: saldo per rekening tetap sama (snapshot)', r.j.data?.rekening.daftar.find(x => x.id === bca.id)?.akhir === 1200000 && r.j.data?.rekening.daftar.find(x => x.id === tunai.id)?.akhir === 450000)
  r = await K(`/api/circle/buku/rincian?studioId=${S}&bulan=${B1}`); cek('Snapshot rincian tetap menyimpan rekening', r.j.data?.baris.some(b => b.sumber === 'WD' && b.rekening === 'UJI-BCA'))
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${B2}`); const n = r.j.data?.rekening
  cek('Bulan berikutnya: saldo awal per rekening = saldo akhir bulan lalu', n?.daftar.find(x => x.id === bca.id)?.awal === 1200000 && n?.daftar.find(x => x.id === tunai.id)?.awal === 450000 && n?.bisaIsiAwal === false, JSON.stringify(n?.daftar))
  r = await K('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', body: { studioId: S, bulan: B2, saldo: { [bca.id]: 1 } } }); cek('Saldo awal bulan berikutnya tidak bisa diisi manual (otomatis) → 409', r.s === 409)
  r = await K('/api/circle/buku/pindah', { method: 'POST', body: { studioId: S, tanggal: `${B1}-20`, dariId: bca.id, keId: tunai.id, jumlah: 1 } }); cek('Pindah dana di bulan yang sudah ditutup → 409', r.s === 409)

  console.log('— mode bayangan —')
  const bio = await prisma.studioRekening.findMany({ where: { id: { in: [bca.id, tunai.id] } }, select: { id: true, saldo: true } })
  cek('Saldo di Bio Ekosistem TIDAK berubah oleh catatan circle', bio.find(x => x.id === bca.id).saldo === 1000000 && bio.find(x => x.id === tunai.id).saldo === 200000)

  console.log('— tombol "Perbarui saldo Bio dari circle" (opsi 2) —')
  r = await K('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId: S, bulan: B1 } }); cek('Hanya untuk bulan berjalan → 422', r.s === 422)
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: BN } })
  r = await K('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId: S, bulan: BN } }); cek('Saldo awal belum diisi → 409 (Bio tidak tertimpa 0)', r.s === 409, String(r.s))
  const bioLain0 = await prisma.studioRekening.findMany({ where: { studioId: S, id: { notIn: rekIds } }, select: { id: true, saldo: true } })
  await K('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', body: { studioId: S, bulan: BN, saldo: { [bca.id]: 1000000 } } })
  const katMasuk2 = await prisma.kategoriLedger.findFirst({ where: { arus: 'INCOME', aktif: true } })
  await K('/api/circle/buku/entri', { method: 'POST', body: { studioId: S, kategoriId: katMasuk2.id, tanggal: `${BN}-01`, deskripsi: 'UJI-RK-BIO masuk', jumlah: 250000, rekeningId: bca.id } })
  r = await panggil('/api/circle/buku/samakan-bio', { method: 'POST', token: kar.t, body: { studioId: S, bulan: BN } }); cek('Talent → 403', r.s === 403)
  r = await K('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId: S, bulan: BN } })
  cek('Koordinator memperbarui → hanya rekening yang punya saldo awal (BCA)', r.s === 200 && r.j.data?.diubah >= 1 && r.j.data.rekening.some(x => x.nama === 'UJI-BCA' && x.dari === 1000000 && x.ke === 1250000), JSON.stringify(r.j.data ?? r.j))
  cek('Rekening tanpa saldo awal dilewati (dilaporkan)', r.j.data?.dilewati?.includes('UJI-Tunai'))
  const bioBca = await prisma.studioRekening.findUnique({ where: { id: bca.id } }), bioTunai = await prisma.studioRekening.findUnique({ where: { id: tunai.id } })
  const bioLain1 = await prisma.studioRekening.findMany({ where: { studioId: S, id: { notIn: rekIds } }, select: { id: true, saldo: true } })
  cek('Saldo Bio BCA = saldo akhir circle (1.250.000); Tunai & rekening lain tidak berubah', bioBca.saldo === 1250000 && bioTunai.saldo === 200000 && JSON.stringify(bioLain0) === JSON.stringify(bioLain1))
  const st = await prisma.statusBulan.findUnique({ where: { studioId_bulan: { studioId: S, bulan: BN } } })
  cek('Jejak tersimpan: siapa, kapan, saldo Bio sebelumnya', st?.bioDisamakanOleh === 'Uji rk_koord' && st?.bioDisamakanPada && st?.bioSebelum?.[bca.id] === 1000000)
  r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${BN}`); cek('Ringkasan menampilkan "terakhir diperbarui"', r.j.data?.rekening?.bioDisamakan?.oleh === 'Uji rk_koord')
  r = await K('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId: S, bulan: BN } }); cek('Ditekan lagi tanpa perubahan → tidak ada yang diubah', r.s === 200 && r.j.data?.diubah === 0)
  // Saldo HARI INI (12 Nov 2026, masukan tim): biaya bertanggal setelah hari ini tidak ikut disalin ke Bio
  const besok = new Date(Date.now() + 7 * 3600000 + 86400000).toISOString().slice(0, 10)
  if (besok.slice(0, 7) === BN) {
    const katKeluar = await prisma.kategoriLedger.findFirst({ where: { arus: 'EXPENSE', sifat: 'VARIABEL', aktif: true } })
    await K('/api/circle/buku/entri', { method: 'POST', body: { studioId: S, kategoriId: katKeluar.id, tanggal: besok, deskripsi: 'UJI-RK gaji besok', jumlah: 100000, rekeningId: bca.id } })
    r = await K(`/api/circle/buku/ringkasan?studioId=${S}&bulan=${BN}`); const rb = r.j.data?.rekening?.daftar?.find(x => x.id === bca.id)
    cek('Biaya bertanggal besok: saldo akhir 1.150.000, saldo hari ini tetap 1.250.000', rb?.akhir === 1150000 && rb?.kini === 1250000, JSON.stringify(rb && { akhir: rb.akhir, kini: rb.kini }))
    r = await K('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId: S, bulan: BN } }); cek('Perbarui Bio memakai saldo hari ini → tidak ada perubahan', r.s === 200 && r.j.data?.diubah === 0)
  } else console.log('(lewati cek saldo hari ini: besok sudah bulan berikutnya)')
  void wdId
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.entriLedger.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.entriLedger.deleteMany({ where: { studioId: S, deskripsi: 'UJI-RK-BIO masuk' } })
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: BN } })
  if (statusAsli) { const { id, updatedAt, ...isi } = statusAsli; void id; void updatedAt; await prisma.statusBulan.create({ data: { ...isi, saldoAwalRekening: isi.saldoAwalRekening ?? undefined, saldoRekening: isi.saldoRekening ?? undefined, bioSebelum: isi.bioSebelum ?? undefined } }) }
  await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.pindahRekening.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.penarikanPendapatan.deleteMany({ where: { studioId: S, bulan: { in: [B1, B2] } } })
  await prisma.biayaStudio.deleteMany({ where: { studioId: S, tanggal: { gte: new Date(`${B1}-01T00:00:00Z`), lt: new Date('2031-09-01T00:00:00Z') } } })
  await prisma.kategoriBiaya.deleteMany({ where: { id: { in: katBiaya } } })
  await prisma.studioRekening.deleteMany({ where: { id: { in: rekIds } } })
  await (await import(DASH + '/server/src/utils/kas.js')).snapshotKasMingguIni(S).catch(() => {}) // kas laporan mingguan lokal kembali tanpa rekening uji
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
