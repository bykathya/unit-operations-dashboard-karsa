import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) process.exitCode = 1 }
const api = (uid) => { const t = jwt.sign({ id: uid }, process.env.JWT_SECRET, { expiresIn: '10m' }); return async (path, method = 'GET', body) => { const r = await fetch('http://localhost:3001/api/circle' + path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } } }

const studios = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true, nama: true, circleId: true, rumahUsahaId: true } })
const nm = (n) => studios.find(s => s.nama.trim().toLowerCase() === n.toLowerCase())
const pibi = nm('Pibi'), keiko = nm('Keiko'), lional = nm('Lional')
const peran = async (studioId, roleType) => (await prisma.userRole.findFirst({ where: { studioId, roleType, user: { statusAktif: true } }, select: { userId: true, user: { select: { nama: true } } } }))
const kPibi = await peran(pibi.id, 'KOORDINATOR'), kKeiko = await peran(keiko.id, 'KOORDINATOR')
const karyawan = await prisma.userRole.findFirst({ where: { studioId: pibi.id, roleType: { in: ['KARYAWAN', 'MAGANG'] }, user: { statusAktif: true } }, select: { userId: true, roleType: true } })
const superU = await prisma.userRole.findFirst({ where: { roleType: 'ADVISOR', user: { statusAktif: true } }, select: { userId: true } })
const kepalaCircle = await prisma.userRole.findFirst({ where: { roleType: 'KEPALA_CIRCLE', circleId: { not: null }, user: { statusAktif: true, roles: { none: { roleType: { in: ['ADVISOR', 'KEPALA_EKOSISTEM'] } } } } } , select: { userId: true, circleId: true, user: { select: { nama: true } } } })

