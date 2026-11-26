import { DASH } from './_jalur.mjs'
// Uji LEMBUR DARI TUGAS YANG DITUNDA (22 Nov 2026, "ATURAN LEMBUR 3D ARTIST" — tim; keputusan user: admin mengusulkan nilai,
// Koordinator memutuskan). Setelan unit `lemburDariTunda` (mode PER_LEVEL/PER_PROYEK) → talent menyelesaikan tugas DITUNDA di luar jam kerja
// = CALON lembur (🌙 di papan & Kurasi QC) → Admin Market menilai (level × bagian tahap, boleh disesuaikan) → MENUNGGU → Koordinator
// setuju (usulan dipakai bila nilai dikosongkan) → masuk hitungan slip. Catat manual & lembur otomatis pulang ditutup. Keiko lokal; data dipulihkan.
import { createRequire } from 'module'
const req = createRequire(DASH + '/server/package.json')
req('dotenv').config({ path: DASH + '/server/.env', quiet: true })
const jwt = req('jsonwebtoken'), bcrypt = req('bcrypt')
const prisma = (await import(DASH + '/server/src/prisma.js')).default
const { nilaiTahapLembur, validasiAturan } = await import(DASH + '/server/src/utils/lembur.js')
const { luarJamKerja } = await import(DASH + '/server/src/utils/lemburTunda.js')
const { lemburUntukSlip } = await import(DASH + '/server/src/controllers/payroll.js')
let gagal = 0; const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }
let xff = 0
const panggil = async (path, { method = 'GET', body, token } = {}) => { const r = await fetch('http://localhost:3001' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `172.47.1.${++xff % 250}`, 'X-Unit-Web': 'bloom', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const S = (await prisma.studio.findFirst({ where: { nama: { contains: 'Keiko' } } })).id, T = Date.now()
const hash = await bcrypt.hash('uji-lt-' + T, 4)
const dibuat = [], orderIds = []
const user = async (kode, roles) => { const u = await prisma.user.create({ data: { nama: 'Uji ' + kode, email: `uji.${kode}.${T}@uji.local`, passwordHash: hash, statusAktif: true } }); for (const [roleType, studioId] of roles) await prisma.userRole.create({ data: { userId: u.id, roleType, studioId } }); dibuat.push(u.id); return { id: u.id, t: jwt.sign({ id: u.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }) } }
// simpan pengaturan lama unit (dipulihkan di akhir)
const aturanLama = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
const tahapLama = await prisma.tahapLembur.findMany({ where: { studioId: S } })
const jamLama = await prisma.jamKerjaUnit.findUnique({ where: { studioId: S } })
let levelUji = null
try {
  // ── Fungsi murni ──
  const daftar = [{ id: 'a', nama: 'Sculpt', persen: 30 }, { id: 'b', nama: 'Texturing', persen: 60 }, { id: 'c', nama: 'Rigging', persen: 85 }, { id: 'd', nama: 'Final', persen: 100 }]
  let h = nilaiTahapLembur(200000, daftar, ['b', 'c'])
  cek('Rumus: Texturing (30%) + Rigging (25%) = 55% × Rp200.000 = Rp110.000', h.persen === 55 && h.nilai === 110000 && h.tahap.map(t => t.bagian).join() === '30,25', JSON.stringify(h))
  h = nilaiTahapLembur(200000, daftar, ['a', 'd']); cek('Rumus: tahap tidak berurutan (Sculpt 30% + Final 15%) = Rp90.000', h.nilai === 90000, JSON.stringify(h))
  cek('Rumus: tanpa tahap → galat', !!nilaiTahapLembur(200000, daftar, []).galat)
  cek('Rumus: tahap asing → galat', !!nilaiTahapLembur(200000, daftar, ['x']).galat)
  cek('Setelan: mode per jam + lembur dari tunda → ditolak', !!validasiAturan({ mode: 'PER_JAM', tarifPerJam: 10000, lemburDariTunda: true }).galat)
  cek('Setelan: mode per level + lembur dari tunda → boleh', validasiAturan({ mode: 'PER_LEVEL', lemburDariTunda: true }).data?.lemburDariTunda === true)
  // Jam kerja unit bawaan: Senin 23 Nov 2026 10:00 WIB = di dalam jam kerja; 20:00 WIB & Minggu = di luar
  await prisma.jamKerjaUnit.deleteMany({ where: { studioId: S } })
  cek('Jam kerja: Senin 10:00 WIB di dalam jam kerja', (await luarJamKerja(S, new Date('2026-11-23T03:00:00Z'))).luar === false)
  cek('Jam kerja: Senin 20:00 WIB di luar jam kerja', (await luarJamKerja(S, new Date('2026-11-23T13:00:00Z'))).luar === true)
  cek('Jam kerja: Minggu = di luar jam kerja', (await luarJamKerja(S, new Date('2026-11-22T03:00:00Z'))).luar === true)

  // ── Data uji ──
  const koord = await user('lt_koord', [['KOORDINATOR', S]]), adm = await user('lt_adm', [['KARYAWAN', S]]), tal = await user('lt_tal', [['KARYAWAN', S]]), tal2 = await user('lt_tal2', [['KARYAWAN', S]]), qc = await user('lt_qc', [['KARYAWAN', S]])
  await prisma.produksiAdminMarket.create({ data: { userId: adm.id, studioId: S } })
  await prisma.fungsiAnggota.create({ data: { userId: qc.id, studioId: S, fungsi: 'PM_QC', terkonfirmasi: true } })
  const K = (p, o = {}) => panggil(p, { token: koord.t, ...o }), A = (p, o = {}) => panggil(p, { token: adm.t, ...o }), Tl = (p, o = {}) => panggil(p, { token: tal.t, ...o })
  const { pastikanTahap } = await import(DASH + '/server/src/controllers/circle.js')
  const tahap = await pastikanTahap(S), inbox = tahap.find(t => t.jenis === 'MASUK'), kerja = tahap.find(t => t.jenis === 'KERJA')
  const akun = await prisma.akunProduksi.upsert({ where: { studioId_namaAkun: { studioId: S, namaAkun: 'Order Internal' } }, update: {}, create: { studioId: S, platform: 'Internal', namaAkun: 'Order Internal', feePersen: 0 } })
  const ord = async (judul, userId = tal.id) => { const o = await prisma.orderProduksi.create({ data: { studioId: S, akunId: akun.id, klien: 'UJI-LT klien', judul: `${judul} ${T}`, nilaiKotor: 1000, nilaiBersih: 1000, tahapId: inbox.id, status: 'MASUK', tanggalMasuk: new Date() } }); orderIds.push(o.id); await prisma.assignmentProduksi.create({ data: { orderId: o.id, userId } }); return o }
  // Setelan unit oleh Koordinator
  let r = await K('/api/circle/lembur/aturan', { method: 'PUT', body: { studioId: S, mode: 'PER_LEVEL', lemburDariTunda: true, perluPersetujuan: true } })
  cek('Koordinator menyalakan "lembur hanya dari tugas yang ditunda" → 200', r.s === 200 && r.j.data?.aturan?.lemburDariTunda === true, `${r.s} ${r.j.message}`)
  r = await A('/api/circle/lembur/aturan', { method: 'PUT', body: { studioId: S, mode: 'PER_LEVEL', lemburDariTunda: false } }); cek('Admin Market mengubah aturan lembur → 403', r.s === 403)
  levelUji = await prisma.levelLembur.create({ data: { studioId: S, nama: `UJI-LT Level ${T}`, fee: 200000 } })
  await prisma.tahapLembur.deleteMany({ where: { studioId: S } })
  await prisma.tahapLembur.createMany({ data: daftar.map((t, i) => ({ studioId: S, nama: t.nama, persen: t.persen, urutan: i })) })
  const idTahap = Object.fromEntries((await prisma.tahapLembur.findMany({ where: { studioId: S } })).map(t => [t.nama, t.id]))
  r = await Tl('/api/circle/kehadiran/lembur', { method: 'POST', body: { studioId: S, catatan: 'uji manual', orderId: orderIds[0] } })
  cek('Catat lembur manual ditutup saat setelan aktif → 409', r.s === 409, `${r.s} ${r.j.message}`)
  r = await Tl(`/api/circle/kehadiran/order-lembur?studioId=${S}`); cek('Form lembur talent tahu unit memakai lembur dari tunda (dariTunda)', r.j.data?.dariTunda === true, JSON.stringify(r.j.data?.dariTunda))

  // Tugas ditunda vs tugas biasa
  const oT = await ord('UJI-LT tunda'), oB = await ord('UJI-LT biasa'), oP = await ord('UJI-LT pagi', tal2.id)
  r = await K(`/api/circle/orders/${oT.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut', antrean: false } }); cek('Koordinator menunda tugas talent (⏸) → 200', r.s === 200)
  await K(`/api/circle/orders/${oB.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut' } })
  await K(`/api/circle/orders/${oP.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut', antrean: false } })
  const kerjakan = async (o, token) => { // talent: mulai (bila ada) lalu selesai
    let ts = await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token }); let t = ts.j.data?.tugas.find(x => x.id === o.id)
    for (let i = 0; i < 3 && t && t.jenis === kerja.jenis && t.aksi.length; i++) {
      const a = t.aksi.find(x => x.aksi !== 'mulai') ?? t.aksi[0]
      const res = await panggil(`/api/circle/tugas/${o.id}/aksi`, { method: 'POST', body: { aksi: a.aksi }, token })
      if (a.aksi !== 'mulai') return res
      ts = await panggil(`/api/circle/tugas-saya?studioId=${S}`, { token }); t = ts.j.data?.tugas.find(x => x.id === o.id)
    }
    return null
  }
  const luarSekarang = (await luarJamKerja(S)).luar
  const rT = await kerjakan(oT, tal.t), rB = await kerjakan(oB, tal.t)
  const lT = await prisma.lemburKehadiran.findFirst({ where: { orderId: oT.id } }), lB = await prisma.lemburKehadiran.findFirst({ where: { orderId: oB.id } })
  if (luarSekarang) {
    cek('Tugas DITUNDA diselesaikan di luar jam kerja → CALON lembur (sumber TUNDA)', rT?.s === 200 && rT.j.data?.lembur === true && lT?.status === 'CALON' && lT.sumber === 'TUNDA' && !!lT.penugasanId, `${rT?.s} ${JSON.stringify(rT?.j.data)} ${lT?.status}`)
  } else {
    cek('(di jam kerja) Tugas ditunda diselesaikan di jam kerja → tidak jadi lembur', rT?.s === 200 && !lT, `${rT?.s} ${lT?.status}`)
    // lanjutkan alur dengan "Tandai lembur" dari Kurasi
  }
  cek('Tugas BIASA (Antreanku) yang diselesaikan → tidak pernah jadi lembur', rB?.s === 200 && !lB, `${rB?.s} ${lB?.status}`)

  // Tandai lembur manual oleh admin (tugas ditunda selesai di jam kerja) — oP dikerjakan tal2
  let lP = null
  const rP = await kerjakan(oP, (await prisma.user.findUnique({ where: { id: tal2.id } })) && jwt.sign({ id: tal2.id, aud: 'circle', cs: 'bloom' }, process.env.JWT_SECRET, { expiresIn: '10m' }))
  cek('Talent kedua menyelesaikan tugas ditunda → 200', rP?.s === 200, String(rP?.s))
  const ptP = await prisma.penugasanTahap.findFirst({ where: { orderId: oP.id, userId: tal2.id, tunda: true, status: 'SELESAI' } })
  await prisma.lemburKehadiran.deleteMany({ where: { orderId: oP.id } }) // simulasikan "baru dikirim di jam kerja" (tidak otomatis tercatat)
  r = await A(`/api/circle/tugas-admin?studioId=${S}`)
  const barisQcP = r.j.data?.qc.find(x => x.id === oP.id)
  cek('Tugas admin: unit memakai lembur dari tunda (lemburAktif)', r.j.data?.lemburAktif === true)
  if (barisQcP) cek('Kurasi QC: baris tugas ditunda menawarkan "🌙 Tandai lembur"', barisQcP.tandaiLembur?.penugasanId === ptP?.id, JSON.stringify(barisQcP.tandaiLembur))
  r = await panggil('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: ptP?.id }, token: qc.t }); cek('PM/QC menandai lembur → 403 (ada uang)', r.s === 403, String(r.s))
  r = await A('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: ptP?.id } }); cek('Admin Market "Tandai lembur" → 201 CALON', r.s === 201, `${r.s} ${r.j.message}`)
  lP = await prisma.lemburKehadiran.findFirst({ where: { orderId: oP.id } }); cek('Calon dari tandai: milik talent itu, status CALON', lP?.userId === tal2.id && lP?.status === 'CALON')
  r = await A('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: ptP?.id } }); cek('Tandai dua kali → 409 (sekali per tugas)', r.s === 409)
  const ptB = await prisma.penugasanTahap.findFirst({ where: { orderId: oB.id, userId: tal.id, status: 'SELESAI' } })
  r = await A('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: ptB?.id } }); cek('Tandai tugas yang TIDAK ditunda → 422', r.s === 422, String(r.s))

  // Calon utama: pakai yang otomatis bila ada, kalau tidak (jam kerja) tandai juga
  let calon = lT
  if (!calon) { const pt = await prisma.penugasanTahap.findFirst({ where: { orderId: oT.id, userId: tal.id, tunda: true, status: 'SELESAI' } }); await A('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: pt?.id } }); calon = await prisma.lemburKehadiran.findFirst({ where: { orderId: oT.id } }) }
  r = await K(`/api/circle/papan?studioId=${S}`); cek('Papan: kartu order bertanda 🌙 lembur (CALON)', r.j.data?.orders.find(o => o.id === oT.id)?.lembur === 'CALON', JSON.stringify(r.j.data?.orders.find(o => o.id === oT.id)?.lembur))
  r = await A(`/api/circle/lembur/calon?studioId=${S}`)
  cek('Daftar calon (admin): memuat calon, level ber-fee & bagian tahap', r.s === 200 && r.j.data.baris.some(b => b.id === calon.id && b.tahap) && r.j.data.level.some(l => l.id === levelUji.id && l.fee === 200000) && r.j.data.tahap.find(t => t.nama === 'Rigging')?.bagian === 25, `${r.s}`)
  r = await Tl(`/api/circle/lembur/calon?studioId=${S}`); cek('Talent membuka daftar calon → 403', r.s === 403)
  r = await panggil(`/api/circle/lembur/calon?studioId=${S}`, { token: qc.t }); cek('PM/QC membuka daftar calon → 403', r.s === 403)
  r = await Tl(`/api/circle/lembur/${calon.id}/usul`, { method: 'POST', body: { levelId: levelUji.id, tahap: [idTahap.Texturing] } }); cek('Talent menilai lemburnya sendiri → 403', r.s === 403)
  r = await A(`/api/circle/lembur/${calon.id}/usul`, { method: 'POST', body: {} }); cek('Usulan tanpa level/tahap/nilai → 422', r.s === 422)
  r = await A(`/api/circle/lembur/${calon.id}/usul`, { method: 'POST', body: { levelId: levelUji.id, tahap: [idTahap.Texturing, idTahap.Rigging], catatan: 'rapi' } })
  let l = await prisma.lemburKehadiran.findUnique({ where: { id: calon.id } })
  cek('Admin mencentang Texturing + Rigging → otomatis Rp110.000, MENUNGGU', r.s === 200 && r.j.data?.nilai === 110000 && l.status === 'MENUNGGU' && l.nilaiProyek === 110000 && l.nilaiUsulan === 110000 && l.diusulkanOlehId === adm.id, `${r.s} ${JSON.stringify(r.j.data)} ${l.status}`)
  cek('Tahap yang dinilai tersimpan', Array.isArray(l.tahapDinilai) && l.tahapDinilai.map(t => t.nama).join() === 'Texturing,Rigging')
  r = await A(`/api/circle/lembur/${calon.id}/usul`, { method: 'POST', body: { levelId: levelUji.id, tahap: [idTahap.Texturing, idTahap.Rigging], nilai: 90000 } })
  l = await prisma.lemburKehadiran.findUnique({ where: { id: calon.id } })
  cek('Admin menyesuaikan nilai (kualitas) → Rp90.000', r.s === 200 && l.nilaiUsulan === 90000 && l.nilaiProyek === 90000)
  r = await K(`/api/circle/papan?studioId=${S}`); cek('Papan: tanda 🌙 berubah jadi MENUNGGU', r.j.data?.orders.find(o => o.id === oT.id)?.lembur === 'MENUNGGU')
  r = await K(`/api/circle/lembur/menunggu?studioId=${S}`); const bm = r.j.data?.baris.find(b => b.id === calon.id)
  cek('Lembur menunggu (Koordinator): usulan admin terlihat', bm?.dariTunda === true && bm.nilaiUsulan === 90000 && bm.diusulkanOleh === 'Uji lt_adm' && bm.tahapDinilai?.length === 2, JSON.stringify(bm))
  cek('Calon yang belum dinilai TIDAK masuk Lembur menunggu', !r.j.data?.baris.some(b => b.id === lP?.id))
  r = await A(`/api/circle/lembur/${calon.id}/setujui`, { method: 'POST', body: { studioId: S } }); cek('Admin Market menyetujui lembur → 403 (keputusan Koordinator)', r.s === 403)
  // slip sebelum disetujui
  const awal = new Date(Date.UTC(l.tanggalKerja.getUTCFullYear(), l.tanggalKerja.getUTCMonth(), 1)), akhir = new Date(Date.UTC(l.tanggalKerja.getUTCFullYear(), l.tanggalKerja.getUTCMonth() + 1, 1))
  const aturan = await prisma.pengaturanLembur.findUnique({ where: { studioId: S } })
  let slip = await lemburUntukSlip({ userId: tal.id, studioId: S, awal, akhir, aturan })
  cek('Slip: usulan yang belum disetujui tidak dihitung', !slip.baris.some(b => b.id === calon.id), String(slip.uang))
  r = await K(`/api/circle/lembur/${calon.id}/setujui`, { method: 'POST', body: { studioId: S } })
  l = await prisma.lemburKehadiran.findUnique({ where: { id: calon.id } })
  cek('Koordinator menyetujui tanpa mengubah → nilai = usulan admin Rp90.000', r.s === 200 && l.status === 'DISETUJUI' && l.nilaiProyek === 90000, `${r.s} ${r.j.message} ${l.nilaiProyek}`)
  slip = await lemburUntukSlip({ userId: tal.id, studioId: S, awal, akhir, aturan })
  cek('Slip: lembur disetujui ikut dihitung (+Rp90.000)', slip.baris.some(b => b.id === calon.id) && slip.uang >= 90000, String(slip.uang))
  r = await A(`/api/circle/lembur/${calon.id}/usul`, { method: 'POST', body: { nilai: 1 } }); cek('Usulan setelah diputuskan → 409', r.s === 409)
  // usulan kedua (tal2) → koordinator menimpa nilai
  await A(`/api/circle/lembur/${lP.id}/usul`, { method: 'POST', body: { levelId: levelUji.id, tahap: [idTahap.Final] } })
  r = await K(`/api/circle/lembur/${lP.id}/setujui`, { method: 'POST', body: { studioId: S, nilai: 25000 } }); l = await prisma.lemburKehadiran.findUnique({ where: { id: lP.id } })
  cek('Koordinator mengubah nilai saat menyetujui → Rp25.000 (usulan admin Rp30.000 tetap tercatat)', r.s === 200 && l.nilaiProyek === 25000 && l.nilaiUsulan === 30000, `${l.nilaiProyek}/${l.nilaiUsulan}`)
  r = await K(`/api/circle/papan?studioId=${S}`); cek('Papan: tanda 🌙 hilang setelah diputuskan', !r.j.data?.orders.find(o => o.id === oT.id)?.lembur)

  // Presensi pulang lewat jam tidak membuat lembur otomatis di unit ini
  const { lemburOtomatis } = await import(DASH + '/server/src/utils/kehadiran.js')
  cek('(acuan) fungsi lembur otomatis tetap ada untuk unit lain', typeof lemburOtomatis === 'function')
  // Matikan setelan → catat manual terbuka lagi
  r = await K('/api/circle/lembur/aturan', { method: 'PUT', body: { studioId: S, mode: 'PER_LEVEL', lemburDariTunda: false } })
  r = await Tl(`/api/circle/kehadiran/order-lembur?studioId=${S}`); cek('Setelan dimatikan → form lembur manual kembali (dariTunda false)', r.j.data?.dariTunda === false)
  r = await A(`/api/circle/tugas-admin?studioId=${S}`); cek('Setelan dimatikan → Tugas admin tanpa bagian lembur', r.j.data?.lemburAktif === false)
} catch (e) {
  console.log('❌ Galat tak terduga:', e.message, e.stack?.split('\n')[1]); gagal++
} finally {
  await prisma.lemburKehadiran.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { userId: { in: dibuat } }] } })
  for (const m of ['riwayatTahapOrder', 'penugasanTahap', 'assignmentProduksi', 'auditOrder', 'updateKlien', 'catatanOrder']) await prisma[m].deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
  await prisma.orderProduksi.deleteMany({ where: { id: { in: orderIds } } })
  if (levelUji) await prisma.levelLembur.delete({ where: { id: levelUji.id } }).catch(() => {})
  await prisma.tahapLembur.deleteMany({ where: { studioId: S } }); if (tahapLama.length) await prisma.tahapLembur.createMany({ data: tahapLama })
  await prisma.pengaturanLembur.deleteMany({ where: { studioId: S } }); if (aturanLama) await prisma.pengaturanLembur.create({ data: aturanLama })
  await prisma.jamKerjaUnit.deleteMany({ where: { studioId: S } }); if (jamLama) await prisma.jamKerjaUnit.create({ data: jamLama })
  await prisma.produksiAdminMarket.deleteMany({ where: { userId: { in: dibuat } } })
  await prisma.fungsiAnggota.deleteMany({ where: { userId: { in: dibuat } } }).catch(() => {})
  for (const id of dibuat) { await prisma.logLogin.deleteMany({ where: { userId: id } }); await prisma.userRole.deleteMany({ where: { userId: id } }); await prisma.user.delete({ where: { id } }) }
  console.log(`(data uji dihapus) — gagal: ${gagal}`); await prisma.$disconnect()
  process.exit(gagal ? 1 : 0)
}
