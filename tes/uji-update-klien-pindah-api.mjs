import { DASH } from './_jalur.mjs'
// Uji Update klien masukan tim (12 Nov 2026 malam): nama panggilan klien tampil; kolom Preview/Kata/Deliver bisa dicentang manual (catat) &
// dilepas (hapus catatan manual terakhir); pindah tahap langsung dari tabel: pengelola mendapat daftar tahap alur + aksi mesin; pindah ke
// tahap kerja → kartu pindah & masuk antrean talent; marketer pemegang hanya aksi mesin (bisaPindah false); talent ditolak. Data dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.48.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-ukp-' + T, 4)
const dibuat = [], orderIds = [], klienIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('ukp_koord', [['KOORDINATOR', S]]), tal = await user('ukp_tal', [['KARYAWAN', S]]), mkt = await user('ukp_mkt', [['KARYAWAN', S]])
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
  const tahap = await pastikanTahap(S)
  const preview = tahap.find(t => ['PREVIEW_KLIEN', 'PREVIEW'].includes(t.jenis)), kerja = tahap.find(t => t.jenis === 'KERJA')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const kl = await prisma.klienProduksi.create({ data: { studioId: S, nama: `uji_ukp_${T}`, panggilan: 'Marin' } }); klienIds.push(kl.id)
  const ord = async (judul, data = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: kl.nama, klienId: kl.id, judul: `${judul} ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId: preview.id, status: 'PROSES', tanggalMasuk: new Date(), ...data } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } }); await prisma.riwayatTahapOrder.create({ data: { orderId: o.id, namaTahap: preview.nama, jenis: 'PREVIEW_KLIEN', userId: koord.id, namaPengguna: 'x', mulai: new Date() } }); return o }
  const o1 = await ord('UJI-UKP base'), o2 = await ord('UJI-UKP milik marketer', { marketerId: mkt.id })

  let r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: tal.t }); cek('Talent → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/update-klien?studioId=${S}`); const b1 = r.j.data?.baris.find(x => x.id === o1.id)
  cek('Nama panggilan klien tampil', b1?.panggilan === 'Marin' && b1.klienId === kl.id, JSON.stringify({ p: b1?.panggilan }))
  cek('Pengelola: daftar tahap alur + bisaPindah + aksi mesin dengan tujuan', r.j.data.tahap.some(t => t.id === kerja.id) && b1.bisaPindah === true && b1.aksi.length > 0 && b1.aksi.every(a => a.ke) && b1.tahapId === preview.id, JSON.stringify(b1?.aksi))
  // centang manual
  r = await K('/api/circle/update-klien', { method: 'POST', body: { orderId: o1.id, jenis: 'KATA' } }); cek('Klik kotak Kata → tercatat (201)', r.s === 201)
  r = await K(`/api/circle/update-klien?studioId=${S}`); let b = r.j.data.baris.find(x => x.id === o1.id)
  cek('Kata tercentang & id catatan manual dikirim (untuk lepas centang)', b.kata === true && !!b.manual.KATA && b.terakhir)
  r = await K(`/api/circle/update-klien/catatan/${b.manual.KATA}`, { method: 'DELETE' }); cek('Lepas centang Kata → catatan manual dihapus (200)', r.s === 200)
  r = await K(`/api/circle/update-klien?studioId=${S}`); b = r.j.data.baris.find(x => x.id === o1.id); cek('Kata tidak tercentang lagi', b.kata === false && b.manual.KATA === null)
  // pindah tahap dari tabel → kerja → antrean talent
  r = await K(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja.id } }); cek('Pindah dari Preview klien ke tahap kerja → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  const sk = await prisma.orderProduksi.findUnique({ where: { id: o1.id }, select: { tahapId: true } })
  cek('Kartu di Produksi ikut pindah ke tahap kerja', sk.tahapId === kerja.id)
  r = await panggil(`/api/circle/antrean-saya?studioId=${S}`, { token: tal.t }); cek('Pekerjaan langsung masuk antrean talent', r.s === 200 && r.j.data.some(x => x.orderId === o1.id))
  // marketer pemegang
  r = await panggil(`/api/circle/update-klien?studioId=${S}`, { token: mkt.t }); const b2 = r.j.data?.baris.find(x => x.id === o2.id)
  cek('Marketer: melihat ordernya, bisaPindah false, tanpa daftar tahap', !!b2 && b2.bisaPindah === false && r.j.data.tahap.length === 0, JSON.stringify({ s: r.s, bp: b2?.bisaPindah, n: r.j.data?.tahap?.length }))
  r = await panggil(`/api/circle/orders/${o2.id}/tahap`, { method: 'PATCH', token: mkt.t, body: { tahapId: kerja.id } }); cek('Marketer pindah manual → 403', r.s === 403, String(r.s))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.klienProduksi.deleteMany({ where: { id: { in: klienIds } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
