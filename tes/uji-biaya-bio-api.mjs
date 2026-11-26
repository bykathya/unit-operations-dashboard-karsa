import { DASH } from './_jalur.mjs'
// Uji biaya rutin dari Bio studio di buku besar circle (12 Nov 2026): Bio dibaca otomatis (baca-saja), tidak dobel dengan item tetap circle,
// ikut tutup bulan (snapshot) & buka lagi. Angka Bio asli Keiko dinolkan sementara lalu dipulihkan. Data sementara dihapus.
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.46.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4), dibuat = [], bioBaru = [], itemBaru = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: studioId ?? null } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const B = '/api/circle/buku', M = '2031-08'
// Angka Bio (biaya rutin, THP, SHU) ikut dihitung buku besar sejak 12 Nov 2026 — dinolkan sementara agar hitungan eksak, dipulihkan di finally
const { nolkanBio } = await import('./_isolasi-bio.mjs')
const pulihkanBio = await nolkanBio(prisma, [S])
try {
  const koord = await user('bio_koord', [['KOORDINATOR', S]]), kar = await user('bio_kar', [['KARYAWAN', S]]), adv = await user('bio_adv', [['ADVISOR', null]])
  const bio = async (kategori, nama, jumlah) => { const x = await prisma.studioPengeluaranRutin.create({ data: { studioId: S, kategori, nama, jumlah } }); bioBaru.push(x.id); return x }
  const langganan = await bio('SUBSCRIPTION', 'UJI Berlangganan Tools', 100000), iuran = await bio('SUPPORT', 'UJI Iuran Forum', 250000), dobel = await bio('SUPPORT', 'UJI Kontribusi Rumah', 500000)

  console.log('— Bio terbaca di buku besar —')
  let r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); let d = r.j.data
  const bioBaris = d.baris.filter(b => b.sumber === 'BIO')
  cek('Rincian memuat 3 baris dari Bio (langganan, iuran, kontribusi)', bioBaris.length === 3 && bioBaris.every(b => b.dariBio === true && b.arus === 'EXPENSE' && b.sifat === 'TETAP'), String(bioBaris.length))
  cek('Biaya tetap = 850.000 (100.000 + 250.000 + 500.000)', d.tetap === 850000, String(d.tetap))
  cek('Kategori otomatis: Langganan & Tools / Iuran & Kontribusi', bioBaris.some(b => b.kategori === 'Langganan & Tools') && bioBaris.some(b => b.kategori === 'Iuran & Kontribusi'))
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: kar.t }); cek('Karyawan membuka rincian → 403', r.s === 403)

  console.log('— tidak dobel dengan item tetap circle —')
  const kat = (await prisma.kategoriLedger.findFirst({ where: { nama: 'Biaya Rumah Tangga' } }))
  const it = await prisma.itemTetap.create({ data: { kategoriId: kat.id, studioId: S, nama: 'uji  kontribusi rumah', jumlahBawaan: 500000 } }); itemBaru.push(it.id)
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); d = r.j.data
  cek('Item circle yang sama dengan Bio: baris Bio dilewati, total tetap 850.000 (bukan 1.350.000)', d.tetap === 850000 && d.baris.filter(b => b.sumber === 'BIO').length === 2 && d.bioDobel?.includes('UJI Kontribusi Rumah'), `${d.tetap} / ${d.bioDobel}`)
  r = await panggil(`${B}/item-tetap?studioId=${S}&bulan=${M}`, { token: koord.t })
  const lb = r.j.data?.dariBio ?? []
  cek('Daftar "Dari Bio studio" memuat 3 item, yang kembar ditandai dobel', lb.length === 3 && lb.find(x => x.nama === 'UJI Kontribusi Rumah')?.dobel === true && lb.find(x => x.nama === 'UJI Iuran Forum')?.dobel === false)
  await prisma.itemTetap.update({ where: { id: it.id }, data: { jumlahBawaan: 600000 } })
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); cek('Jumlah beda → bukan kembar, keduanya dihitung (Bio 850.000 + circle 600.000)', r.j.data.tetap === 1450000, String(r.j.data.tetap))
  await prisma.itemTetap.delete({ where: { id: it.id } }); itemBaru.length = 0

  const kLang = await prisma.kategoriLedger.findFirst({ where: { nama: 'Langganan & Tools' } })
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: kLang.id, nama: 'UJI ChatGPT', jumlahBawaan: 1000 } }); cek('Kategori khusus Bio tidak bisa dipakai untuk biaya rutin circle → 422', r.s === 422, r.j.message?.slice(0, 50))
  console.log('— tutup bulan & buka lagi —')
  r = await panggil(`${B}/tutup`, { method: 'POST', token: koord.t, body: { studioId: S, bulan: M } }); cek('Tutup bulan → 200', r.s === 200, JSON.stringify(r.j).slice(0, 100))
  const entri = await prisma.entriLedger.findMany({ where: { studioId: S, bulan: M, sumberTipe: 'BIO' } })
  cek('Snapshot: 3 entri BIO terkunci', entri.length === 3 && entri.every(e => e.terkunci))
  await prisma.studioPengeluaranRutin.update({ where: { id: iuran.id }, data: { jumlah: 999999 } })
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); cek('Bio diubah setelah ditutup: bulan tertutup tidak berubah (850.000)', r.j.data.ditutup === true && r.j.data.tetap === 850000, String(r.j.data.tetap))
  r = await panggil(`${B}/buka-lagi`, { method: 'POST', token: adv.t, body: { studioId: S, bulan: M } }); cek('Super Admin membuka lagi → 200', r.s === 200)
  cek('Entri BIO snapshot dihapus saat dibuka lagi', (await prisma.entriLedger.count({ where: { studioId: S, bulan: M, sumberTipe: 'BIO' } })) === 0)
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M}`, { token: koord.t }); cek('Setelah dibuka: angka Bio terbaru terbaca (100.000 + 999.999 + 500.000)', r.j.data.tetap === 1599999, String(r.j.data.tetap))

  console.log('— gaji & SHU dari Bio —')
  const M2 = '2031-09', kGaji = await prisma.kategoriLedger.findFirst({ where: { nama: 'Biaya Gaji & Uang Makan' } })
  await prisma.userRole.updateMany({ where: { userId: koord.id, studioId: S }, data: { takeHomePay: 3000000 } })
  await prisma.studio.update({ where: { id: S }, data: { statusShu: true, totalShu: 1000000 } })
  const ig = await prisma.itemTetap.create({ data: { kategoriId: kGaji.id, studioId: S, nama: 'UJI Gaji ketik ulang', jumlahBawaan: 2500000 } }); itemBaru.push(ig.id)
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M2}`, { token: koord.t }); d = r.j.data
  const gb = d.baris.find(b => b.sumberId === `gaji:${koord.id}`), sb = d.baris.find(b => b.sumberId === 'shu')
  cek('Gaji dari THP Bio (3.000.000) & SHU Bio (1.000.000) masuk buku besar', gb?.jumlah === 3000000 && gb.kategori === 'Biaya Gaji & Uang Makan' && sb?.jumlah === 1000000)
  cek('Gaji yang diketik ulang di circle tidak dihitung (dilaporkan)', !d.baris.some(b => b.deskripsi === 'UJI Gaji ketik ulang') && d.gajiCircleDiabaikan?.includes('UJI Gaji ketik ulang'))
  cek('Biaya tetap = rutin Bio 1.599.999 + gaji 3.000.000 + SHU 1.000.000', d.tetap === 5599999, String(d.tetap))
  r = await panggil(`${B}/item-tetap?studioId=${S}&bulan=${M2}`, { token: koord.t })
  cek('Tab Biaya rutin: gajiBio memuat orangnya + SHU; item gaji circle ditandai diabaikan', r.j.data?.gajiBio?.orang.some(o => o.userId === koord.id && o.dari === 'Bio') && r.j.data.gajiBio.shu === 1000000 && r.j.data.item.find(i => i.id === ig.id)?.diabaikan === true)
  r = await panggil(`${B}/item-tetap`, { method: 'POST', token: koord.t, body: { studioId: S, kategoriId: kGaji.id, nama: 'UJI gaji baru', jumlahBawaan: 1000 } }); cek('Item gaji baru ditolak saat Bio sudah berisi THP → 422', r.s === 422)
  const slip = await prisma.penggajian.create({ data: { userId: koord.id, studioId: S, bulan: 9, tahun: 2031, gajiPokok: 3000000, bonus: 500000, thp: 3500000 } })
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M2}`, { token: koord.t })
  cek('Bila slip bulan itu ada: angka slip (3.500.000) yang dipakai', r.j.data.baris.find(b => b.sumberId === `gaji:${koord.id}`)?.jumlah === 3500000)
  await prisma.penggajian.delete({ where: { id: slip.id } })

  console.log('— Dignity jadi kelompok sendiri —')
  const dig = await user('bio_dig', [['DIGNITY', S]]); await prisma.userRole.updateMany({ where: { userId: dig.id }, data: { takeHomePay: 500000 } })
  r = await panggil(`${B}/rincian?studioId=${S}&bulan=${M2}`, { token: koord.t }); d = r.j.data
  const bd = d.baris.find(b => b.sumberId === `gaji:${dig.id}`)
  cek('Orang ber-peran Dignity: kategori buku besar "Dignity", deskripsi "Dignity …"', bd?.kategori === 'Dignity' && bd.deskripsi.startsWith('Dignity ') && bd.jumlah === 500000, JSON.stringify(bd && [bd.kategori, bd.deskripsi]))
  cek('Karyawan biasa tetap kategori gaji', d.baris.find(b => b.sumberId === `gaji:${koord.id}`)?.kategori === 'Biaya Gaji & Uang Makan')
  r = await panggil(`${B}/item-tetap?studioId=${S}&bulan=${M2}`, { token: koord.t })
  cek('Panel Bio menandai orang Dignity (dignity: true)', r.j.data?.gajiBio?.orang.find(o => o.userId === dig.id)?.dignity === true && r.j.data.gajiBio.orang.find(o => o.userId === koord.id)?.dignity === false)
} finally {
  await prisma.entriLedger.deleteMany({ where: { studioId: S, bulan: M } }); await prisma.statusBulan.deleteMany({ where: { studioId: S, bulan: M } })
  await prisma.itemTetap.deleteMany({ where: { id: { in: itemBaru } } }); await prisma.studioPengeluaranRutin.deleteMany({ where: { id: { in: bioBaru } } })
  await pulihkanBio()
  await prisma.userRole.deleteMany({ where: { userId: { in: dibuat } } }); await prisma.user.deleteMany({ where: { id: { in: dibuat } } }); await prisma.$disconnect()
}
console.log(gagal ? `\n${gagal} GAGAL` : '\nSEMUA LULUS'); process.exit(gagal ? 1 : 0)
