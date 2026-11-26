import { DASH } from './_jalur.mjs'
// Uji KABAR ORDER BARU KE GRUP KOORDINATOR (12 Nov 2026): teks pesan (unit, akun, klien + panggilan, judul, nilai Rp / USD, deadline, talent,
// pencatat); mati bila TELEGRAM_GRUP_ORDER kosong; beberapa order beruntun dikirim berurutan dengan jeda. fetch Telegram DIGANTI penangkap —
// tidak ada pesan sungguhan. Memakai Keiko lokal; data sementara dihapus. (Tanpa server: memanggil modul langsung.)
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { pesanOrderBaru, kabarOrderBaru } = await import(DASH + '/server/src/utils/notifGrup.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const tunggu = (ms) => new Promise(r => setTimeout(r, ms))
const terkirim = []
globalThis.fetch = async (url, opsi) => { terkirim.push({ url, body: JSON.parse(opsi.body) }); return { ok: true, text: async () => '' } }
const T = Date.now(), orderIds = [], klienIds = []
try {
  const t = pesanOrderBaru({ unit: 'Keiko', lingkup: 'Bloom Circle', akun: 'Fiverr · Sekai_3d', klien: 'alberto_tog', panggilan: 'Albert', judul: 'Marin Kitagawa', nilai: 1500000, mataUang: 'USD', nilaiUsd: 100, kurs: 15000, deadline: new Date('2026-11-20T00:00:00+07:00'), talent: ['Zaid'], pencatat: 'Marketer A' })
  cek('Teks format bot lapor: New Order, unit · circle, akun, pelapor', t.startsWith('🛒 <b>New Order</b>') && t.includes('🏢 Keiko · Bloom Circle') && t.includes('🏪 Fiverr · Sekai_3d') && t.includes('👤 Marketer A'), t)
  cek('Teks: baris order klien (panggilan) — judul, deadline WIB, talent', t.includes('1. alberto_tog (Albert) — Marin Kitagawa') && t.includes('📅 Deadline: 20 Nov 2026') && t.includes('🎨 Talent: Zaid'), t)
  cek('Teks: total USD + Rupiah, tanda dari web circle', t.includes('💰 <b>Total order: $100 (Rp 1.500.000)</b>') && t.includes('otomatis dari web circle'), t)
  const t2 = pesanOrderBaru({ unit: 'Pibi', klien: 'a<b>&c', judul: 'y', nilai: 0 })
  cek('Teks: tanpa akun/deadline/talent tidak menulis barisnya; karakter HTML aman', !t2.includes('🏪') && !t2.includes('📅') && !t2.includes('🎨') && t2.includes('Total order: Rp 0') && t2.includes('a&lt;b&gt;&amp;c'), t2)

  const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const kl = await prisma.klienProduksi.create({ data: { studioId: S, nama: `uji_ng_${T}`, panggilan: 'Marin' } }); klienIds.push(kl.id)
  const buat = async (judul) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: kl.nama, klienId: kl.id, judul: `${judul} ${T}`, nilaiKotor: 750000, nilaiBersih: 750000, status: 'MASUK', tanggalMasuk: new Date(), riwayatTahap: { create: { namaTahap: 'Inbox', jenis: 'MASUK', namaPengguna: 'Uji Pencatat' } } } }); orderIds.push(o.id); return o }
  const o1 = await buat('UJI-NG satu')

  const lama = process.env.TELEGRAM_GRUP_ORDER, tokenLama = process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_GRUP_ORDER
  kabarOrderBaru(o1.id); await tunggu(400)
  cek('TELEGRAM_GRUP_ORDER kosong → tidak mengirim apa pun', terkirim.length === 0)

  const topikLama = process.env.TELEGRAM_TOPIK_ORDER, botLama = process.env.TELEGRAM_BOT_ORDER_TOKEN
  process.env.TELEGRAM_GRUP_ORDER = '-100123'; process.env.TELEGRAM_TOPIK_ORDER = '2216'; process.env.TELEGRAM_BOT_ORDER_TOKEN = 'TOKEN-BOT-LAPOR'
  kabarOrderBaru(o1.id); await tunggu(600)
  const k = terkirim[0]
  cek('Order baru → satu pesan ke grup & TOPIK yang diatur, lewat token bot lapor, HTML', terkirim.length === 1 && k.body.chat_id === '-100123' && k.body.message_thread_id === 2216 && k.url.includes('botTOKEN-BOT-LAPOR/sendMessage') && k.body.parse_mode === 'HTML')
  cek('Isi pesan dari data order (unit, klien + panggilan, nilai, pencatat)', k.body.text.includes('🏢 Keiko') && k.body.text.includes(`1. ${kl.nama} (Marin) — UJI-NG satu`) && k.body.text.includes('Total order: Rp 750.000') && k.body.text.includes('👤 Uji Pencatat'), k.body.text)
  const o2 = await buat('UJI-NG dua'), o3 = await buat('UJI-NG tiga')
  kabarOrderBaru(o2.id); kabarOrderBaru(o3.id); await tunggu(800)
  cek('Dua order beruntun: pesan pertama langsung, berikutnya menunggu jeda (tidak membanjiri grup)', terkirim.length === 2, String(terkirim.length))
  await tunggu(3800)
  cek('…lalu pesan berikutnya terkirim setelah jeda', terkirim.length === 3 && terkirim[2].body.text.includes('UJI-NG tiga'), String(terkirim.length))
  if (lama) process.env.TELEGRAM_GRUP_ORDER = lama; else delete process.env.TELEGRAM_GRUP_ORDER
  if (tokenLama) process.env.TELEGRAM_BOT_TOKEN = tokenLama; else delete process.env.TELEGRAM_BOT_TOKEN
  if (topikLama) process.env.TELEGRAM_TOPIK_ORDER = topikLama; else delete process.env.TELEGRAM_TOPIK_ORDER
  if (botLama) process.env.TELEGRAM_BOT_ORDER_TOKEN = botLama; else delete process.env.TELEGRAM_BOT_ORDER_TOKEN
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.riwayatTahapOrder.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.klienProduksi.deleteMany({ where: { id: { in: klienIds } } })
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
