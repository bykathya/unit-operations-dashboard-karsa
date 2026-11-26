import { DASH } from './_jalur.mjs'
// Uji MASUKAN TIM 13 Nov 2026: (1) tim — kartu dipindah MUNDUR manual (mis. Revisi → Inbox) tidak masuk Tugas selesai talent (DITUTUP),
// loncatan MAJU manual tetap selesai; (2) tim — fungsi kerja di Tim: Admin Market tidak bisa mengubah fungsi Koordinator (sejak 13 Nov sore boleh untuk tim produksi); (3) tim — prospek
// berisian seperti Tambah order (judul, jenis klien, deadline, talent), bisa diubah, dan "Jadikan order" membawa semua isiannya; (4) tim —
// catatan langsung di tabel Update klien (jenis CATATAN, tidak mengubah "terakhir dikabari"); (5) tim — aktivitas "Lainnya (tulis sendiri)".
// Memakai Keiko lokal; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.48.3.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-m13-' + T, 4)
const dibuat = [], orderIds = [], akunIds = [], leadIds = []
const user = async (kode, roleType) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); await prisma.userRole.create({ data: { userId: u.id, roleType, studioId: S } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
try {
  const koord = await user('m13_koord', 'KOORDINATOR'), adm = await user('m13_adm', 'KARYAWAN'), tal = await user('m13_tal', 'KARYAWAN'), mkt = await user('m13_mkt', 'KARYAWAN')
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.fungsiAnggota.create({ data: { userId: mkt.id, studioId: S, fungsi: 'MARKETER', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o })
  const akun = (await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Etsy', namaAkun: `UJI-M13 ${T}`, feePersen: 0 } })).id; akunIds.push(akun)
  const tahap = await pastikanTahap(S)
  const inbox = tahap.find(t => t.jenis === 'MASUK'), kerja = tahap.filter(t => t.jenis === 'KERJA').sort((a, b) => a.urutan - b.urutan)
  const akhir = tahap.find(t => t.jenis === 'SELESAI')

  // ── (1) pindah mundur manual = DITUTUP, maju = SELESAI ──
  const ord = async (judul) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun, klien: 'UJI-M13 klien', judul: `${judul} ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId: inbox.id, status: 'MASUK', tanggalMasuk: new Date() } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId: tal.id } }); return o }
  const o1 = await ord('UJI-M13 mundur')
  let r = await K(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja[0].id } })
  const aktif1 = await prisma.penugasanTahap.findFirst({ where: { orderId: o1.id, userId: tal.id, status: 'DIKERJAKAN' } })
  cek('Masuk tahap kerja → penugasan talent aktif', r.s === 200 && !!aktif1, String(r.s))
  r = await K(`/api/circle/orders/${o1.id}/tahap`, { method: 'PATCH', body: { tahapId: inbox.id } })
  const b1 = await prisma.penugasanTahap.findUnique({ where: { id: aktif1.id } })
  cek('Admin pindah MUNDUR ke Inbox → penugasan DITUTUP (bukan selesai)', r.s === 200 && b1.status === 'DITUTUP' && !b1.selesaiPada, b1.status)
  const ts = await panggil(`/api/circle/tugas-selesai?studioId=${S}`, { token: tal.t })
  cek('…dan tidak muncul di Tugas selesai talent', ts.s === 200 && !(ts.j.data?.tugas ?? []).some(x => x.orderId === o1.id), String(ts.s))
  const o2 = await ord('UJI-M13 maju')
  await K(`/api/circle/orders/${o2.id}/tahap`, { method: 'PATCH', body: { tahapId: kerja[0].id } })
  const aktif2 = await prisma.penugasanTahap.findFirst({ where: { orderId: o2.id, userId: tal.id, status: 'DIKERJAKAN' } })
  const sesudah = tahap.filter(t => t.urutan > kerja[0].urutan && t.jenis !== 'SELESAI' && t.jenis !== 'HOLD').sort((a, b) => a.urutan - b.urutan)[0] ?? akhir
  await K(`/api/circle/orders/${o2.id}/tahap`, { method: 'PATCH', body: { tahapId: sesudah.id } })
  const b2 = await prisma.penugasanTahap.findUnique({ where: { id: aktif2.id } })
  cek('Admin loncat MAJU → penugasan tetap SELESAI (kontribusi talent aman)', b2.status === 'SELESAI' && !!b2.selesaiPada, `${b2.status} → ${sesudah.nama}`)

  // ── (2) fungsi kerja hanya Koordinator ──
  r = await panggil(`/api/circle/tim?studioId=${S}`, { token: adm.t })
  cek('Admin Market membuka Tim → bisaUbah false', r.s === 200 && r.j.data?.bisaUbah === false, String(r.s))
  // 13 Nov sore (masukan tim): Admin Market boleh untuk tim produksi — dicek di uji-masukan-13nov-sore-api; koordinator tetap tidak
  r = await panggil(`/api/circle/tim/${koord.id}?studioId=${S}`, { method: 'PUT', token: adm.t, body: { fungsi: [{ fungsi: 'ARTIST', bidang: '' }] } })
  cek('Admin Market ubah fungsi kerja Koordinator → 403', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/tim/terima-saran?studioId=${S}`, { method: 'POST', token: adm.t })
  cek('Admin Market "Terima semua tebakan" → 403', r.s === 403, String(r.s))
  r = await K(`/api/circle/tim?studioId=${S}`)
  cek('Koordinator → bisaUbah true', r.s === 200 && r.j.data?.bisaUbah === true, String(r.s))

  // ── (3) prospek seperti Tambah order ──
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.t, body: { studioId: S, klien: `uji_klein_${T}`, judul: 'Chibi Emote', tipeKlien: 'EKSTERNAL', akunId: akun, mataUang: 'IDR', estimasiNilai: '250000', deadline: '2031-02-10', talentUserId: tal.id } })
  const leadId = r.j.data?.id; if (leadId) leadIds.push(leadId)
  cek('Marketer tambah prospek berisi judul, jenis klien, akun, deadline, talent', r.s === 201 && !!leadId, String(r.s))
  r = await panggil(`/api/circle/marketing/lead?studioId=${S}`, { token: mkt.t })
  const L = (r.j.data?.lead ?? []).find(x => x.id === leadId)
  cek('Daftar prospek membawa isian + pilihan talent + bisaUbah', !!L && L.judul === 'Chibi Emote' && L.talent === 'Uji m13_tal' && L.bisaUbah === true && (r.j.data?.talent ?? []).length > 0, JSON.stringify(L ?? {}).slice(0, 160))
  r = await panggil(`/api/circle/marketing/lead/${leadId}`, { method: 'PATCH', token: mkt.t, body: { klien: `uji_klien_${T}` } })
  const l2 = await prisma.marketingLead.findUnique({ where: { id: leadId } })
  cek('Salah ketik nama klien bisa diubah (isian lain tetap)', r.s === 200 && l2.klien === `uji_klien_${T}` && l2.judul === 'Chibi Emote' && l2.estimasiNilai === 250000, String(r.s))
  r = await panggil(`/api/circle/marketing/lead/${leadId}`, { method: 'PATCH', token: tal.t, body: { klien: 'x' } })
  cek('Talent (bukan pemilik) tidak bisa mengubah prospek', r.s === 403, String(r.s))
  r = await panggil(`/api/circle/marketing/lead/${leadId}/jadi-order`, { method: 'POST', token: mkt.t, body: {} })
  const oid = r.j.data?.orderId; if (oid) orderIds.push(oid)
  const oj = oid ? await prisma.orderProduksi.findUnique({ where: { id: oid }, include: { assignments: true } }) : null
  cek('Jadikan order tanpa isian ulang → judul, klien, nilai, deadline, akun, talent terbawa', r.s === 201 && oj?.judul === 'Chibi Emote' && oj.klien === `uji_klien_${T}` && oj.nilaiKotor === 250000 && oj.akunId === akun && oj.deadline?.toISOString().startsWith('2031-02-10') && oj.assignments.some(a => a.userId === tal.id) && oj.tipeKlien === 'EKSTERNAL', String(r.s))
  cek('…klien otomatis tertaut ke direktori Klien', !!oj?.klienId)
  r = await panggil(`/api/circle/marketing/lead/${leadId}`, { method: 'PATCH', token: mkt.t, body: { judul: 'x' } })
  cek('Prospek yang sudah jadi order tidak bisa diubah lagi', r.s === 409, String(r.s))

  // ── (4) catatan di tabel Update klien ──
  const oc = await ord('UJI-M13 catatan')
  r = await K('/api/circle/update-klien', { method: 'POST', body: { orderId: oc.id, jenis: 'CATATAN', catatan: '' } })
  cek('Catatan kosong ditolak', r.s === 422, String(r.s))
  r = await K('/api/circle/update-klien', { method: 'POST', body: { orderId: oc.id, jenis: 'CATATAN', catatan: 'Klien minta warna rambut lebih terang' } })
  cek('Catatan langsung di tabel tersimpan', r.s === 201, String(r.s))
  r = await K(`/api/circle/update-klien?studioId=${S}`)
  const bc = (r.j.data?.baris ?? []).find(x => x.id === oc.id)
  cek('Kolom Catatan menampilkan catatan terakhir; "terakhir dikabari" TIDAK berubah', bc?.catatanTerakhir === 'Klien minta warna rambut lebih terang' && bc.belumPernah === true && bc.jumlahCatatan === 1, JSON.stringify({ c: bc?.catatanTerakhir, t: bc?.terakhir }))

  // ── (5) aktivitas Lainnya ──
  const hari = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  r = await panggil('/api/circle/marketing/aktivitas', { method: 'POST', token: mkt.t, body: { studioId: S, tanggal: hari, items: [{ jenis: 'lainnya', judul: 'Riset tren karakter', jumlah: 2 }] } })
  cek('Aktivitas "Lainnya (tulis sendiri)" cukup nama aktivitas', r.s === 201, String(r.s) + ' ' + JSON.stringify(r.j.galat ?? ''))
  r = await panggil('/api/circle/marketing/aktivitas', { method: 'POST', token: mkt.t, body: { studioId: S, tanggal: hari, items: [{ jenis: 'lainnya', judul: '' }] } })
  cek('…nama aktivitas wajib', r.s === 422, String(r.s))

  // ── (6) kurs bawaan form = kurs Laporan Mingguan terbaru (satu sumber kurs) ──
  const lapTerbaru = await prisma.weeklyReport.findFirst({ where: { studioId: S, kurs: { gt: 0 } }, orderBy: { periodeAwal: 'desc' }, select: { kurs: true } })
  r = await K(`/api/circle/kurs?studioId=${S}`)
  cek('Kurs form = kurs Laporan Mingguan terbaru unit (atau 16000 bila belum ada)', r.s === 200 && r.j.data?.kurs === (lapTerbaru?.kurs ?? 16000) && r.j.data.dari === (lapTerbaru ? 'laporan' : 'bawaan'), JSON.stringify(r.j.data))
  r = await panggil(`/api/circle/kurs?studioId=${S}`, { token: mkt.t }); cek('Marketer boleh membaca kurs', r.s === 200, String(r.s))
  r = await panggil(`/api/circle/kurs?studioId=${S}`, { token: tal.t }); cek('Talent tidak menerima kurs', r.s === 403, String(r.s))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.aktivitasMarketer.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.marketingLead.deleteMany({ where: { id: { in: leadIds } } })
  await prisma.updateKlien.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.penugasanTahap.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.assignmentProduksi.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.auditOrder?.deleteMany?.({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } }).catch(e => console.log('sisa order:', e.message))
  await prisma.klienProduksi.deleteMany({ where: { studioId: S, nama: { startsWith: 'uji_kl' } } }).catch(() => {})
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunIds } } }).catch(() => {})
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }).catch(() => {}) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
