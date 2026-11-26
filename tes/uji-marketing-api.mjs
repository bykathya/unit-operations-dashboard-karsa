import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0, xff = 0
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
const api = (uid, klaim = {}) => { const t = jwt.sign({ id: uid, ...klaim }, process.env.JWT_SECRET, { expiresIn: '10m' }); return async (path, method = 'GET', body) => { const r = await fetch('http://localhost:3001/api/circle' + path, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'X-Forwarded-For': `172.22.${(++xff >> 8) & 255}.${xff & 255}`, ...(klaim.cs ? { 'X-Unit-Web': klaim.cs } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } } }

const studio = await prisma.studio.findFirst({ where: { nama: 'Sekartaji' } })
const lain = await prisma.studio.findFirst({ where: { nama: { startsWith: 'Pibi' } } })
const dibuat = [], akunDibuat = [], orderDibuat = []
const buat = async (kode, role, studioId, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: 'x', statusAktif: true } }); dibuat.push(u.id); await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId, fungsi, terkonfirmasi: true } }); return u.id }
const hari = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
try {
  const idK = await buat('mk_koord', 'KOORDINATOR', studio.id, 'PM_QC'), idM = await buat('mk_mkt', 'KARYAWAN', studio.id, 'MARKETER'), idM2 = await buat('mk_mkt2', 'KARYAWAN', studio.id, 'MARKETER')
  const idA = await buat('mk_artist', 'KARYAWAN', studio.id, 'ARTIST'), idL = await buat('mk_koord_lain', 'KOORDINATOR', lain.id, 'PM_QC')
  const akunA = await prisma.akunProduksi.create({ data: { studioId: studio.id, platform: 'Fiverr', namaAkun: 'UJI Fiverr', feePersen: 0.2 } }); akunDibuat.push(akunA.id)
  const akunB = await prisma.akunProduksi.create({ data: { studioId: studio.id, platform: 'Vgen', namaAkun: 'UJI Vgen', feePersen: 0.1 } }); akunDibuat.push(akunB.id)
  const akunLain = await prisma.akunProduksi.create({ data: { studioId: lain.id, platform: 'Etsy', namaAkun: 'UJI Etsy lain', feePersen: 0 } }); akunDibuat.push(akunLain.id)
  const K = api(idK), M1 = api(idM), M2 = api(idM2), A = api(idA), L = api(idL)
  const q = `?studioId=${studio.id}`

  console.log('— akses —')
  let r = await M1('/marketing/ruang' + q); cek('Marketer membuka ruang kerja', r.s === 200 && r.j.data.peran.marketer && r.j.data.katalog.length === 17) // + Follow up klien lama (24 Nov 2026)
  r = await K('/marketing/ruang' + q); cek('Koordinator membuka ruang kerja (peran manajer)', r.s === 200 && r.j.data.peran.manajer)
  r = await A('/marketing/ruang' + q); cek('Artist (bukan marketer) → 403', r.s === 403)
  r = await L('/marketing/ruang' + q); cek('Koordinator studio lain → 403', r.s === 403)
  r = await M1(`/marketing/ruang?studioId=${lain.id}`); cek('Marketer membuka studio circle lain → 403', r.s === 403)
  const tokBloom = api(idM, { aud: 'circle', cs: 'bloom' }); r = await tokBloom('/marketing/ruang' + q); cek('Token circle Bloom ke studio Bloom → 200', r.s === 200)
  const tokNaya = api(idM, { aud: 'circle', cs: 'naya' }); r = await tokNaya('/marketing/ruang' + q); cek('Token circle NAYA ke studio Bloom → 403 (terikat circle)', r.s === 403)

  console.log('— penugasan akun —')
  r = await M1('/marketing/akun/penugasan', 'PUT', { studioId: studio.id, userId: idM, akunIds: [akunA.id] }); cek('Marketer menugaskan akun untuk dirinya → 403 (hanya koordinator)', r.s === 403)
  r = await K('/marketing/akun/penugasan', 'PUT', { studioId: studio.id, userId: idA, akunIds: [akunA.id] }); cek('Menugaskan akun ke non-marketer (artist) → 422', r.s === 422)
  r = await K('/marketing/akun/penugasan', 'PUT', { studioId: studio.id, userId: idM, akunIds: [akunLain.id] }); cek('Menugaskan akun milik studio lain → 422', r.s === 422)
  r = await K('/marketing/akun/penugasan', 'PUT', { studioId: studio.id, userId: idM, akunIds: [akunA.id, akunB.id] }); cek('Koordinator menugaskan 2 akun ke marketer 1', r.s === 200)
  r = await K('/marketing/akun/penugasan', 'PUT', { studioId: studio.id, userId: idM2, akunIds: [akunB.id] }); cek('…dan 1 akun ke marketer 2', r.s === 200)
  r = await M1('/marketing/akun' + q); cek('Marketer hanya melihat penugasannya sendiri', r.j.data.marketer.length === 1 && r.j.data.marketer[0].akunIds.length === 2)
  r = await K('/marketing/akun' + q); cek('Koordinator melihat semua marketer', r.j.data.marketer.length >= 2 && r.j.data.bisaAtur)

  console.log('— aktivitas harian —')
  const post = { jenis: 'publish_post', judul: 'Promo emote', platform: 'X', akunId: akunA.id, link: 'https://x.com/a/1', jamPosting: '14:30', jumlah: 2 }
  r = await M1('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: [post, { jenis: 'engage_reply', judul: 'Balas @kuma', platform: 'X', akunId: akunA.id, link: 'https://x.com/b/2', targetAkun: '@kuma', pengikut: 1200, jumlah: 10 }, { jenis: 'optimize_seo', judul: 'SEO gig', platform: 'Fiverr', akunId: akunB.id, link: 'https://fiverr.com/x' }] })
  cek('Marketer menyimpan 3 aktivitas valid', r.s === 201 && r.j.data.dibuat === 3, r.j.message)
  r = await M1('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: [{ jenis: 'publish_post' }, { jenis: 'engage_reply', judul: 'x', platform: 'X', akunId: akunA.id, link: 'https://x.com/1' }] })
  cek('Isian tidak lengkap → 422 dengan galat per baris & per field', r.s === 422 && r.j.galat.some(g => g.baris === 1 && g.field === 'judul') && r.j.galat.some(g => g.baris === 2 && g.field === 'targetAkun'), `${r.j.galat?.length} galat`)
  r = await M1('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: [{ ...post, akunId: akunLain.id }] }); cek('Akun studio lain → 422', r.s === 422)
  r = await M2('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: [post] }); cek('Marketer 2 memakai akun yang TIDAK ditugaskan padanya → 422', r.s === 422)
  r = await M1('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: '2099-01-01', items: [post] }); cek('Tanggal masa depan → 422', r.s === 422)
  r = await M1('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: Array.from({ length: 51 }, () => post) }); cek('51 aktivitas sekaligus → 422', r.s === 422)
  r = await A('/marketing/aktivitas', 'POST', { studioId: studio.id, tanggal: hari, items: [post] }); cek('Artist menulis aktivitas marketing → 403', r.s === 403)
  r = await M1('/marketing/ruang' + q); const akt = r.j.data.aktivitas
  cek('Ruang kerja menampilkan 3 aktivitas hari ini', akt.length === 3)
  r = await M2('/marketing/aktivitas/' + akt[0].id, 'PATCH', { selesai: true }); cek('Marketer lain mengubah aktivitas orang → 403', r.s === 403)
  for (const a of akt) await M1('/marketing/aktivitas/' + a.id, 'PATCH', { selesai: true })
  r = await M1('/marketing/aktivitas/' + akt[0].id, 'PATCH', { jumlah: 0 }); cek('Jumlah 0 → 422', r.s === 422)
  r = await K('/marketing/aktivitas/' + akt[2].id, 'PATCH', { selesai: false }); cek('Koordinator boleh mengubah aktivitas anggota', r.s === 200)
  await K('/marketing/aktivitas/' + akt[2].id, 'PATCH', { selesai: true })
  r = await M1('/marketing/ruang' + q); cek('KPI bulan ini: post 2, reply 10, seo 1 (terkumpul dari yang selesai × jumlah)', r.j.data.kpiBulanIni.post === 2 && r.j.data.kpiBulanIni.reply === 10 && r.j.data.kpiBulanIni.seo === 1, JSON.stringify(r.j.data.kpiBulanIni))

  console.log('— rencana bulanan —')
  r = await M1('/marketing/rencana' + q); const rc = r.j.data.marketer[0]
  cek('Rencana: 2 akun, target standar dipakai (Okt: post 14, reply 155)', rc.akun.length === 2 && rc.akun.every(a => a.pakaiStandar) && rc.akun[0].target.reply === r.j.data.targetStandar.reply)
  const pa = rc.akun.find(a => a.akunId === akunA.id)
  cek(`Realisasi akun A: post 2, reply 10; persen reply = 10 dari target bulan ini (${pa.target.reply})`, pa.realisasi.post === 2 && pa.realisasi.reply === 10 && pa.progres.find(x => x.kunci === 'reply').persen === Math.round((10 / pa.target.reply) * 100), JSON.stringify({ ...pa.realisasi, persen: pa.progres.find(x => x.kunci === 'reply').persen }))
  r = await M1('/marketing/rencana', 'PUT', { studioId: studio.id, akunId: akunA.id, post: 12, reply: 100, update: 6, seo: 4 }); cek('Marketer menyimpan target kustom untuk akunnya', r.s === 200)
  r = await M1('/marketing/rencana' + q); cek('Target kustom menggantikan standar', r.j.data.marketer[0].akun.find(a => a.akunId === akunA.id).target.reply === 100 && !r.j.data.marketer[0].akun.find(a => a.akunId === akunA.id).pakaiStandar)
  r = await M1('/marketing/rencana', 'PUT', { studioId: studio.id, akunId: akunA.id, post: 99999, reply: 1, update: 1, seo: 1 }); cek('Target di luar 0–5000 → 422', r.s === 422)
  r = await M1('/marketing/rencana', 'PUT', { studioId: studio.id, akunId: akunA.id, userId: idM2, post: 1, reply: 1, update: 1, seo: 1 }); cek('Marketer mencoba menyetel target marketer lain → tetap menyasar dirinya sendiri (userId diabaikan)', r.s === 200 && (await prisma.targetMarketing.findFirst({ where: { userId: idM2, akunId: akunA.id } })) === null)
  r = await K('/marketing/rencana', 'PUT', { studioId: studio.id, akunId: akunA.id, userId: idM2, post: 1, reply: 1, update: 1, seo: 1 }); cek('Koordinator menyetel akun yang belum ditugaskan ke marketer 2 → 422', r.s === 422)
  r = await K('/marketing/rencana?semua=1&studioId=' + studio.id); cek('Koordinator melihat rencana semua marketer', r.j.data.marketer.length >= 2)
  r = await M1('/marketing/rencana?semua=1&studioId=' + studio.id); cek('Marketer meminta "semua" tetap hanya dirinya', r.j.data.marketer.length === 1)

  console.log('— profil & log harian —')
  r = await M1('/marketing/profil', 'PUT', { studioId: studio.id, profil: [{ platform: 'X', link: 'https://x.com/studio' }, { platform: 'Etsy', link: 'https://etsy.com/shop/s', label: 'Toko utama' }] }); cek('Marketer menyimpan 2 profil', r.s === 200)
  r = await M1('/marketing/profil', 'PUT', { studioId: studio.id, profil: [{ platform: 'Facebook', link: 'https://f.com/x' }] }); cek('Platform tak dikenal → 422', r.s === 422)
  r = await M1('/marketing/profil', 'PUT', { studioId: studio.id, profil: [{ platform: 'X', link: 'javascript:alert(1)' }] }); cek('Link bukan http(s) → 422', r.s === 422)
  r = await K('/marketing/profil' + q); cek('Koordinator melihat profil tim', r.j.data.profil.length >= 2)
  r = await M2('/marketing/profil' + q); cek('Marketer 2 tidak melihat profil marketer 1', r.j.data.profil.length === 0)
  r = await M1('/marketing/log', 'PUT', { studioId: studio.id, tanggal: hari, mood: 'semangat', catatan: 'Hari bagus' }); cek('Marketer mencatat suasana hati', r.s === 200)
  r = await M1('/marketing/log', 'PUT', { studioId: studio.id, tanggal: hari, mood: 'lapar' }); cek('Suasana hati tak dikenal → 422', r.s === 422)
  r = await M1('/marketing/log' + q); cek('Marketer membaca log miliknya', r.j.data.log.length === 1 && r.j.data.log[0].mood === 'semangat')
  r = await K('/marketing/log' + q); cek('PRIVASI: koordinator tidak melihat log suasana hati marketer', r.j.data.log.length === 0)

  console.log('— prospek (lead) → order —')
  r = await M1('/marketing/lead', 'POST', { studioId: studio.id, klien: 'Streamer Nara', platform: 'X', akunId: akunA.id, estimasiNilai: 450000, catatan: 'DM masuk' }); const idLead = r.j.data?.id; cek('Marketer menambah prospek', r.s === 201)
  r = await M2('/marketing/lead', 'POST', { studioId: studio.id, klien: 'Milik marketer 2' }); cek('Marketer 2 menambah prospek sendiri', r.s === 201)
  r = await A('/marketing/lead', 'POST', { studioId: studio.id, klien: 'x' }); cek('Artist menambah prospek → 403', r.s === 403)
  r = await M1('/marketing/lead' + q); cek('Marketer hanya melihat prospeknya', r.j.data.lead.length === 1 && r.j.data.lead[0].klien === 'Streamer Nara')
  r = await K('/marketing/lead' + q); cek('Koordinator melihat semua prospek', r.j.data.lead.length >= 2)
  r = await M1('/marketing/lead/' + idLead, 'PATCH', { status: 'NEGO' }); const lNego = await prisma.marketingLead.findUnique({ where: { id: idLead } }); cek('Status → Nego mencatat waktu follow-up', r.s === 200 && lNego.status === 'NEGO' && !!lNego.tanggalFollowUpTerakhir)
  r = await M1('/marketing/lead/' + idLead, 'PATCH', { status: 'CONVERTED' }); cek('Mengubah status langsung ke Converted ditolak (harus lewat "Jadikan order")', r.s === 422)
  r = await M2('/marketing/lead/' + idLead, 'PATCH', { status: 'LOST' }); cek('Marketer lain mengubah prospek orang → 403', r.s === 403)
  r = await M1(`/marketing/lead/${idLead}/jadi-order`, 'POST', { judul: 'Emote set Nara', nilaiDisepakati: 450000, deadline: '2026-12-01' }); const idOrder = r.j.data?.orderId; if (idOrder) orderDibuat.push(idOrder)
  cek('Prospek dijadikan order (masuk Inbox)', r.s === 201 && !!idOrder)
  const oLead = await prisma.orderProduksi.findUnique({ where: { id: idOrder } })
  cek('Order tercatat: marketer = pembuat prospek, status MASUK, akun dari prospek (fee 20% → bersih 360rb), jenis klien eksternal', oLead.marketerId === idM && oLead.status === 'MASUK' && oLead.akunId === akunA.id && oLead.nilaiBersih === 360000 && oLead.tipeKlien === 'EKSTERNAL', `bersih ${oLead.nilaiBersih}`)
  cek('Prospek menjadi Converted & tertaut ke order', (await prisma.marketingLead.findUnique({ where: { id: idLead } })).orderId === idOrder)
  r = await M1(`/marketing/lead/${idLead}/jadi-order`, 'POST', {}); cek('Menjadikan order dua kali → 409', r.s === 409)

  console.log('— antrean klien (fase milik marketer) —')
  const tahap = await prisma.tahapProduksi.findMany({ where: { studioId: studio.id } })
  const idT = (j) => tahap.find(t => t.jenis === j)?.id
  const o2 = await prisma.orderProduksi.create({ data: { studioId: studio.id, akunId: akunA.id, klien: 'KLIEN-UJI', judul: 'UJI antrean preview', nilaiKotor: 100000, nilaiBersih: 80000, status: 'PROSES', subStatus: 'Preview', tahapId: idT('PREVIEW_KLIEN'), tahapAktif: ['-'] } }); orderDibuat.push(o2.id)
  const o3 = await prisma.orderProduksi.create({ data: { studioId: studio.id, akunId: akunA.id, klien: 'KLIEN-UJI', judul: 'UJI masih dikerjakan', nilaiKotor: 100000, nilaiBersih: 80000, status: 'PROSES', subStatus: 'Pengerjaan', tahapId: idT('KERJA'), tahapAktif: ['-'] } }); orderDibuat.push(o3.id)
  r = await M1('/marketing/ruang' + q); const ant = r.j.data.antrean
  cek('Antrean marketer berisi order di fase Klien, bukan yang masih dikerjakan', ant.some(x => x.id === o2.id) && !ant.some(x => x.id === o3.id), ant.map(x => x.judul).join('|'))
  const a2 = ant.find(x => x.id === o2.id)
  cek('Aksi di Preview (templat Sederhana, tanpa langkah Menunggu client): Klien setuju / Klien minta revisi', a2.aksi.map(x => x.aksi).sort().join() === 'lanjut,revisi_klien', a2.aksi.map(x => x.label).join('|'))
  r = await M1(`/orders/${o2.id}/aksi`, 'POST', { aksi: 'revisi_klien' }); cek('Marketer: klien minta revisi → order ke Revisi (hitungan revisi naik)', r.s === 200 && (await prisma.orderProduksi.findUnique({ where: { id: o2.id } })).revisiKe === 1, r.j.message)
  r = await M1(`/orders/${o3.id}/aksi`, 'POST', { aksi: 'lanjut' }); cek('Marketer TIDAK bisa memajukan order yang masih di Produksi → 409', r.s === 409)
  r = await M1('/orders', 'POST', { studioId: studio.id, judul: 'UJI order oleh marketer', klien: 'KLIEN-UJI', nilaiDisepakati: 50000, akunId: 'INTERNAL' }); if (r.j.data?.id) orderDibuat.push(r.j.data.id)
  cek('Marketer membuat order langsung (marketer tercatat)', r.s === 201 && (await prisma.orderProduksi.findUnique({ where: { id: r.j.data.id } })).marketerId === idM)
  r = await A('/orders', 'POST', { studioId: studio.id, judul: 'x', klien: 'x' }); cek('Artist membuat order → 403', r.s === 403)
  r = await M1('/papan' + q); cek('Marketer membuka papan produksi → mode PANTAU (tanpa aksi tahap kerja kecuali wakil freelance) — 27 Okt / 9 Nov 2026', r.s === 200 && r.j.data?.pantau === true && r.j.data?.bisaUbah === false && r.j.data?.orders?.every(o => o.wakilFreelance || !o.aksi.some(x => ['Mulai kerjakan', 'Siap QC'].includes(x.label) || x.label.startsWith('Lanjut ke'))))

  console.log('— insight (corong & efisiensi, tanpa uang) —')
  r = await M1(`/marketing/insight${q}`); const ins = r.j.data
  cek('Insight marketer: cakupan "saya", effort 13, chat 1, order ≥2 (orderan dari prospek + yang dibuat langsung)', r.s === 200 && ins.cakupan === 'saya' && ins.effort === 13 && ins.corong.find(c => c.kunci === 'chat').nilai === 1 && ins.corong.find(c => c.kunci === 'order').nilai >= 2, `effort ${ins.effort}, order ${ins.corong.find(c => c.kunci === 'order').nilai}`)
  cek('Laju Effort→Order dihitung (order/effort×100)', ins.lajuEffortKeOrder === Math.round((ins.corong.find(c => c.kunci === 'order').nilai / 13) * 1000) / 10)
  cek('Aktivitas dipecah per tahap: publish 2, engage 10, optimize 1', ins.perTahap.find(t => t.kunci === 'publish').nilai === 2 && ins.perTahap.find(t => t.kunci === 'engage').nilai === 10 && ins.perTahap.find(t => t.kunci === 'optimize').nilai === 1)
  cek('Marketer TIDAK mendapat peringkat tim', !('peringkat' in ins))
  r = await K(`/marketing/insight${q}`); cek('Koordinator: cakupan "tim" + peringkat efisiensi', r.s === 200 && r.j.data.cakupan === 'tim' && Array.isArray(r.j.data.peringkat) && r.j.data.peringkat[0].nama === 'Uji mk_mkt', r.j.data.peringkat?.map(p => p.nama).join())
  cek('Koordinator melihat marketer tanpa aktivitas (marketer 2)', r.j.data.marketerTanpaAktivitas.includes('Uji mk_mkt2'))
  { const m = JSON.stringify(r.j.data).match(/.{40}(nilai(Bersih|Disepakati)|Rp|estimasi).{40}/i); cek("Tidak ada nilai uang di insight", !m, m?.[0]) }
  r = await M1(`/marketing/insight${q}&bulan=13`); cek('Bulan tidak valid → 422', r.s === 422)
} catch (e) { console.error('GALAT:', e); gagal++ } finally {
  await prisma.orderProduksi.deleteMany({ where: { OR: [{ id: { in: orderDibuat } }, { judul: { startsWith: 'UJI ' }, studioId: studio.id }] } })
  await prisma.marketingLead.deleteMany({ where: { studioId: studio.id, marketerId: { in: dibuat } } })
  await prisma.aktivitasMarketer.deleteMany({ where: { studioId: studio.id, userId: { in: dibuat } } })
  for (const id of dibuat) { for (const m of ['targetMarketing', 'penugasanAkunMarketer', 'profilSosialMarketer', 'logHarianMarketer', 'fungsiAnggota']) await prisma[m].deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  await prisma.akunProduksi.deleteMany({ where: { id: { in: akunDibuat } } })
  await prisma.tahapProduksi.deleteMany({ where: { studioId: studio.id } })
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect(); process.exit(gagal ? 1 : 0)
}
