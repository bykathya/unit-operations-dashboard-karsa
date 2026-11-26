import { DASH } from './_jalur.mjs'
const { PRESET, bangunPreset, aksiTersedia, langkahAktif, validasiTemplat, jenisNormal } = await import(DASH + '/server/src/utils/alur.js')
let gagal = 0
const cek = (l, ok, i = '') => { console.log(`${ok ? '✅' : '❌'} ${l}${i ? '  — ' + i : ''}`); if (!ok) gagal++ }

async function templat(kunci) {
  const baris = []; let n = 0
  await bangunPreset(kunci, async (b) => { const id = 't' + (++n); baris.push({ id, ...b }); return id })
  return baris
}
const MAN = { manajer: true, ditugaskan: false }, TAL = { manajer: false, ditugaskan: true }, ORANG = { manajer: false, ditugaskan: false }, MKT = { manajer: false, ditugaskan: false, marketer: true }
// simulasi: jalankan aksi berantai, kembalikan jejak nama tahap
function jalan(t, order, mulaiNama, langkah) {
  let sekarang = t.find(x => x.nama === mulaiNama); const riwayat = [{ tahapId: sekarang.id, jenis: sekarang.jenis }]; const jejak = [sekarang.nama]; let rev = 0
  for (const [aksi, peran] of langkah) {
    const a = aksiTersedia({ templat: t, order, sekarang, riwayat, peran }).find(x => x.aksi === aksi)
    if (!a) return { galat: `aksi "${aksi}" tidak tersedia di "${sekarang.nama}" untuk ${peran === MAN ? 'manajer' : 'talent'}`, jejak, rev }
    if (a.naikRevisi) rev++
    sekarang = t.find(x => x.id === a.ke); riwayat.push({ tahapId: sekarang.id, jenis: sekarang.jenis }); jejak.push(sekarang.nama)
  }
  return { jejak, rev, sekarang }
}

console.log('— validasi templat bawaan —')
for (const k of Object.keys(PRESET)) { const t = await templat(k); const g = validasiTemplat(t); cek(`Preset "${k}" sah (${t.length} langkah)`, g.length === 0, g.join('; ')) }

console.log('— sederhana (PiBi) —')
let t = await templat('sederhana'), o = { tahapAktif: [] }
let r = jalan(t, o, 'Inbox', [['lanjut', MAN], ['lanjut', TAL], ['revisi_klien', MAN], ['lanjut', TAL], ['lanjut', MAN]])
cek('Inbox→Pengerjaan→Preview→Revisi→Preview→Done, revisi dihitung 1', r.jejak?.join('>') === 'Inbox>Pengerjaan>Preview>Revisi>Preview>Done' && r.rev === 1, r.galat ?? r.jejak.join('>'))
r = jalan(t, o, 'Pengerjaan', [['lanjut', TAL], ['lanjut', TAL]]); cek('Talent tidak bisa menyetujui Preview ("Klien setuju") → ditolak', !!r.galat)
r = jalan(t, o, 'Inbox', [['hold', MAN], ['lanjut', MAN]]); cek('Hold dari Inbox lalu Lanjutkan kembali ke Inbox', r.jejak?.join('>') === 'Inbox>Hold>Inbox', r.galat ?? r.jejak.join('>'))

