import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'
import { PilihCari } from './Pilihan'
import { unduhCsv } from './api-util'

// TAGIHAN KOMUNITAS (adaptasi OGS CommunityInvoice; sisi staf): gabung beberapa order SATU klien jadi satu tagihan.
// Draft → Ditagih → Lunas (lunas = status bayar order ikut Lunas).
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const tg = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const WARNA = { DRAFT: '', DITAGIH: '', LUNAS: 'jenis-SELESAI', BATAL: 'revisi' }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// INVOICE siap cetak (9 Nov 2026, permintaan tim Langit): nama studio/PH + rekening penerima dari "Penerbit invoice" (diisi koordinator).
// Dibuka di jendela baru lalu dialog cetak/PDF browser. Tanpa unggahan berkas.
export function cetakInvoice(t) {
  const p = t.penerbit ?? {}
  // Rekening penerima kosong → ingatkan sebelum mencetak (laporan tim 10 Nov 2026: invoice tercetak tanpa nomor rekening)
  if (!p.rekening && !window.confirm('Rekening penerima BELUM diisi, jadi invoice tidak memuat nomor rekening.\n\nIsi dulu lewat tombol "Penerbit invoice" di bagian atas halaman Tagihan (Koordinator unit). Tetap cetak sekarang?')) return
  const tanggal = new Date(t.ditagihPada ?? Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const baris = t.item.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.judul)}</td><td class="k">${esc(rp(i.jumlah))}</td></tr>`).join('')
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(t.nomor)}</title><style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:40px;font-size:14px}h1{margin:0;font-size:22px}
    .atas{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}
    .redup{color:#555}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
    .k{text-align:right}tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none}.kotak{margin-top:22px;padding:12px;border:1px solid #ccc;border-radius:6px;white-space:pre-wrap}
    @media print{body{margin:16mm}}</style></head><body>
    <div class="atas"><div><h1>${esc(p.nama || 'Invoice')}</h1>${p.induk ? `<div class="redup">${esc(p.induk)}</div>` : ''}</div>
      <div class="k"><div style="font-size:18px;font-weight:700">INVOICE</div><div>${esc(t.nomor)}</div><div class="redup">${esc(tanggal)}</div></div></div>
    <div><span class="redup">Kepada:</span> <b>${esc(t.klien)}</b></div>
    <table><thead><tr><th style="width:40px">No</th><th>Pekerjaan</th><th class="k">Jumlah</th></tr></thead><tbody>${baris}</tbody>
      <tfoot><tr><td></td><td>Total</td><td class="k">${esc(rp(t.total))}</td></tr></tfoot></table>
    ${t.catatan ? `<div class="kotak"><b>Catatan</b>\n${esc(t.catatan)}</div>` : ''}
    ${p.rekening ? `<div class="kotak"><b>Pembayaran ke</b>\n${esc(p.rekening)}</div>` : ''}
    ${p.catatanKaki ? `<p class="redup" style="margin-top:22px;white-space:pre-wrap">${esc(p.catatanKaki)}</p>` : ''}
    <script>window.onload=()=>window.print()</script></body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Jendela cetak diblokir browser — izinkan pop-up untuk alamat ini.'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

// Penerbit invoice per unit: nama, rekening penerima, catatan kaki — diisi Koordinator unit (rekening Ekosistem tidak dipakai)
function Penerbit({ studioId, onTutup }) {
  const [f, setF] = useState(null), [galat, setGalat] = useState(''), [ok, setOk] = useState('')
  useEffect(() => { api(`/api/circle/tagihan/penerbit?studioId=${studioId}`).then(setF).catch(e => setGalat(e.message)) }, [studioId])
  if (!f) return <div className="panel">{galat ? <div className="galat">{galat}</div> : <span className="redup">Memuat…</span>}</div>
  const simpan = (e) => { e.preventDefault(); setOk(''); aksi(async () => { await api(`/api/circle/tagihan/penerbit?studioId=${studioId}`, { method: 'PUT', body: { namaPenerbit: f.namaPenerbit, rekening: f.rekening, catatanKaki: f.catatanKaki } }); setOk('Tersimpan.') }, setGalat) }
  return (
    <form className="panel" style={{ marginBottom: 12 }} onSubmit={simpan}>
      <div className="baris-atas"><b>Penerbit invoice</b><button type="button" className="btn kecil" onClick={onTutup}>Tutup</button></div>
      <p className="redup kecil">Tampil di setiap invoice yang dicetak. Rekening bisa diambil dari data Management Dashboard (tombol di bawah, hanya terlihat oleh koordinator unit) atau diketik sendiri — yang tercetak adalah yang disimpan di sini.</p>
      {galat && <div className="galat">{galat}</div>}
      <label>Nama studio / PH di invoice<input value={f.namaPenerbit} disabled={!f.bisaUbah} onChange={e => setF({ ...f, namaPenerbit: e.target.value })} placeholder={f.contoh?.nama ?? ''} maxLength={120} /></label>
      {f.bisaUbah && (f.rekeningInternal ?? []).length > 0 && <div className="chips" style={{ marginBottom: 4 }}><span className="redup kecil">Isi dari rekening Ekosistem:</span>{f.rekeningInternal.map((r, i) => <button type="button" key={i} className="btn kecil" onClick={() => setF({ ...f, rekening: `${r.namaBank} ${r.nomorRekening} a.n. ${r.atasNama}` })}>{r.namaBank} ···{String(r.nomorRekening).slice(-4)}</button>)}</div>}
      <label>Rekening penerima<textarea rows={3} value={f.rekening} disabled={!f.bisaUbah} onChange={e => setF({ ...f, rekening: e.target.value })} placeholder={'mis. BCA 1234567890 a.n. Nama Penerima'} maxLength={500} /></label>
      <label>Catatan kaki (opsional)<textarea rows={2} value={f.catatanKaki} disabled={!f.bisaUbah} onChange={e => setF({ ...f, catatanKaki: e.target.value })} placeholder="mis. Terima kasih atas kepercayaannya." maxLength={500} /></label>
      {f.bisaUbah ? <button className="btn utama">Simpan</button> : <p className="nada-warn kecil">Hanya Koordinator/Pendamping unit yang bisa mengisi data ini{(f.yangBoleh ?? []).length ? <>: <b>{f.yangBoleh.join(', ')}</b>. Minta mereka mengisinya sekali.</> : '.'} Akunmu hanya bisa melihat.</p>}
      {ok && <span className="nada-ok kecil" style={{ marginLeft: 8 }}>{ok}</span>}
    </form>
  )
}

const labelKlien = (k) => `${k.klien} · ${k.order} order · ${rp(k.total)}`
function Baru({ studioId, onSelesai, onBatal }) {
  const [klien, setKlien] = useState([]), [pilih, setPilih] = useState(''), [order, setOrder] = useState([]), [dipilih, setDipilih] = useState([]), [catatan, setCatatan] = useState(''), [galat, setGalat] = useState('')
  useEffect(() => { api(`/api/circle/tagihan/klien?studioId=${studioId}`).then(setKlien).catch(e => setGalat(e.message)) }, [studioId])
  useEffect(() => { setDipilih([]); if (pilih) api(`/api/circle/tagihan/layak?studioId=${studioId}&klien=${encodeURIComponent(pilih)}`).then(o => { setOrder(o); setDipilih(o.map(x => x.id)) }).catch(e => setGalat(e.message)); else setOrder([]) }, [studioId, pilih])
  const total = order.filter(o => dipilih.includes(o.id)).reduce((a, b) => a + b.nilaiKotor, 0)
  return (
    <form className="panel" onSubmit={e => { e.preventDefault(); aksi(async () => { const d = await api('/api/circle/tagihan', { method: 'POST', body: { studioId, klien: pilih, orderIds: dipilih, catatan } }); onSelesai(d.id) }, setGalat) }}>
      <h3 className="judul-bagian">Tagihan baru</h3>
      {galat && <div className="galat">{galat}</div>}
      {/* Cari klien dengan mengetik (14 Nov 2026, masukan tim): daftar klien panjang, tidak perlu menggulir */}
      <div className="isian">Klien{pilih
        ? <div className="toolbar" style={{ margin: 0 }}><b>{pilih}</b><button type="button" className="btn kecil" onClick={() => setPilih('')}>ganti klien</button></div>
        : <PilihCari pilihan={klien.map(labelKlien)} placeholder="ketik nama klien…" onPilih={(l) => setPilih(klien.find(k => labelKlien(k) === l)?.klien ?? '')} />}</div>
      {klien.length === 0 && <div className="redup kecil">Tidak ada order yang layak ditagih (belum lunas, belum ada di tagihan lain, bernilai &gt; 0).</div>}
      {order.map(o => <label key={o.id} className="meta" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={dipilih.includes(o.id)} onChange={() => setDipilih(v => v.includes(o.id) ? v.filter(x => x !== o.id) : [...v, o.id])} /> {o.judul} <span className="redup">{rp(o.nilaiKotor)}</span></label>)}
      <label>Catatan<input value={catatan} onChange={e => setCatatan(e.target.value)} maxLength={1000} /></label>
      <div><b>Total: {rp(total)}</b></div>
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama" disabled={!dipilih.length}>Buat tagihan</button></div>
    </form>
  )
}

function Detail({ id, onTutup }) {
  const [t, setT] = useState(null), [galat, setGalat] = useState(''), [bayar, setBayar] = useState(false), [f, setF] = useState({ tanggal: new Date().toISOString().slice(0, 10), tautanBukti: '' })
  const muat = useCallback(() => api(`/api/circle/tagihan/${id}`).then(x => { setT(x); setGalat('') }).catch(e => setGalat(e.message)), [id])
  useEffect(() => { muat() }, [muat])
  if (!t) return <div className="redup">{galat || 'Memuat…'}</div>
  const post = (j, body) => aksi(() => api(`/api/circle/tagihan/${id}/${j}`, { method: 'POST', body: body ?? {} }), setGalat, muat)
  return (
    <div>
      <button className="btn kecil" onClick={onTutup}>← Daftar</button>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="panel" style={{ marginTop: 10 }}>
        <div className="meta"><b>{t.nomor}</b><span className={'lencana ' + WARNA[t.status]}>{t.labelStatus}</span><span>{t.klien}</span></div>
        <table style={{ marginTop: 8 }}><tbody>{t.item.map(i => <tr key={i.id}><td>{i.judul}</td><td style={{ textAlign: 'right' }}>{rp(i.jumlah)}</td></tr>)}<tr style={{ fontWeight: 700 }}><td>Total</td><td style={{ textAlign: 'right' }}>{rp(t.total)}</td></tr></tbody></table>
        {t.catatan && <div className="redup kecil" style={{ marginTop: 6 }}>{t.catatan}</div>}
        <div className="redup kecil" style={{ marginTop: 6 }}>Ditagih: {tg(t.ditagihPada)} · Lunas: {tg(t.lunasPada)}{t.tautanBukti && <> · <a href={t.tautanBukti} target="_blank" rel="noreferrer noopener">bukti bayar</a></>}</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {t.status === 'DRAFT' && <button className="btn utama" onClick={() => post('tagih')}>Tandai ditagih</button>}
          {['DRAFT', 'DITAGIH'].includes(t.status) && <button className="btn" onClick={() => confirm(t.status === 'DITAGIH' ? 'Batalkan tagihan yang sudah terbit ini? (mis. klien batal sebelum membayar; nomornya tetap tercatat)' : 'Batalkan tagihan ini?') && post('batal')}>Batalkan</button>}
          {t.status === 'DITAGIH' && <button className="btn utama" onClick={() => setBayar(!bayar)}>Catat pembayaran…</button>}
          {t.status === 'DITAGIH' && <button className="btn" onClick={() => post('draft')}>Kembali ke draft</button>}
          {t.status === 'BATAL' && <button className="btn" onClick={() => post('aktifkan')}>Aktifkan lagi</button>}
          {t.status !== 'BATAL' && <button className="btn" onClick={() => cetakInvoice(t)} title="Invoice dengan nama studio/PH & rekening penerima">🖨 Cetak invoice</button>}
          {t.status !== 'BATAL' && !t.penerbit?.rekening && <span className="nada-warn kecil">Rekening penerima belum diisi — isi di "Penerbit invoice" (atas halaman Tagihan) supaya tercetak di invoice.</span>}
        </div>
        {bayar && <form className="chips" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); aksi(async () => { await api(`/api/circle/tagihan/${id}/lunas`, { method: 'POST', body: { tanggal: f.tanggal, tautanBukti: f.tautanBukti || undefined } }); setBayar(false) }, setGalat, muat) }}>
          <input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /><input placeholder="Tautan bukti bayar (opsional)" value={f.tautanBukti} onChange={e => setF({ ...f, tautanBukti: e.target.value })} /><button className="btn utama">Lunas</button></form>}
        {t.status === 'DRAFT' && <div className="redup kecil" style={{ marginTop: 8 }}>Lunas akan menandai semua order di tagihan ini sebagai Lunas di Produksi.</div>}
      </div>
    </div>
  )
}

export default function Tagihan({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [lihat, setLihat] = useState('daftar'), [id, setId] = useState(null), [status, setStatus] = useState(''), [penerbit, setPenerbit] = useState(false)
  const muat = useCallback(() => api(`/api/circle/tagihan?studioId=${studioId}${status ? `&status=${status}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, status])
  useEffect(() => { muat() }, [muat])
  if (lihat === 'baru') return <Baru studioId={studioId} onBatal={() => setLihat('daftar')} onSelesai={(i) => { setId(i); setLihat('detail') }} />
  if (lihat === 'detail') return <Detail key={id} id={id} onTutup={() => { setLihat('daftar'); muat() }} />
  const r = d?.ringkasan ?? {}
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      {penerbit && <Penerbit studioId={studioId} onTutup={() => setPenerbit(false)} />}
      <div className="toolbar"><button className="btn utama" onClick={() => setLihat('baru')}>+ Tagihan baru</button><button className="btn" onClick={() => setPenerbit(v => !v)}>Penerbit invoice</button>
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option>{['DRAFT', 'DITAGIH', 'LUNAS', 'BATAL'].map(s => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select>{d && <TombolUnduh nama={'tagihan-komunitas'} baris={[['Nomor', 'Klien', 'Status', 'Total', 'Ditagih', 'Lunas'], ...d.tagihan.map(t => [t.nomor, t.klien, t.labelStatus, t.total, t.ditagihPada ? t.ditagihPada.slice(0, 10) : '', t.lunasPada ? t.lunasPada.slice(0, 10) : ''])]} cetak />}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="stat"><span className="redup kecil">Belum dibayar (ditagih)</span><b>{rp(r.DITAGIH?.total ?? 0)}</b></div>
        <div className="stat"><span className="redup kecil">Draft</span><b>{rp(r.DRAFT?.total ?? 0)}</b></div>
        <div className="stat"><span className="redup kecil">Lunas</span><b>{rp(r.LUNAS?.total ?? 0)}</b></div></div>
      {!d ? <div className="redup">Memuat…</div> : d.tagihan.length === 0 ? <div className="kosong">Belum ada tagihan.</div> : (
        <div className="panel"><table><thead><tr><th>Nomor</th><th>Klien</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th>Ditagih</th></tr></thead><tbody>
          {d.tagihan.map(t => <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => { setId(t.id); setLihat('detail') }}><td>{t.nomor}</td><td>{t.klien}</td><td><span className={'lencana ' + WARNA[t.status]}>{t.labelStatus}</span></td><td style={{ textAlign: 'right' }}>{rp(t.total)}</td><td>{tg(t.ditagihPada)}</td></tr>)}
        </tbody></table></div>)}
    </div>
  )
}
