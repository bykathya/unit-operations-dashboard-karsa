import { DASH } from './_jalur.mjs'
import { createRequire } from 'module'
import crypto from 'crypto'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { pilihKandidat, sarankan, urutkanAntrean } = await import(DASH + '/server/src/utils/penugasan.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.36.1.${++xff % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const W = (s) => new Date(s + '+07:00')

console.log('— logika murni (OGS AutoAssign/Reassignment) —')
const nm = new Map([['a', 'Ani'], ['b', 'Budi'], ['c', 'Cici']])
const ahT = [{ userId: 'a', tahapId: 't1', akunId: null, maksKesulitan: 'SULIT' }, { userId: 'b', tahapId: 't1', akunId: null, maksKesulitan: 'SEDANG' }, { userId: 'c', tahapId: 't1', akunId: 'akunX', maksKesulitan: 'SULIT' }]
cek('Kesulitan SEDANG: a & b kompeten → yang beban terendah (b)', pilihKandidat({ kesulitan: 'SEDANG', tahapId: 't1', akunId: 'akunY', keahlianTahap: ahT, beban: new Map([['a', 2], ['b', 1]]), nama: nm }) === 'b')
cek('Kesulitan SULIT: hanya a (b tak cukup, c terikat akun lain)', pilihKandidat({ kesulitan: 'SULIT', tahapId: 't1', akunId: 'akunY', keahlianTahap: ahT, beban: new Map(), nama: nm }) === 'a')
cek('Keahlian terikat akun berlaku untuk akun itu: c kompeten untuk akunX', pilihKandidat({ kesulitan: 'SULIT', tahapId: 't1', akunId: 'akunX', keahlianTahap: ahT, beban: new Map([['a', 5]]), nama: nm }) === 'c')
cek('Tanpa kesulitan → null (dibiarkan belum ditugaskan)', pilihKandidat({ kesulitan: null, tahapId: 't1', keahlianTahap: ahT }) === null)
cek('Beban sama → urut nama (a < b)', pilihKandidat({ kesulitan: 'MUDAH', tahapId: 't1', akunId: 'q', keahlianTahap: ahT.slice(0, 2), beban: new Map(), nama: nm }) === 'a')
cek('Tanpa keahlian tahap → pakai keahlian genre', pilihKandidat({ kesulitan: 'MUDAH', genre: 'Vtuber', tahapId: 'tx', keahlianTahap: [], keahlianGenre: [{ userId: 'c', genre: 'vtuber', maksKesulitan: 'MUDAH' }], nama: nm }) === 'c')
cek('Saran: gabungan kompeten + sebelumnya + ringan, unik, urut abjad, batas 2', JSON.stringify(sarankan({ kompetenIds: ['c'], sebelumnyaId: 'a', beban: new Map([['b', 0], ['a', 3], ['c', 2]]), nama: nm, batas: 2 })) === JSON.stringify(['a', 'b']))
cek('Antrean: override dulu, lalu FIFO, bernomor', JSON.stringify(urutkanAntrean([{ id: 1, ditugaskanPada: '2031-01-02' }, { id: 2, ditugaskanPada: '2031-01-01' }, { id: 3, ditugaskanPada: '2031-01-03', urutanAntrean: 1 }]).map(x => [x.id, x.nomor])) === JSON.stringify([[3, 1], [2, 2], [1, 3]]))

const keiko = await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })
const pibi = await prisma.studio.findFirst({ where: { nama: { contains: 'Pibi' } } })
const hash = await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 4)
const dibuat = [], ordersId = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
const S = keiko.id, C = '/api/circle'
let akunUji
try {
  const koord = await user('pn_koord', [['KOORDINATOR', S]]), koordLain = await user('pn_koord_lain', [['KOORDINATOR', pibi.id]])
  const artA = await user('pn_artA', [['KARYAWAN', S]]), artB = await user('pn_artB', [['KARYAWAN', S]]), luar = await user('pn_luar', [['KARYAWAN', pibi.id]])
  akunUji = (await prisma.akunProduksi.findFirst({ where: { studioId: S } })) ?? await prisma.akunProduksi.create({ data: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  let r = await panggil(`${C}/templat?studioId=${S}`, { token: koord.t }); const tahap = r.j.data.langkah
  const kerja = tahap.find(t => t.jenis === 'KERJA'), selesai = tahap.find(t => t.jenis === 'SELESAI'), masuk = tahap.find(t => t.jenis === 'MASUK')
  const buatOrder = async (judul) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akunUji.id, klien: 'KLIEN-UJI-PN', judul, nilaiKotor: 1, nilaiBersih: 1, tahapId: masuk.id, subStatus: masuk.nama } }); ordersId.push(o.id); return o }
  const pindah = (id, tahapId) => panggil(`${C}/orders/${id}/tahap`, { method: 'PATCH', token: koord.t, body: { tahapId } })

  console.log('— penugasan per tahap mengikuti perpindahan —')
  const o1 = await buatOrder('UJI-PN order 1')
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: artA.t, body: { userId: artA.id } }); cek('Anggota menambah tim → 403', r.s === 403)
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: koordLain.t, body: { userId: artA.id } }); cek('Koordinator circle lain → 403', r.s === 403)
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: koord.t, body: { userId: luar.id } }); cek('Pengguna bukan anggota unit → 422', r.s === 422)
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: koord.t, body: { userId: artA.id } }); cek('Tambah artA ke order (belum di tahap kerja)', r.s === 201)
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: koord.t, body: { userId: artA.id } }); cek('Tambah dua kali → 409', r.s === 409)
  cek('Belum ada baris penugasan tahap (order masih di Inbox)', (await prisma.penugasanTahap.count({ where: { orderId: o1.id } })) === 0)
  r = await pindah(o1.id, kerja.id); cek('Pindah ke tahap kerja', r.s === 200)
  let baris = await prisma.penugasanTahap.findMany({ where: { orderId: o1.id } })
  cek('Baris artA dibuat otomatis: DIKERJAKAN di tahap kerja', baris.length === 1 && baris[0].userId === artA.id && baris[0].status === 'DIKERJAKAN' && baris[0].tahapId === kerja.id && !!baris[0].mulaiPada, JSON.stringify(baris.map(b => [b.status, b.namaTahap])))
  r = await panggil(`${C}/orders/${o1.id}/tim`, { method: 'POST', token: koord.t, body: { userId: artB.id } }); cek('Tambah artB saat order di tahap kerja → baris langsung dibuat', r.s === 201 && (await prisma.penugasanTahap.count({ where: { orderId: o1.id, userId: artB.id, status: 'DIKERJAKAN' } })) === 1)

  console.log('— antrean & progres —')
  r = await panggil(`${C}/antrean?studioId=${S}`, { token: artA.t }); cek('Anggota membuka antrean tim → 403', r.s === 403)
  r = await panggil(`${C}/antrean?studioId=${S}`, { token: koord.t }); const orangA = r.j.data.orang.find(o => o.userId === artA.id)
  cek('Antrean tim: artA & artB masing-masing 1 tugas bernomor 1', r.s === 200 && orangA?.antrean.length === 1 && orangA.antrean[0].nomor === 1 && r.j.data.orang.find(o => o.userId === artB.id)?.antrean.length === 1)
  const o2 = await buatOrder('UJI-PN order 2'); await panggil(`${C}/orders/${o2.id}/tim`, { method: 'POST', token: koord.t, body: { userId: artA.id } }); await pindah(o2.id, kerja.id)
  r = await panggil(`${C}/antrean-saya?studioId=${S}`, { token: artA.t }); const saya = r.j.data
  cek('Antrean saya (artA): 2 tugas FIFO bernomor 1,2; tanpa data orang lain', r.s === 200 && saya.length === 2 && saya[0].judul === 'UJI-PN order 1' && saya[1].nomor === 2)
  r = await panggil(`${C}/antrean/urutan`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artA.id, ids: [saya[1].id, saya[0].id] } }); cek('Koordinator mengubah urutan antrean artA', r.s === 200)
  r = await panggil(`${C}/antrean-saya?studioId=${S}`, { token: artA.t }); cek('Urutan baru berlaku: order 2 jadi nomor 1', r.j.data[0].judul === 'UJI-PN order 2' && r.j.data[0].nomor === 1)
  r = await panggil(`${C}/antrean/urutan`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artB.id, ids: [saya[0].id] } }); cek('Urutan dengan penugasan milik orang lain → 422', r.s === 422)
  r = await panggil(`${C}/penugasan/${saya[0].id}`, { method: 'PATCH', token: artB.t, body: { progres: 10 } }); cek('artB mengubah penugasan artA → 403', r.s === 403)
  r = await panggil(`${C}/penugasan/${saya[0].id}`, { method: 'PATCH', token: artA.t, body: { progres: 101 } }); cek('Progres 101 → 422', r.s === 422)
  r = await panggil(`${C}/penugasan/${saya[0].id}`, { method: 'PATCH', token: artA.t, body: { progres: 40, catatanKerja: 'sketsa jadi' } }); cek('artA mengubah progres 40 + catatan', r.s === 200)
  r = await panggil(`${C}/penugasan/${saya[0].id}`, { method: 'PATCH', token: artA.t, body: { dijadwalkan: '2031-01-05' } }); cek('Anggota mengatur jadwal → 403 (hanya koordinator)', r.s === 403)
  r = await panggil(`${C}/penugasan/${saya[0].id}`, { method: 'PATCH', token: koord.t, body: { dijadwalkan: '2031-01-05' } }); cek('Koordinator mengatur jadwal', r.s === 200)

  console.log('— penutupan baris saat meninggalkan tahap —')
  r = await pindah(o2.id, selesai.id); baris = await prisma.penugasanTahap.findMany({ where: { orderId: o2.id } })
  cek('Order SELESAI → baris ditutup (SELESAI, progres 100)', baris.every(b => b.status === 'SELESAI' && b.progres === 100 && !!b.selesaiPada))
  r = await panggil(`${C}/penugasan/${baris[0].id}`, { method: 'PATCH', token: koord.t, body: { progres: 5 } }); cek('Penugasan selesai tidak bisa diubah → 409', r.s === 409)
  r = await panggil(`${C}/orders/${o1.id}/tim/${(await prisma.assignmentProduksi.findFirst({ where: { orderId: o1.id, userId: artB.id } })).id}`, { method: 'DELETE', token: koord.t }); cek('Hapus artB dari tim → barisnya ditutup', r.s === 200 && (await prisma.penugasanTahap.count({ where: { orderId: o1.id, userId: artB.id, status: 'DIKERJAKAN' } })) === 0)

  console.log('— analitik memakai atribusi per tahap —')
  await prisma.penugasanTahap.updateMany({ where: { orderId: o1.id, userId: artA.id }, data: { status: 'SELESAI', progres: 100, mulaiPada: W('2026-10-12T09:00'), selesaiPada: W('2026-10-12T17:00') } })
  await prisma.penugasanTahap.updateMany({ where: { orderId: o1.id, userId: artB.id }, data: { status: 'SELESAI', progres: 100, mulaiPada: W('2026-10-12T09:00'), selesaiPada: W('2026-10-12T11:00') } })
  const P = `studioId=${S}&dari=${encodeURIComponent('2026-10-12T00:00:00+07:00')}&sampai=${encodeURIComponent('2026-10-12T23:59:59+07:00')}`
  r = await panggil(`${C}/analitik/kinerja?${P}`, { token: koord.t }); const ka = r.j.data.orang.find(o => o.userId === artA.id), kb = r.j.data.orang.find(o => o.userId === artB.id)
  cek('Kinerja per orang BERBEDA: artA median 7 jam, artB 2 jam (atribusi per tahap)', ka?.medianProduksi === 7 && kb?.medianProduksi === 2, JSON.stringify([ka?.medianProduksi, kb?.medianProduksi]))

  console.log('— profil order, keahlian, penugasan otomatis —')
  const o3 = await buatOrder('UJI-PN order 3')
  r = await panggil(`${C}/orders/${o3.id}/profil`, { method: 'PATCH', token: koord.t, body: { kesulitan: 'LUAR BIASA' } }); cek('Kesulitan tidak dikenal → 422', r.s === 422)
  r = await panggil(`${C}/orders/${o3.id}/profil`, { method: 'PATCH', token: koord.t, body: { kesulitan: 'SEDANG', genre: 'Vtuber' } }); cek('Simpan kesulitan SEDANG + genre', r.s === 200)
  r = await panggil(`${C}/keahlian?studioId=${S}`, { token: artA.t }); cek('Anggota membuka keahlian → 403', r.s === 403)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artA.id, tahapId: masuk.id, maksKesulitan: 'SULIT' } }); cek('Keahlian pada tahap non-kerja → 422', r.s === 422)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: luar.id, tahapId: kerja.id, maksKesulitan: 'SULIT' } }); cek('Keahlian untuk non-anggota → 422', r.s === 422)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artA.id, tahapId: kerja.id, genre: 'x', maksKesulitan: 'SULIT' } }); cek('Isi tahap DAN genre sekaligus → 422', r.s === 422)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artA.id, tahapId: kerja.id, maksKesulitan: 'SULIT' } }); cek('Keahlian artA: tahap kerja SULIT', r.s === 200)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artB.id, tahapId: kerja.id, maksKesulitan: 'SEDANG' } }); cek('Keahlian artB: tahap kerja SEDANG', r.s === 200)
  r = await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artB.id, tahapId: kerja.id, maksKesulitan: 'SULIT' } }); r = await panggil(`${C}/keahlian?studioId=${S}`, { token: koord.t }); cek('Simpan ulang memperbarui (bukan menggandakan)', r.j.data.keahlianTahap.filter(k => k.userId === artB.id && k.tahapId === kerja.id).length === 1 && r.j.data.keahlianTahap.find(k => k.userId === artB.id).maksKesulitan === 'SULIT')
  await panggil(`${C}/keahlian`, { method: 'PUT', token: koord.t, body: { studioId: S, userId: artB.id, tahapId: kerja.id, maksKesulitan: 'SEDANG' } })
  r = await panggil(`${C}/orders/${o3.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Tugaskan otomatis saat order belum di tahap kerja → 409', r.s === 409)
  await pindah(o3.id, kerja.id)
  const o3b = await buatOrder('UJI-PN order 3b (membebani artA)'); await panggil(`${C}/orders/${o3b.id}/tim`, { method: 'POST', token: koord.t, body: { userId: artA.id } }); await pindah(o3b.id, kerja.id)
  r = await panggil(`${C}/orders/${o3.id}/saran?batas=2`, { token: koord.t }); cek('Saran penugasan: ≤ 2 nama (kompeten/ringan), urut abjad', r.s === 200 && r.j.data.length === 2 && r.j.data[0].nama.localeCompare(r.j.data[1].nama, 'id') <= 0, JSON.stringify(r.j.data.map(x => x.nama)))
  r = await panggil(`${C}/orders/${o3.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Penugasan otomatis memilih yang beban aktifnya terendah (artB: 0 vs artA: 1)', r.s === 200 && r.j.data.userId === artB.id, JSON.stringify(r.j.data))
  cek('Baris otomatis dicatat (otomatis=true) & DIKERJAKAN', (await prisma.penugasanTahap.count({ where: { orderId: o3.id, userId: artB.id, otomatis: true, status: 'DIKERJAKAN' } })) === 1)
  r = await panggil(`${C}/orders/${o3.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Panggilan kedua: beban imbang (1 vs 1) → urut nama → artA ikut ditugaskan', r.s === 200 && r.j.data.userId === artA.id)
  r = await panggil(`${C}/orders/${o3.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Panggilan ketiga: kandidat terbaik (artB) sudah ada di order → 409', r.s === 409)
  const o4 = await buatOrder('UJI-PN order 4'); await panggil(`${C}/orders/${o4.id}/profil`, { method: 'PATCH', token: koord.t, body: { kesulitan: 'SULIT' } }); await pindah(o4.id, kerja.id)
  r = await panggil(`${C}/orders/${o4.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Kesulitan SULIT: hanya artA yang kompeten → artA', r.s === 200 && r.j.data.userId === artA.id)
  const o5 = await buatOrder('UJI-PN order 5'); await pindah(o5.id, kerja.id)
  r = await panggil(`${C}/orders/${o5.id}/tugaskan-otomatis`, { method: 'POST', token: koord.t }); cek('Tanpa kesulitan diisi → 422', r.s === 422)

  console.log('— pengaturan otomatis per unit —')
  r = await panggil(`${C}/pengaturan-penugasan`, { method: 'PUT', token: artA.t, body: { studioId: S, otomatis: true } }); cek('Anggota mengubah pengaturan → 403', r.s === 403)
  const o6 = await buatOrder('UJI-PN order 6'); await panggil(`${C}/orders/${o6.id}/profil`, { method: 'PATCH', token: koord.t, body: { kesulitan: 'SEDANG' } })
  await pindah(o6.id, kerja.id); cek('Pengaturan MATI: pindah ke tahap kerja tidak menugaskan siapa pun', (await prisma.assignmentProduksi.count({ where: { orderId: o6.id } })) === 0)
  r = await panggil(`${C}/pengaturan-penugasan`, { method: 'PUT', token: koord.t, body: { studioId: S, otomatis: true } }); cek('Koordinator menyalakan penugasan otomatis', r.s === 200)
  const o7 = await buatOrder('UJI-PN order 7'); await panggil(`${C}/orders/${o7.id}/profil`, { method: 'PATCH', token: koord.t, body: { kesulitan: 'SEDANG' } })
  await pindah(o7.id, kerja.id); const t7 = await prisma.assignmentProduksi.findMany({ where: { orderId: o7.id } })
  cek('Pengaturan NYALA: order ditugaskan otomatis saat masuk tahap kerja + baris dibuat', t7.length === 1 && (await prisma.penugasanTahap.count({ where: { orderId: o7.id, otomatis: true } })) === 1)
  const o8 = await buatOrder('UJI-PN order 8'); await pindah(o8.id, kerja.id)
  cek('Pengaturan NYALA tapi tanpa kesulitan → dibiarkan belum ditugaskan', (await prisma.assignmentProduksi.count({ where: { orderId: o8.id } })) === 0)

  console.log('— hapus keahlian —')
  r = await panggil(`${C}/keahlian?studioId=${S}`, { token: koord.t }); const ids = r.j.data.keahlianTahap.map(k => k.id)
  r = await panggil(`${C}/keahlian/${ids[0]}`, { method: 'DELETE', token: koordLain.t }); cek('Koordinator circle lain menghapus keahlian → 403', r.s === 403)
  r = await panggil(`${C}/keahlian/${ids[0]}`, { method: 'DELETE', token: koord.t }); cek('Hapus keahlian', r.s === 200)
} catch (e) { console.error('GALAT', e); gagal++ } finally {
  await prisma.pengaturanPenugasan.deleteMany({ where: { studioId: keiko.id } })
  await prisma.keahlianTahap.deleteMany({ where: { studioId: keiko.id, userId: { in: dibuat } } })
  await prisma.keahlianGenre.deleteMany({ where: { studioId: keiko.id, userId: { in: dibuat } } })
  await prisma.orderProduksi.deleteMany({ where: { klien: 'KLIEN-UJI-PN' } })
  for (const id of dibuat) { await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
}