console.log('— ilustrasi (gerbang QC per tahap) —')
t = await templat('ilustrasi'); o = { tahapAktif: [] }
r = jalan(t, o, 'Inbox', [['lanjut', MAN], ['lanjut', TAL], ['gagal', MAN], ['lanjut', TAL], ['lanjut', MAN]])
cek('Sketch → QC gagal → Revisi: Sketch → QC lolos → Line Art', r.jejak?.join('>') === 'Inbox>Sketch>QC: Sketch>Revisi: Sketch>QC: Sketch>Line Art' || false, r.galat ?? r.jejak.join('>'))
cek('  …revisi internal terhitung 1', r.rev === 1)
r = jalan(t, o, 'Inbox', [['lanjut', MAN], ['lanjut', TAL], ['lanjut', TAL]]); cek('Talent tidak bisa meloloskan QC sendiri → ditolak', !!r.galat, r.galat)
r = jalan(t, o, 'Inbox', [['lanjut', MAN], ['lanjut', TAL], ['lanjut', MAN], ['lanjut', TAL], ['lanjut', MAN], ['lanjut', TAL], ['lanjut', MAN], ['lanjut', TAL], ['lanjut', MAN]])
cek('Empat tahap lolos QC semua → Delivery (Preview Klien mati bawaan, Delivery menyala)', r.sekarang?.nama === 'Delivery', r.galat ?? r.jejak.join('>'))
const ops = t.filter(x => x.opsional && x.nama !== 'Finalisasi').map(x => x.id)
const oPreview = { tahapAktif: ops }
r = jalan(t, oPreview, 'Finishing', [['lanjut', TAL], ['lanjut', MAN], ['revisi_klien', MKT], ['lanjut', TAL], ['lanjut', MKT], ['lanjut', MKT]])
cek('Preview Klien dinyalakan, marketer memegang sisi klien: Finishing→QC→Preview→Revisi klien→Preview→Delivery→Done', r.jejak?.join('>') === 'Finishing>QC: Finishing>Preview klien>Revisi klien>Preview klien>Delivery>Done', r.galat ?? r.jejak.join('>'))
const matiPreview = { tahapAktif: [t.find(x => x.nama === 'Preview klien').id] } // hanya preview, tanpa revisi klien dinyalakan
const aktifNama = langkahAktif(t, { tahapAktif: [t.find(x => x.nama === 'Revisi klien').id] }).map(x => x.nama)
cek('Revisi klien tanpa Preview klien otomatis tidak aktif (aturan OGS)', !aktifNama.includes('Revisi klien') && !aktifNama.includes('Preview klien'))
const adaHold = jalan(t, o, 'QC: Sketch', [['hold', MAN], ['lanjut', MAN]]); cek('Hold dari QC lalu Lanjutkan kembali ke QC yang sama', adaHold.jejak?.join('>') === 'QC: Sketch>Hold>QC: Sketch', adaHold.galat ?? adaHold.jejak.join('>'))
r = jalan(t, o, 'Done', [['buka', MAN]]); cek('Buka kembali Done tanpa riwayat → jatuh ke tahap kerja pertama', r.sekarang?.nama === 'Sketch', r.galat ?? r.jejak.join('>'))
r = jalan(t, o, 'Done', [['buka', TAL]]); cek('Talent tidak bisa membuka Done', !!r.galat)
let a = aksiTersedia({ templat: t, order: o, sekarang: t.find(x => x.nama === 'Sketch'), riwayat: [], peran: ORANG }); cek('Orang yang bukan manajer & tidak ditugaskan: tidak ada aksi', a.length === 0)
a = aksiTersedia({ templat: t, order: o, sekarang: t.find(x => x.nama === 'Done'), riwayat: [], peran: MAN }); cek('Done: hanya "Buka kembali" (tanpa Hold)', a.map(x => x.aksi).join() === 'buka')

