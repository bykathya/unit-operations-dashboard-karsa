import { api } from './api'

// Karsa Circle (tahap 6): slip memuat nomor rekening LENGKAP (hanya orangnya sendiri & Koordinator unit yang bisa membuka slip ini).
// Slip gaji siap cetak/PDF: data dari server (/gaji/:id/slip), dibuka di jendela baru lalu dialog cetak browser (pola sama dengan invoice Tagihan).
const rp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function isiSlip(s) {
  const baris = (nama, jml, minus) => jml > 0 ? `<tr><td>${esc(nama)}</td><td class="k">${minus ? '− ' : ''}${esc(rp(jml))}</td></tr>` : ''
  const tgl = (v) => new Date(v + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const lembur = s.lembur > 0 ? `Lembur presensi${s.lemburHari ? ` (${(s.lemburMenit / 60).toFixed(1)} jam di ${s.lemburHari} hari)` : ''}${s.lemburSusulan?.length ? ` · termasuk susulan ${s.lemburSusulan.join(', ')}` : ''}` : ''
  return `<section class="slip">
    <div class="atas"><div><h1>${esc(s.studio)}</h1>${s.induk ? `<div class="redup">${esc(s.induk)}</div>` : ''}</div>
      <div class="k"><div style="font-size:18px;font-weight:700">SLIP GAJI</div><div>${esc(s.periode)}</div>${s.status === 'DRAFT' ? '<div class="redup">(draf)</div>' : ''}</div></div>
    <div><span class="redup">Nama:</span> <b>${esc(s.nama)}</b>${s.posisi ? ` <span class="redup">· ${esc(s.posisi)}</span>` : ''}</div>
    ${s.rekening ? `<div><span class="redup">Ditransfer ke:</span> ${esc(s.rekening.bank ?? '')} ${esc(s.rekening.nomor)} <span class="redup">a.n.</span> ${esc(s.rekening.atasNama)}</div>` : ''}
    ${s.tanggalBayar ? `<div><span class="redup">${s.status === 'DIBAYAR' ? 'Dibayar pada:' : 'Jadwal gajian:'}</span> ${esc(tgl(s.tanggalBayar))}${s.shu > 0 && s.tanggalBayarShu ? ` <span class="redup">· SHU:</span> ${esc(tgl(s.tanggalBayarShu))}` : ''}</div>` : ''}
    <h3>Penghasilan</h3><table><tbody>
      ${baris('Gaji pokok', s.gajiPokok)}${s.tetap.map(t => baris(t.nama, t.jumlah)).join('')}${s.tambahan.map(t => baris(t.nama, t.jumlah)).join('')}
      ${baris('Bonus', s.bonus)}${baris('Komisi', s.komisi)}${baris('SHU', s.shu)}${baris(lembur, s.lembur)}</tbody></table>
    ${s.potongan > 0 ? `<h3>Potongan</h3><table><tbody>${baris('Potongan', s.potongan, true)}</tbody></table>` : ''}
    <table><tfoot><tr><td>Diterima (THP)</td><td class="k">${esc(rp(s.thp))}</td></tr></tfoot></table>
    ${s.catatan ? `<div class="kotak"><b>Catatan</b>\n${esc(s.catatan)}</div>` : ''}
    <p class="redup" style="margin-top:28px;font-size:12px">${s.dilaporkanOleh ? `Disiapkan oleh ${esc(s.dilaporkanOleh)}. ` : ''}Dokumen ini dihasilkan dari web circle.</p>
  </section>`
}
const kepala = (judul) => `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:40px;font-size:14px}h1{margin:0;font-size:20px}
    .atas{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}
    .redup{color:#555}table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:7px 8px;border-bottom:1px solid #ddd}.k{text-align:right}
    tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none;font-size:16px}h3{margin:20px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#555}
    .kotak{margin-top:20px;padding:12px;border:1px solid #ccc;border-radius:6px;white-space:pre-wrap}@media print{body{margin:16mm}}.slip+.slip{page-break-before:always;margin-top:0}</style></head><body>
`

export async function cetakSlip(id) { return cetakBanyak([id], null) }

// Beberapa slip dalam SATU jendela cetak (tiap slip satu halaman) — browser hanya mengizinkan satu pop-up per klik.
export async function cetakBanyak(ids, judul) {
  const w = window.open('', '_blank')
  if (!w) { alert('Jendela cetak diblokir browser — izinkan pop-up untuk alamat ini.'); return }
  w.document.write('<p style="font-family:sans-serif">Menyiapkan slip…</p>')
  let semua
  try { semua = await Promise.all(ids.map(id => api(`/api/circle/gaji/${id}/slip`))) } catch (e) { w.close(); alert(e.message); return }
  const html = kepala(judul ?? (semua.length === 1 ? `Slip gaji ${semua[0].nama} ${semua[0].periode}` : 'Slip gaji')) + semua.map(isiSlip).join('') + '<script>window.onload=()=>window.print()</script></body></html>'
  w.document.open(); w.document.write(html); w.document.close()
}