let idOrder = null, orderUji = null, talentUji = null, akunUji = null
try {
  // ── isolasi antar circle
  const a = api(kPibi.userId)
  let r = await a('/saya')
  // 21 Okt 2026: PEMILIK unit (StudioPemilik) ikut terlihat dalam mode LIHAT SAJA; tag Dignity tanpa kepemilikan tetap diabaikan
  const milikPibi = new Set((await prisma.studioPemilik.findMany({ where: { userId: kPibi.userId }, select: { studioId: true } })).map(x => x.studioId))
  const kerjaSaja = r.j.data.studios.filter(s => !s.lihatSaja).map(s => s.id), lihat = r.j.data.studios.filter(s => s.lihatSaja).map(s => s.id)
  cek(`Koordinator Pibi (${kPibi.user.nama}): kelola hanya studionya; unit lain hanya yang ia PEMILIKnya (lihat saja); Dignity tanpa kepemilikan diabaikan`, r.s === 200 && kerjaSaja.length === 1 && kerjaSaja[0] === pibi.id && lihat.every(id => milikPibi.has(id)) && r.j.data.studios.every(s => s.id === pibi.id || milikPibi.has(s.id)), r.j.data?.studios?.map(s => s.nama.trim() + (s.lihatSaja ? ' (lihat)' : '')).join(', '))
  const idSaya = r.j.data.studios.map(s => s.id)
  cek('Studio circle LAIN yang bukan miliknya tidak ada di daftar Koordinator Pibi', !idSaya.includes(keiko.id) || milikPibi.has(keiko.id))
  const slugPibi = (await prisma.circle.findUnique({ where: { id: pibi.circleId }, select: { slug: true } }))?.slug
  if (slugPibi) {
    const tc = jwt.sign({ id: kPibi.userId, aud: 'circle', cs: slugPibi }, process.env.JWT_SECRET, { expiresIn: '10m' })
    const rc = await fetch('http://localhost:3001/api/circle/saya', { headers: { Authorization: `Bearer ${tc}`, 'X-Unit-Web': slugPibi } }).then(x => x.json())
    cek(`Lewat alamat circle-nya (${slugPibi}): hanya unit di circle itu (isolasi antar-circle, termasuk kepemilikan)`, rc.data.studios.every(s => studios.find(x => x.id === s.id)?.circleId === pibi.circleId), rc.data.studios.map(s => s.nama.trim()).join(', '))
  }
  r = await a(`/papan?studioId=${keiko.id}`); cek('Papan studio circle lain → 403', r.s === 403)
  r = await a(`/freelancer?studioId=${keiko.id}`); cek('Freelancer studio circle lain → 403', r.s === 403)
  r = await a('/orders', 'POST', { studioId: keiko.id, judul: 'uji', klien: 'uji' }); cek('Tambah order di studio circle lain → 403', r.s === 403)

  // ── papan studio sendiri
  r = await a(`/papan?studioId=${pibi.id}`)
  cek('Papan Pibi terbaca dengan 6 tahap bawaan', r.s === 200 && r.j.data.tahap.map(t => t.nama).join('>') === 'Inbox>Pengerjaan>Preview>Revisi>Hold>Done', r.j.data?.tahap?.map(t => t.nama).join('>'))
  cek('Order lama otomatis masuk kolom (semua punya tahapId efektif)', r.j.data.orders.every(o => o.tahapId))
  const tahap = Object.fromEntries(r.j.data.tahap.map(t => [t.jenis, t.id]))
  const sebelum = r.j.data.orders.length

  // ── alur penuh satu order
  r = await a('/orders', 'POST', { studioId: pibi.id, judul: 'UJI tanpa akun', klien: 'RUMSAS' }); cek('Order tanpa akun jualan → 422 (akun wajib)', r.s === 422)
  r = await a('/orders', 'POST', { studioId: pibi.id, judul: 'UJI-ALUR karakter', klien: 'RUMSAS', tipeKlien: 'INTERNAL_JRU_LAIN', nilaiDisepakati: 150000, deadline: '2026-12-31', akunId: 'INTERNAL' })
  cek('Koordinator menambah order (Inbox)', r.s === 201); idOrder = r.j.data?.id
  let o = await prisma.orderProduksi.findUnique({ where: { id: idOrder } })
  cek('Order baru: status MASUK, subStatus Inbox, nilai disepakati 150rb', o.status === 'MASUK' && o.subStatus === 'Inbox' && o.nilaiDisepakati === 150000 && o.nilaiBersih === 150000)
  const pindah = async (j, extra = {}) => { const x = await a(`/orders/${idOrder}/tahap`, 'PATCH', { tahapId: tahap[j], ...extra }); o = await prisma.orderProduksi.findUnique({ where: { id: idOrder } }); return x }
  await pindah('KERJA'); cek('Pengerjaan → status PROSES, subStatus Pengerjaan', o.status === 'PROSES' && o.subStatus === 'Pengerjaan')
  await pindah('PREVIEW_KLIEN'); cek('Preview → PROSES', o.status === 'PROSES' && o.subStatus === 'Preview')
  await pindah('REVISI_KLIEN'); cek('Revisi → revisiKe naik jadi 1', o.revisiKe === 1)
  await pindah('KERJA'); await pindah('PREVIEW_KLIEN'); await pindah('REVISI_KLIEN'); cek('Revisi kedua → revisiKe 2', o.revisiKe === 2)
  await pindah('HOLD'); cek('Hold → PROSES', o.status === 'PROSES' && o.subStatus === 'Hold')
  await pindah('SELESAI', { nilaiRiil: 175000 }); cek('Done → SELESAI, tanggalSelesai terisi, nilai riil 175rb (beda dari disepakati)', o.status === 'SELESAI' && !!o.tanggalSelesai && o.nilaiBersih === 175000 && o.nilaiDisepakati === 150000)
  await pindah('KERJA'); cek('Dibuka lagi dari Done → tanggalSelesai dikosongkan, status PROSES', o.status === 'PROSES' && o.tanggalSelesai === null)
  const rw = await prisma.riwayatTahapOrder.findMany({ where: { orderId: idOrder }, orderBy: { mulai: 'asc' } })
  cek(`Riwayat tercatat lengkap (${rw.length} langkah, hanya satu yang masih terbuka)`, rw.length === 10 && rw.filter(x => !x.selesai).length === 1, rw.map(x => x.namaTahap).join('>'))
  r = await a(`/orders/${idOrder}/tahap`, 'PATCH', { tahapId: (await prisma.tahapProduksi.findFirst({ where: { studioId: keiko.id } }))?.id ?? 'x' }); cek('Pindah ke tahap milik studio LAIN → ditolak (422)', r.s === 422)

  // ── peran lain
  if (karyawan) { const k = api(karyawan.userId); r = await k(`/papan?studioId=${pibi.id}`); cek(`${karyawan.roleType} Pibi tidak boleh membuka papan penuh (hanya Tugas Saya) → 403`, r.s === 403); r = await k(`/tugas-saya?studioId=${pibi.id}`); cek(`${karyawan.roleType} Pibi bisa membuka Tugas Saya`, r.s === 200); r = await k(`/orders/${idOrder}/tahap`, 'PATCH', { tahapId: tahap.SELESAI }); cek(`${karyawan.roleType} Pibi tidak boleh memindahkan tahap → 403`, r.s === 403) }
  const kk = api(kKeiko.userId); r = await kk(`/papan?studioId=${pibi.id}`); cek('Koordinator circle lain tidak bisa lihat papan Pibi → 403', r.s === 403)
  const su = api(superU.userId); r = await su('/saya'); cek('Advisor (Super Admin) melihat semua studio', r.j.data.studios.length === studios.length, `${r.j.data.studios.length}/${studios.length}`)
  const kc = api(kepalaCircle.userId); r = await kc('/saya'); const perankuSendiri = (await prisma.userRole.findMany({ where: { userId: kepalaCircle.userId, studioId: { not: null }, roleType: { not: 'DIGNITY' } }, select: { studioId: true } })).map(x => x.studioId)
  const milikKc = (await prisma.studioPemilik.findMany({ where: { userId: kepalaCircle.userId, studio: { statusAktif: true } }, select: { studioId: true } })).map(x => x.studioId)
  const punya = [...new Set([...studios.filter(s => s.circleId === kepalaCircle.circleId).map(s => s.id), ...perankuSendiri, ...milikKc])].sort().join()
  cek(`Kepala Circle ${kepalaCircle.user.nama} melihat studio circle-nya + studio tempat ia punya peran sendiri + unit miliknya (${r.j.data.studios.length}), Dignity diabaikan`, r.j.data.studios.map(s => s.id).sort().join() === punya)
  r = await kc(`/papan?studioId=${pibi.id}`); cek('Kepala Circle tidak bisa membuka papan studio circle lain (Pibi) → 403', r.s === 403)

  // ── freelancer terbatas circle (data uji sementara di studio circle LAIN)
  const akunK = await prisma.akunProduksi.findFirst({ where: { studioId: keiko.id } }) ?? await prisma.akunProduksi.create({ data: { studioId: keiko.id, platform: 'Internal', namaAkun: 'UJI akun', feePersen: 0 } }); if (akunK.namaAkun === 'UJI akun') akunUji = akunK.id
  talentUji = (await prisma.talentEksternal.create({ data: { nama: 'UJI Freelancer Circle Lain', noRekening: '123' } })).id
  orderUji = (await prisma.orderProduksi.create({ data: { studioId: keiko.id, akunId: akunK.id, klien: 'uji', judul: 'UJI order circle lain', nilaiKotor: 1, nilaiBersih: 1, assignments: { create: { talentEksternalId: talentUji, namaEksternal: 'UJI Freelancer Circle Lain', tipeEksternal: 'FREELANCER_PERORANGAN' } } } })).id
  const fl = await a(`/freelancer?studioId=${pibi.id}`)
  cek('Freelancer yang hanya kerja di circle LAIN tidak muncul di daftar Pibi', fl.s === 200 && !fl.j.data.some(x => x.nama.includes('UJI Freelancer')), `${fl.j.data.length} freelancer`)
  cek('Daftar freelancer tidak membocorkan nomor rekening utuh (hanya 4 digit akhir tersamar)', fl.j.data.every(x => !('noRekening' in x) && (x.rekening == null || /^•+ ?\d{0,4}$|^•••• \d{4}$/.test(x.rekening))))
  const fk = await kk(`/freelancer?studioId=${keiko.id}`)
  cek('Koordinator Keiko melihat freelancer di circle-nya sendiri', fk.s === 200 && fk.j.data.some(x => x.nama.includes('UJI Freelancer')))
} catch (e) { console.error('GALAT:', e); process.exitCode = 1 } finally {
  if (idOrder) await prisma.orderProduksi.delete({ where: { id: idOrder } })
  if (orderUji) await prisma.orderProduksi.delete({ where: { id: orderUji } })
  if (talentUji) await prisma.talentEksternal.delete({ where: { id: talentUji } })
  if (akunUji) await prisma.akunProduksi.delete({ where: { id: akunUji } })
  console.log('(data uji dihapus)')
  await prisma.$disconnect()
}