console.log('— kepemilikan fase (mesin v2: marketer memegang Klien, Delivery, Selesai) —')
t = await templat('ilustrasi'); const oP = { tahapAktif: t.filter(x => x.opsional).map(x => x.id) }
const di = (nama, peran, o = oP) => aksiTersedia({ templat: t, order: o, sekarang: t.find(x => x.nama === nama), riwayat: [], peran }).map(a => a.aksi).join(',')
cek('Marketer di Preview klien: setuju / minta revisi / menunggu client', di('Preview klien', MKT) === 'lanjut,revisi_klien,menunggu_klien' || di('Preview klien', MKT).split(',').sort().join() === 'lanjut,menunggu_klien,revisi_klien', di('Preview klien', MKT))
cek('Marketer di QC: tidak punya aksi (QC milik koordinator/admin)', di('QC: Sketch', MKT) === '')
cek('Marketer di Sketch (kerja): tidak punya aksi', di('Sketch', MKT) === '')
cek('Marketer di Inbox: hanya "menunggu client" (tidak bisa memulai pekerjaan)', di('Inbox', MKT) === 'menunggu_klien')
cek('Artist di Delivery: tidak punya aksi (milik marketer)', di('Delivery', TAL) === '')
cek('Marketer di Delivery: terkirim + menunggu client', di('Delivery', MKT).split(',').sort().join() === 'lanjut,menunggu_klien')
cek('Artist di Preview klien: tidak punya aksi', di('Preview klien', TAL) === '')
r = jalan(t, oP, 'Preview klien', [['menunggu_klien', MKT], ['lanjut', MKT]]); cek('Menunggu client lalu "Client merespons" kembali ke Preview klien', r.jejak?.join('>') === 'Preview klien>Menunggu client>Preview klien', r.galat ?? r.jejak.join('>'))
r = jalan(t, oP, 'Inbox', [['menunggu_klien', MKT], ['lanjut', MKT]]); cek('Dari Inbox: menunggu client lalu kembali ke Inbox', r.jejak?.join('>') === 'Inbox>Menunggu client>Inbox', r.galat ?? r.jejak.join('>'))
r = jalan(t, oP, 'Menunggu client', [['hold', MAN]]); cek('Dari Menunggu client tidak bisa Hold (sudah status tunggu)', !!r.galat)
const oFin = { tahapAktif: t.filter(x => x.opsional && x.nama !== 'Revisi klien' && x.nama !== 'Preview klien').map(x => x.id) }
r = jalan(t, oFin, 'Finishing', [['lanjut', TAL], ['lanjut', MAN]]); cek('Finalisasi menyala: QC lolos → Finalisasi → (artist) → Delivery', (r.sekarang?.nama === 'Finalisasi'), r.galat ?? r.jejak.join('>'))
r = jalan(t, oFin, 'Finalisasi', [['lanjut', TAL]]); cek('Artist menyelesaikan Finalisasi → Delivery', r.sekarang?.nama === 'Delivery', r.galat ?? r.jejak.join('>'))
r = jalan(t, oFin, 'Finalisasi', [['lanjut', MKT]]); cek('Marketer TIDAK bisa menutup Finalisasi bila berikutnya Delivery (pekerjaan produksi)', !!r.galat)
const tSel = await templat('sederhana'); const oS = { tahapAktif: [] }
const dis = (nama, peran) => aksiTersedia({ templat: tSel, order: oS, sekarang: tSel.find(x => x.nama === nama), riwayat: [], peran }).map(a => a.aksi).sort().join(',')
cek('Sederhana (PiBi) tanpa Menunggu client: marketer di Preview punya setuju + minta revisi saja', dis('Preview', MKT) === 'lanjut,revisi_klien')
console.log('— preset layanan (taksonomi Daily Chat Sekartaji) —')
const tL = await templat('layanan'); const oL = { tahapAktif: [] }
function jl(mulai, langkah) { let sk = tL.find(x => x.nama === mulai); const ri = [{ tahapId: sk.id, jenis: sk.jenis }]; const jj = [sk.nama]; for (const [a, p] of langkah) { const x = aksiTersedia({ templat: tL, order: oL, sekarang: sk, riwayat: ri, peran: p }).find(y => y.aksi === a); if (!x) return { galat: `"${a}" tidak tersedia di "${sk.nama}"`, jj }; sk = tL.find(y => y.id === x.ke); ri.push({ tahapId: sk.id, jenis: sk.jenis }); jj.push(sk.nama) } return { jj } }
let q = jl('Queue', [['menunggu_klien', MKT], ['lanjut', MKT], ['lanjut', MAN], ['lanjut', TAL], ['revisi_klien', MKT], ['lanjut', TAL], ['lanjut', MKT]])
cek('Queue → Menunggu Client → Queue → Progress → Preview → Revision → Preview → Done', q.jj?.join('>') === 'Queue>Menunggu Client>Queue>Progress>Preview>Revision>Preview>Done', q.galat ?? q.jj.join('>'))
console.log('— opsional tahap kerja & gerbangnya ikut mati —')
t = await templat('3d'); const tOpsional = t.map(x => x.nama === 'Texture' ? { ...x, opsional: true, aktifBawaan: false } : x)
let akt = langkahAktif(tOpsional, []).map(x => x.nama)
cek('Texture opsional & mati: Texture + QC + Revisi-nya ikut tidak aktif', !akt.some(n => n.includes('Texture')) && akt.includes('Modeling') && akt.includes('Rigging'), akt.join('>'))
r = jalan(tOpsional, { tahapAktif: [] }, 'QC: Modeling', [['lanjut', MAN]]); cek('Setelah QC Modeling langsung ke Rigging (Texture dilewati)', r.sekarang?.nama === 'Rigging', r.galat ?? r.jejak.join('>'))
akt = langkahAktif(tOpsional, [tOpsional.find(x => x.nama === 'Texture').id]).map(x => x.nama)
cek('Texture dinyalakan per order: ikut masuk jalur beserta gerbangnya', akt.includes('Texture') && akt.includes('QC: Texture'))

