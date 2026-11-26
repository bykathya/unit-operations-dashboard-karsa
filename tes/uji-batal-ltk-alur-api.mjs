import { DASH } from './_jalur.mjs'
// Uji permintaan tim 9 Nov 2026: (1) batalkan & pulihkan order, (2) hapus LTK salah isi pada status apa pun selama belum jadi order,
// (3) jenis langkah alur bisa diganti walau sudah dipakai order (antar jenis "tengah"), (4) platform prospek WhatsApp/Telegram/Email.
// Templat alur unit uji dikembalikan seperti semula; data sementara dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token, web = 'bloom' } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.44.1.${++xff % 250}`, ...(web ? { 'X-Unit-Web': web } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const S = keiko.id
const hash = await bcrypt.hash('uji-bla-' + Date.now(), 4)
const dibuat = [], orderIds = [], ltkIds = [], leadIds = []
let templatAsli = null
const user = async (kode, roles, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId: S, fungsi, terkonfirmasi: true } }); dibuat.push(u.id); return { id: u.id, c: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
try {
  const koord = await user('bl_koord', [['KOORDINATOR', S]])
  const mkt = await user('bl_mkt', [['KARYAWAN', S]], 'MARKETER'), mkt2 = await user('bl_mkt2', [['KARYAWAN', S]], 'MARKETER'), kar = await user('bl_kar', [['KARYAWAN', S]])
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const ord = async (judul, marketerId, extra = {}) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'KLIEN-UJI-BL', judul, nilaiKotor: 100000, nilaiBersih: 100000, marketerId, tanggalMasuk: new Date(), ...extra } }); orderIds.push(o.id); return o }

  console.log('— (1) batalkan & pulihkan order —')
  const a = await ord('UJI-BL A', mkt.id), b = await ord('UJI-BL B', mkt2.id), c = await ord('UJI-BL C dibayar', mkt.id), d = await ord('UJI-BL D selesai', mkt.id, { status: 'SELESAI' })
  await prisma.terminBayarOrder.create({ data: { orderId: c.id, label: 'DP', jumlah: 50000, urutan: 0, dibayarPada: new Date() } })
  let r = await panggil(`/api/circle/orders/${a.id}/batal`, { method: 'POST', token: mkt.c, body: { alasan: 'x'.repeat(301) } }); cek('Alasan >300 huruf → 422 (alasan kini opsional)', r.s === 422)
  r = await panggil(`/api/circle/orders/${a.id}/batal`, { method: 'POST', token: mkt.c, body: { alasan: 'salah input' } }); cek('Marketer pemegang membatalkan order miliknya → 200', r.s === 200, String(r.s))
  cek('Status order jadi BATAL', (await prisma.orderProduksi.findUnique({ where: { id: a.id } })).status === 'BATAL')
  r = await panggil(`/api/circle/papan?studioId=${S}`, { token: koord.c }); cek('Order batal tidak tampil di papan', r.s === 200 && !r.j.data.orders.some(o => o.id === a.id))
  r = await panggil(`/api/circle/orders-batal?studioId=${S}`, { token: koord.c }); const ob = r.j.data?.order?.find(o => o.id === a.id)
  cek('Daftar order dibatalkan memuat alasan & siapa', r.s === 200 && ob?.alasan === 'salah input' && ob?.oleh === 'Uji bl_mkt' && r.j.data.bisaPulihkan === true)
  r = await panggil(`/api/circle/orders/${b.id}/batal`, { method: 'POST', token: mkt.c, body: { alasan: 'x' } }); cek('Membatalkan order marketer LAIN → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${b.id}/batal`, { method: 'POST', token: kar.c, body: { alasan: 'x' } }); cek('Karyawan biasa membatalkan → 403', r.s === 403)
  r = await panggil(`/api/circle/orders/${c.id}/batal`, { method: 'POST', token: koord.c, body: { alasan: 'x' } }); cek('Order yang sudah ada termin dibayar → 409', r.s === 409)
  r = await panggil(`/api/circle/orders/${d.id}/batal`, { method: 'POST', token: koord.c, body: { alasan: 'x' } }); cek('Order Selesai → 409', r.s === 409)
  r = await panggil(`/api/circle/orders/${a.id}/pulihkan`, { method: 'POST', token: mkt.c }); cek('Marketer memulihkan → 403 (hanya koordinator)', r.s === 403)
  r = await panggil(`/api/circle/orders/${a.id}/pulihkan`, { method: 'POST', token: koord.c }); cek('Koordinator memulihkan → 200 & status bukan BATAL', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: a.id } })).status !== 'BATAL')

  console.log('— (2) hapus LTK salah isi —')
  r = await panggil('/api/circle/ltk', { method: 'POST', token: koord.c, body: { studioId: S, arah: 'LEMPAR', jenisPihak: 'KOMUNITAS', namaPihak: 'UJI-BL pihak', judul: 'UJI-BL ltk' } })
  cek('Buat LTK → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120)); const ltkId = r.j.data?.id; if (ltkId) ltkIds.push(ltkId)
  await prisma.kasusLtk.update({ where: { id: ltkId }, data: { status: 'DEAL', hargaSepakat: 1000000 } })
  r = await panggil(`/api/circle/ltk/${ltkId}`, { token: koord.c }); cek('LTK Deal tanpa order: bisaDihapus', r.s === 200 && r.j.data?.bisaDihapus === true)
  r = await panggil(`/api/circle/ltk/${ltkId}`, { method: 'DELETE', token: kar.c }); cek('Karyawan menghapus LTK → ditolak', r.s === 403 || r.s === 404, String(r.s))
  r = await panggil(`/api/circle/ltk/${ltkId}`, { method: 'DELETE', token: koord.c }); cek('Koordinator menghapus LTK Deal (tanpa order) → 200', r.s === 200, String(r.s))

  console.log('— (3) ganti jenis langkah yang sudah dipakai order —')
  r = await panggil(`/api/circle/templat?studioId=${S}`, { token: koord.c }); templatAsli = r.j.data?.langkah
  const kirimLangkah = (ls) => panggil(`/api/circle/templat?studioId=${S}`, { method: 'PUT', token: koord.c, body: { langkah: ls.map((l, i) => ({ id: l.id, nama: l.nama, jenis: l.jenis, indukId: l.indukId ?? null, urutan: i + 1, opsional: !!l.opsional, aktifBawaan: l.aktifBawaan ?? true })) } })
  const revisi = templatAsli?.find(l => l.jenis === 'REVISI_KLIEN'), inbox = templatAsli?.find(l => l.jenis === 'MASUK')
  await ord('UJI-BL di langkah revisi', mkt.id, { tahapId: revisi.id, status: 'PROSES' })
  r = await kirimLangkah(templatAsli.map(l => l.id === revisi.id ? { ...l, jenis: 'MENUNGGU_KLIEN' } : l)); cek('Langkah dipakai order: Revisi klien → Menunggu klien → 200', r.s === 200, JSON.stringify(r.j).slice(0, 150))
  r = await panggil(`/api/circle/templat?studioId=${S}`, { token: koord.c }); cek('Jenis tersimpan', r.j.data?.langkah?.find(l => l.id === revisi.id)?.jenis === 'MENUNGGU_KLIEN')
  const sekarang = r.j.data.langkah
  r = await kirimLangkah(sekarang.map(l => l.id === inbox.id ? { ...l, jenis: 'KERJA' } : l)); cek('Inbox tetap tidak bisa diganti → 4xx', r.s === 409 || r.s === 422, String(r.s))
  r = await kirimLangkah(templatAsli); cek('Templat dikembalikan seperti semula', r.s === 200, JSON.stringify(r.j).slice(0, 150)); if (r.s === 200) templatAsli = null

  console.log('— (4) platform prospek WhatsApp —')
  r = await panggil('/api/circle/marketing/lead', { method: 'POST', token: mkt.c, body: { studioId: S, klien: 'UJI-BL klien WA', platform: 'WhatsApp' } })
  cek('Prospek dengan platform WhatsApp → 201', r.s === 201, JSON.stringify(r.j).slice(0, 120)); if (r.j.data?.id) leadIds.push(r.j.data.id)
  r = await panggil(`/api/circle/marketing/ruang?studioId=${S}`, { token: mkt.c }); cek('Daftar platform memuat WhatsApp, Telegram, Email', ['WhatsApp', 'Telegram', 'Email'].every(p => r.j.data?.platform?.sosmed?.includes(p)))
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  if (templatAsli) console.log('⚠️ Templat alur Keiko belum dikembalikan — periksa manual')
  await prisma.marketingLead.deleteMany({ where: { id: { in: leadIds } } })
  await prisma.kasusLtk.deleteMany({ where: { id: { in: ltkIds } } })
  await prisma.terminBayarOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
