import { DASH } from './_jalur.mjs'
// Uji FOLLOW UP KLIEN LAMA (24 Nov 2026, masukan tim): aktivitas marketer "Follow up klien lama" wajib menunjuk klien dari direktori unit;
// menu Klien menampilkan "Terakhir di-follow-up" (hanya yang selesai), ikut dihitung di Ringkasan marketing (Jejaring) & rincian aktivitas;
// gabung klien memindahkan follow up; pemilik lihat-saja & talent ditolak. Keiko lokal; data uji dihapus.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, token, method = 'GET', body) => { const r = await fetch('http://localhost:3001/api/circle' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.49.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', Authorization: `Bearer ${token}` }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id
const lain = (await prisma.studio.findFirst({ where: { nama: { startsWith: 'Pibi' } } })).id
const T = Date.now(), dibuat = [], klienIds = []
const user = async (kode, role, studioId = S, fungsi) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: 'x', statusAktif: true } }); dibuat.push(u.id); if (role) await prisma.userRole.create({ data: { userId: u.id, roleType: role, studioId } }); if (fungsi) await prisma.fungsiAnggota.create({ data: { userId: u.id, studioId, fungsi, terkonfirmasi: true } }); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const hari = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
try {
  const koord = await user('fk_koord', 'KOORDINATOR'), mkt = await user('fk_mkt', 'KARYAWAN', S, 'MARKETER'), tal = await user('fk_tal', 'KARYAWAN'), pem = await user('fk_pem', null)
  await prisma.studioPemilik.create({ data: { studioId: S, userId: pem.id, persenSaham: 1 } })
  const kA = await prisma.klienProduksi.create({ data: { studioId: S, nama: `UJI-FK Andi ${T}`, panggilan: 'Andi', asal: 'WhatsApp' } }), kB = await prisma.klienProduksi.create({ data: { studioId: S, nama: `UJI-FK Andi typo ${T}` } }), kL = await prisma.klienProduksi.create({ data: { studioId: lain, nama: `UJI-FK lain ${T}` } })
  klienIds.push(kA.id, kB.id, kL.id)
  const fu = (klienId, x = {}) => ({ studioId: S, tanggal: hari, items: [{ jenis: 'network_followup_klien', klienId, platform: 'WhatsApp', hasil: 'tertarik, minta pricelist', jumlah: 1, selesai: true, ...x }] })
  let r = await panggil(`/marketing/ruang?studioId=${S}`, mkt.t)
  cek('Katalog memuat "Follow up klien lama" (Jejaring, wajib klien)', r.j.data?.katalog.some(k => k.kunci === 'network_followup_klien' && k.tahap === 'network' && k.butuhKlien))
  r = await panggil('/marketing/aktivitas', mkt.t, 'POST', { ...fu(null), items: [{ jenis: 'network_followup_klien', platform: 'WhatsApp', jumlah: 1 }] }); cek('Tanpa klien → 422 (klien wajib)', r.s === 422 && JSON.stringify(r.j.galat ?? '').includes('klienId'), `${r.s}`)
  r = await panggil('/marketing/aktivitas', mkt.t, 'POST', fu(kL.id)); cek('Klien unit lain → 422', r.s === 422)
  r = await panggil('/marketing/aktivitas', mkt.t, 'POST', fu(kA.id)); cek('Marketer mencatat follow up (selesai) → 201', r.s === 201, `${r.s} ${r.j.message ?? ''}`)
  const a1 = await prisma.aktivitasMarketer.findFirst({ where: { klienId: kA.id } })
  cek('Tersimpan tertaut klien, selesai, tanpa akun', a1?.selesai === true && !a1.akunId && a1.platform === 'WhatsApp' && a1.hasil?.startsWith('tertarik'))
  r = await panggil('/marketing/aktivitas', koord.t, 'POST', fu(kB.id, { selesai: undefined })); cek('Follow up yang belum selesai (rencana) tersimpan', r.s === 201)
  r = await panggil('/marketing/aktivitas', pem.t, 'POST', fu(kA.id)); cek('Pemilik unit (lihat saja) → 403', r.s === 403, String(r.s))
  r = await panggil('/marketing/aktivitas', tal.t, 'POST', fu(kA.id)); cek('Talent → 403', r.s === 403)
  r = await panggil(`/klien?studioId=${S}`, koord.t)
  const ka = r.j.data?.klien.find(k => k.id === kA.id), kb = r.j.data?.klien.find(k => k.id === kB.id)
  cek('Menu Klien: Terakhir di-follow-up (tanggal, oleh, lewat, hasil)', ka?.followUp?.tanggal === hari && ka.followUp.oleh === 'Uji fk_mkt' && ka.followUp.lewat === 'WhatsApp' && ka.jumlahFollowUp === 1, JSON.stringify(ka?.followUp))
  cek('Follow up yang belum selesai tidak dihitung', kb?.followUp === null)
  cek('Daftar platform follow up dikirim', r.j.data?.platformFollowUp?.includes('WhatsApp'))
  r = await panggil(`/klien?studioId=${S}`, mkt.t); cek('Marketer melihat kolom follow up', r.j.data?.klien.find(k => k.id === kA.id)?.followUp?.tanggal === hari)
  r = await panggil(`/marketing/aktivitas-rincian?studioId=${S}&userId=${mkt.id}&bulan=${Number(hari.slice(5, 7))}&tahun=${hari.slice(0, 4)}`, koord.t)
  cek('Rincian aktivitas: tampil sebagai "Klien: …"', r.j.data?.baris.some(b => b.jenis === 'network_followup_klien' && b.judul?.startsWith('Klien: UJI-FK Andi')))
  r = await panggil(`/marketing/dashboard?studioId=${S}&bulan=${Number(hari.slice(5, 7))}&tahun=${hari.slice(0, 4)}`, koord.t)
  cek('Ringkasan marketing: dihitung di Jejaring', (r.j.data?.perMarketer?.find(x => x.userId === mkt.id)?.network ?? 0) >= 1)
  // gabung kB → kA memindahkan follow up
  await prisma.aktivitasMarketer.updateMany({ where: { klienId: kB.id }, data: { selesai: true } })
  r = await panggil(`/klien/${kB.id}/gabung`, koord.t, 'POST', { keId: kA.id }); cek('Gabung klien → 200', r.s === 200, `${r.s} ${r.j.message ?? ''}`)
  cek('Follow up ikut pindah ke klien tujuan', (await prisma.aktivitasMarketer.count({ where: { klienId: kA.id } })) === 2)
  r = await panggil(`/klien?studioId=${S}`, koord.t); cek('Jumlah follow up klien tujuan = 2', r.j.data?.klien.find(k => k.id === kA.id)?.jumlahFollowUp === 2)
  // Jadikan prospek (alur tombol di menu Klien)
  r = await panggil('/marketing/lead', mkt.t, 'POST', { studioId: S, klien: kA.nama, platform: 'WhatsApp', catatan: 'Dari follow up klien lama' }); cek('Jadikan prospek dari klien → 201', r.s === 201)
  const lead = await prisma.marketingLead.findFirst({ where: { studioId: S, klien: kA.nama } }); cek('Prospek masuk Discussing', lead?.status === 'DISCUSSING'); if (lead) await prisma.marketingLead.delete({ where: { id: lead.id } })
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message); gagal++
} finally {
  await prisma.aktivitasMarketer.deleteMany({ where: { OR: [{ userId: { in: dibuat } }, { klienId: { in: klienIds } }] } })
  await prisma.marketingLead.deleteMany({ where: { klien: { startsWith: 'UJI-FK' } } })
  await prisma.klienProduksi.deleteMany({ where: { id: { in: klienIds } } })
  await prisma.studioPemilik.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } })
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