console.log('— validasi templat (cegah templat rusak) —')
t = await templat('ilustrasi')
let g = validasiTemplat(t.filter(x => x.jenis !== 'SELESAI')); cek('Tanpa langkah Selesai → ditolak', g.length > 0)
g = validasiTemplat(t.map(x => x.nama === 'Hold' ? { ...x, jenis: 'MASUK' } : x)); cek('Dua Inbox → ditolak', g.length > 0)
g = validasiTemplat(t.filter(x => x.nama !== 'QC: Sketch')); cek('Revisi internal tanpa QC yang dituju → ditolak', g.some(m => m.includes('QC yang dituju')))
g = validasiTemplat(t.map(x => x.nama === 'Hold' ? { ...x, nama: 'Done' } : x)); cek('Nama langkah ganda → ditolak', g.some(m => m.includes('ganda')))
g = validasiTemplat(t.map(x => x.nama === 'Inbox' ? { ...x, urutan: 99 } : x)); cek('Inbox tidak di awal → ditolak', g.some(m => m.includes('paling awal')))
cek('Legacy PREVIEW/REVISI dibaca sebagai PREVIEW_KLIEN/REVISI_KLIEN', jenisNormal('PREVIEW') === 'PREVIEW_KLIEN' && jenisNormal('REVISI') === 'REVISI_KLIEN')
console.log('— Inbox bukan antrean talent (10 Nov 2026) —')
{
  const ts = await templat('sederhana'), inbox = ts.find(x => x.jenis === 'MASUK')
  const WAKIL = { manajer: false, ditugaskan: true, marketer: true }
  const ak = (peran) => aksiTersedia({ templat: ts, order: { tahapAktif: [] }, sekarang: inbox, riwayat: [], peran }).map(a => a.aksi).join(',')
  cek('Talent murni di Inbox: tidak ada aksi mulai', !ak(TAL).includes('lanjut'))
  cek('Koordinator di Inbox: "Mulai kerjakan" tersedia', ak(MAN).includes('lanjut'))
  cek('Wakil freelance (marketer yang ditugaskan) di Inbox: boleh memulai', ak(WAKIL).includes('lanjut'))
  cek('Marketer biasa di Inbox: tetap hanya "menunggu client"-nya (tidak memulai)', !ak(MKT).includes('lanjut'))
}

console.log('— QC semua (pengaturan unit, 12 Nov 2026, masukan tim) —')
{
  const tq = await templat('ilustrasi'), semuaOps = { tahapAktif: tq.filter(x => x.opsional).map(x => x.id) }
  const tanpa = jalan(tq, semuaOps, 'Revisi klien', [['lanjut', TAL]])
  cek('(kontrol) qcSemua mati: Revisi klien → Preview klien langsung', tanpa.sekarang?.nama === 'Preview klien', tanpa.galat ?? tanpa.jejak.join('>'))
  tq.qcSemua = true
  let q = jalan(tq, semuaOps, 'Revisi klien', [['lanjut', TAL], ['lanjut', MAN]])
  cek('qcSemua: Revisi klien → QC terakhir (QC: Finishing) → QC lolos → Preview klien', q.jejak?.join('>') === 'Revisi klien>QC: Finishing>Preview klien', q.galat ?? q.jejak.join('>'))
  q = jalan(tq, semuaOps, 'Finalisasi', [['lanjut', TAL], ['lanjut', MAN]])
  cek('qcSemua: Finalisasi → QC: Finishing → QC lolos → Delivery (bukan langkah sesudah QC di urutan)', q.jejak?.join('>') === 'Finalisasi>QC: Finishing>Delivery', q.galat ?? q.jejak.join('>'))
  q = jalan(tq, semuaOps, 'Finalisasi', [['lanjut', TAL], ['gagal', MAN], ['lanjut', TAL], ['lanjut', MAN]])
  cek('qcSemua: Finalisasi → QC gagal → revisi internal → QC → lolos → tetap ke Delivery', q.jejak?.join('>') === 'Finalisasi>QC: Finishing>Revisi: Finishing>QC: Finishing>Delivery', q.galat ?? q.jejak.join('>'))
  q = jalan(tq, semuaOps, 'Sketch', [['lanjut', TAL], ['lanjut', MAN]])
  cek('qcSemua: tahap bergerbang QC tetap seperti biasa (Sketch → QC: Sketch → Line Art)', q.jejak?.join('>') === 'Sketch>QC: Sketch>Line Art', q.galat ?? q.jejak.join('>'))
  q = jalan(tq, semuaOps, 'Finalisasi', [['lanjut', TAL], ['lanjut', TAL]])
  cek('qcSemua: talent tidak bisa meloloskan QC sendiri', !!q.galat, q.galat)
  const ts = await templat('sederhana'); ts.qcSemua = true
  q = jalan(ts, { tahapAktif: [] }, 'Pengerjaan', [['lanjut', TAL]])
  cek('qcSemua di alur TANPA langkah QC: diabaikan (Pengerjaan → Preview)', q.sekarang?.nama === 'Preview', q.galat ?? q.jejak.join('>'))
}

console.log(`\ngagal: ${gagal}`); process.exit(gagal ? 1 : 0)
