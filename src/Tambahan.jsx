import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { InputRupiah } from './Pilihan'
import { useSegarkan } from './realtime'
import TombolUnduh from './TombolUnduh'
import { unduhCsv } from './api-util'
import DetailOrder from './DetailOrder'

// Timeline order, Jenis order, Setoran marketer, Laporan harian marketer (adaptasi OGS).
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const tg = (t) => (t ? new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—')
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const BADGE = { belum_start: ['Belum mulai', ''], sedang_jalan: ['Berjalan', ''], terlambat: ['Terlambat', 'revisi'], on_track: ['Selesai', 'jenis-SELESAI'] }

export function Timeline({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [status, setStatus] = useState('aktif'), [q, setQ] = useState('')
  const muat = useCallback(() => api(`/api/circle/analitik/timeline?studioId=${studioId}&status=${status}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, status, q])
  useEffect(() => { const t = setTimeout(muat, q ? 300 : 0); return () => clearTimeout(t) }, [muat, q])
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar"><select value={status} onChange={e => setStatus(e.target.value)}><option value="aktif">Aktif</option><option value="selesai">Selesai (30 hari)</option><option value="semua">Semua</option></select><input placeholder="Cari judul / klien…" value={q} onChange={e => setQ(e.target.value)} />{d && <TombolUnduh nama={'timeline-order'} baris={[['Order', 'Klien', 'Tahap', 'Mulai', 'Deadline', 'Sisa hari', 'Plan (hari)', 'Aktual (hari)', 'Penanggung'], ...d.baris.map(b => [b.judul, b.klien, b.tahap ?? '', b.mulai, b.deadline ?? '', b.sisaHari ?? '', b.hariPlan, b.hariAktual, b.penanggung.join(', ')])]} cetak />}</div>
      {d && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['Terlambat', d.kpi.terlambat], ['Jatuh tempo ≤ 3 hari', d.kpi.segera], ['Tanpa penanggung', d.kpi.tanpaPenanggung], ['Perlu update deadline', d.kpi.perluUpdateDeadline], ['Belum lunas', d.kpi.belumLunas]].map(([l, n]) => <div key={l} className="stat"><span className="redup kecil">{l}</span><b>{n}</b></div>)}</div>}
      {!d ? <div className="redup">Memuat…</div> : d.baris.length === 0 ? <div className="kosong">Tidak ada order.</div> : (
        <div className="panel" style={{ overflowX: 'auto' }}><table><thead><tr><th>Order</th><th>Tahap</th><th>Mulai → Deadline</th><th>Sisa</th><th>Plan / aktual</th><th>Penanggung</th></tr></thead><tbody>
          {d.baris.map(b => <tr key={b.id}><td><b>{b.judul}</b><div className="redup kecil">{b.klien}{b.belumLunas ? ' · belum lunas' : ''}</div></td>
            <td><span className={'lencana ' + BADGE[b.badge][1]}>{BADGE[b.badge][0]}</span><div className="redup kecil">{b.tahap ?? '—'}</div>{b.perluUpdateDeadline && <div className="kecil" style={{ color: 'var(--red)' }}>update deadline</div>}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{tg(b.mulai)} → {tg(b.deadline)}</td>
            <td style={{ color: b.sisaHari != null && b.sisaHari < 0 && !b.selesai ? 'var(--red)' : undefined, whiteSpace: 'nowrap' }}>{b.selesai ? '—' : b.sisaHari == null ? 'tanpa deadline' : b.sisaHari < 0 ? `telat ${-b.sisaHari} hari` : `${b.sisaHari} hari`}</td>
            <td style={{ minWidth: 110 }}><div className="redup kecil">{b.hariPlan ? `${b.hariPlan} hr plan` : 'plan —'} · {b.hariAktual} hr</div><div className="bar" style={{ height: 6, borderRadius: 3, background: 'var(--track)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${b.persenAktual}%`, background: b.badge === 'terlambat' ? 'var(--red)' : 'var(--accent)' }} /></div></td>
            <td>{b.penanggung.length ? b.penanggung.join(', ') : <span className="redup">—</span>}</td></tr>)}
        </tbody></table></div>)}
    </div>
  )
}

export function JenisOrder({ studioId }) {
  const [view, setView] = useState('minggu'), [tanggal, setTanggal] = useState(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/analitik/jenis-order?studioId=${studioId}&view=${view}&tanggal=${tanggal}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, view, tanggal])
  const geser = (n) => { const t = new Date(tanggal + 'T00:00:00Z'); if (view === 'bulan') t.setUTCMonth(t.getUTCMonth() + n); else t.setUTCDate(t.getUTCDate() + 7 * n); setTanggal(t.toISOString().slice(0, 10)) }
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar"><button className="btn kecil" onClick={() => geser(-1)}>←</button><b>{d ? `${tg(d.dari)} – ${tg(d.sampai)}` : '…'}</b><button className="btn kecil" onClick={() => geser(1)}>→</button>
        <select value={view} onChange={e => setView(e.target.value)}><option value="minggu">Per minggu</option><option value="bulan">Per bulan</option></select>
        {d && <TombolUnduh nama={`jenis-order-${d.dari}`} baris={[['Akun', 'Platform', ...d.kategori, 'Total'], ...d.akun.map(a => [a.namaAkun, a.platform, ...d.kategori.map(k => a.perKategori[k] ?? 0), a.total]), ['Total', '', ...d.kategori.map(k => d.totalKategori[k] ?? 0), d.total]]} cetak />}</div>
      {!d ? <div className="redup">Memuat…</div> : d.total === 0 ? <div className="kosong">Tidak ada order masuk pada periode ini.</div> : (
        <div className="panel" style={{ overflowX: 'auto' }}><table><thead><tr><th>Akun</th>{d.kategori.map(k => <th key={k} style={{ textAlign: 'right' }}>{k}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead><tbody>
          {d.akun.map(a => <tr key={a.akunId}><td>{a.namaAkun}<span className="redup kecil"> · {a.platform}</span></td>{d.kategori.map(k => <td key={k} style={{ textAlign: 'right' }}>{a.perKategori[k] ?? <span className="redup">·</span>}</td>)}<td style={{ textAlign: 'right' }}><b>{a.total}</b></td></tr>)}
          <tr style={{ fontWeight: 700 }}><td>Total</td>{d.kategori.map(k => <td key={k} style={{ textAlign: 'right' }}>{d.totalKategori[k] ?? 0}</td>)}<td style={{ textAlign: 'right' }}>{d.total}</td></tr>
        </tbody></table></div>)}
    </div>
  )
}

function LaporanHarian({ studioId }) {
  const [tanggal, setTanggal] = useState(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)), [d, setD] = useState(null), [galat, setGalat] = useState(''), [salin, setSalin] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/marketing/laporan-harian?studioId=${studioId}&tanggal=${tanggal}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, tanggal])
  return (
    <div className="panel"><h3 className="judul-bagian">Laporan harian marketer</h3>
      {galat && <div className="galat">{galat}</div>}
      <div className="chips"><input type="date" value={tanggal} onChange={e => e.target.value && setTanggal(e.target.value)} />
        <button className="btn kecil" disabled={!d} onClick={async () => { try { await navigator.clipboard.writeText(d.teks); setSalin('Tersalin ✓') } catch { setSalin('Gagal menyalin — blok teks lalu salin manual') } setTimeout(() => setSalin(''), 2500) }}>Salin teks</button>{salin && <span className="redup kecil">{salin}</span>}</div>
      {d && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 10, fontFamily: 'inherit', fontSize: 13 }}>{d.teks}</pre>}
    </div>
  )
}

export function Setoran({ studioId }) {
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [bulan, setBulan] = useState(hariIni.slice(0, 7)), [buka, setBuka] = useState(false)
  const [f, setF] = useState({ tanggal: hariIni, jumlah: '', catatan: '', transferId: '', marketerId: '' })
  const muat = useCallback(() => api(`/api/circle/setoran?studioId=${studioId}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const angka = String(f.jumlah).replace(/\D/g, '')
  const simpan = (e) => { e.preventDefault(); aksi(async () => {
    await api('/api/circle/setoran', { method: 'POST', body: { studioId, tanggal: f.tanggal, jumlah: angka === '' ? undefined : Number(angka), catatan: f.catatan || undefined, transferId: f.transferId || undefined, marketerId: f.marketerId || undefined } })
    setBuka(false); setF({ tanggal: hariIni, jumlah: '', catatan: '', transferId: '', marketerId: '' }) }, setGalat, muat) }
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="panel" style={{ marginBottom: 10 }}>
        <h3 className="judul-bagian">Setoran pemasukan ke kas studio</h3>
        <p className="kecil" style={{ marginBottom: 6 }}><b>Setor</b> = menyerahkan uang hasil penjualan dari akun jualan yang kamu pegang ke <b>kas studio</b> (rekening studio). Catat <b>setiap kali kamu menyetor — kapan saja</b>, tidak terikat tanggal tertentu.</p>
        <div className="redup kecil">Isi tanggal setor, jumlah (boleh dikosongkan), dan catatan. Koordinator melihat siapa saja yang sudah setor dan kapan terakhir kali. Tidak ada checklist "belum setor" otomatis.</div>
        {d.bisaCatat && <div style={{ marginTop: 8 }}><button className="btn utama" onClick={() => setBuka(v => !v)}>{buka ? 'Tutup' : '+ Catat setoran'}</button></div>}
      </div>
      {buka && <form className="panel" style={{ marginBottom: 10 }} onSubmit={simpan}>
        <div className="dua">
          {d.bisaKelola && d.marketer.length > 0 && <label>Marketer<select value={f.marketerId} onChange={e => setF({ ...f, marketerId: e.target.value })}><option value="">— aku sendiri —</option>{d.marketer.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></label>}
          <label>Tanggal setor<input type="date" max={hariIni} value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
          <div className="isian">Jumlah disetor (Rp, opsional)<InputRupiah value={f.jumlah} onChange={v => setF({ ...f, jumlah: v })} placeholder="mis. 1500000" /></div>
          <label>Catatan (opsional)<input value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} maxLength={500} placeholder="mis. hasil WD Etsy minggu ini" /></label>
        </div>
        {d.transfer.length > 0 && <label>Tautkan transfer yang sudah tercatat (opsional)<select value={f.transferId} onChange={e => setF({ ...f, transferId: e.target.value })}><option value="">— tanpa tautan —</option>{d.transfer.map(t => <option key={t.id} value={t.id}>{tg(t.tanggal)} · {rp(t.jumlah)}</option>)}</select></label>}
        <div className="modal-aksi"><button type="button" className="btn" onClick={() => setBuka(false)}>Batal</button><button className="btn utama">Simpan setoran</button></div>
      </form>}
      <div className="chips" style={{ margin: '8px 0' }}><span className="redup kecil">Bulan</span><input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} /></div>
      <div className="panel" style={{ marginBottom: 10, overflowX: 'auto' }}>
        <h3 className="judul-bagian">Ringkasan per marketer</h3>
        {d.ringkasan.length === 0 ? <div className="kosong">Belum ada marketer di unit ini.</div> : <table><thead><tr><th>Marketer</th><th className="kanan">Setoran bulan ini</th><th className="kanan">Total disetor</th><th>Terakhir setor</th></tr></thead>
          <tbody>{d.ringkasan.map(r => <tr key={r.marketerId}><td><b>{r.marketer}</b>{r.milikSaya ? <span className="lencana"> kamu</span> : ''}</td><td className="kanan">{r.kali}×</td><td className="kanan">{r.total ? rp(r.total) : '—'}</td>
            <td>{r.terakhir ? <>{tg(r.terakhir)} <span className="redup kecil">· {r.hariLalu === 0 ? 'hari ini' : `${r.hariLalu} hari lalu`}</span></> : <span className="redup">belum pernah</span>}</td></tr>)}</tbody></table>}
      </div>
      <div className="panel" style={{ marginBottom: 10, overflowX: 'auto' }}>
        <h3 className="judul-bagian">Catatan setoran {bulan}</h3>
        {d.baris.length === 0 ? <div className="kosong">Belum ada setoran dicatat bulan ini.</div> : <table><thead><tr><th>Tanggal</th><th>Marketer</th><th className="kanan">Jumlah</th><th>Catatan</th><th /></tr></thead>
          <tbody>{d.baris.map(b => <tr key={b.id}><td>{tg(b.tanggal)}</td><td>{b.marketer}{b.dicatatOleh ? <span className="redup kecil"> · dicatat {b.dicatatOleh}</span> : ''}</td><td className="kanan">{b.jumlah != null ? rp(b.jumlah) : '—'}</td>
            <td className="redup">{b.catatan ?? ''}{b.transferId ? ' · transfer tertaut' : ''}</td>
            <td className="kanan">{(b.milikSaya || d.bisaKelola) && <button className="btn kecil" onClick={() => confirm('Hapus catatan setoran ini?') && aksi(() => api(`/api/circle/setoran/${b.id}`, { method: 'DELETE' }), setGalat, muat)}>hapus</button>}</td></tr>)}</tbody></table>}
      </div>
      <LaporanHarian studioId={studioId} />
    </div>
  )
}

// ── Pembayaran order (audit OGS #8): order belum lunas + sisa; marketer hanya miliknya ──
// Baris bisa diklik → detail order (isi/tandai termin langsung dari sini; permintaan tim 9 Nov 2026)
export function Pembayaran({ studioId }) {
  // Masukan tim (13 Nov 2026): hanya project yang sudah Delivery/Done (bisa dibuka semua), cari project/klien, status = sudah/belum dibuat tagihan
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [detailId, setDetailId] = useState(null), [semua, setSemua] = useState(false), [cari, setCari] = useState('')
  const muat = useCallback(() => api(`/api/circle/pembayaran?studioId=${studioId}${semua ? '&semua=1' : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, semua])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const kata = cari.trim().toLowerCase()
  const tampil = d.baris.filter(b => !kata || `${b.judul} ${b.klien}`.toLowerCase().includes(kata))
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="stat"><span className="redup kecil">Total sisa belum dibayar</span><b>{rp(d.totalSisa)}</b></div>
        {Object.entries(d.kelompok).sort().map(([k, v]) => <div key={k} className="stat"><span className="redup kecil">Umur {k} hari ({v.jumlah})</span><b>{rp(v.total)}</b></div>)}
        <TombolUnduh nama={'pembayaran-belum-lunas'} baris={[['Order', 'Klien', 'Marketer', 'Status tagihan', 'Deadline', 'Nilai bersih', 'Dibayar', 'Sisa', 'Umur (hari)'], ...tampil.map(b => [b.judul, b.klien, b.marketer ?? '', b.sudahDitagih ? 'Sudah ditagihkan' : 'Belum dibuat tagihan', b.deadline ?? '', b.nilaiBersih, b.dibayar, b.sisa, b.umurHari])]} cetak /></div>
      <div className="toolbar">
        <input className="cari" placeholder="Cari project atau nama klien…" value={cari} onChange={e => setCari(e.target.value)} />
        <label className="centang" style={{ margin: 0 }}><input type="checkbox" checked={semua} onChange={e => setSemua(e.target.checked)} /> Tampilkan juga yang masih dikerjakan{!semua && d.masihDikerjakan > 0 ? ` (${d.masihDikerjakan})` : ''}</label>
      </div>
      {galat && <div className="galat blok">{galat}</div>}
      {tampil.length === 0 ? <div className="kosong">{d.baris.length ? 'Tidak ada yang cocok.' : semua ? 'Tidak ada order yang belum lunas.' : 'Tidak ada project sudah Delivery yang belum dibayar.'}</div> : (
        <div className="panel" style={{ overflowX: 'auto' }}><div className="redup kecil" style={{ marginBottom: 8 }}>{d.catatan}{!d.bisaLihatSemua ? ' Kamu hanya melihat order yang kamu bawa sebagai marketer.' : ''}</div>
          <table><thead><tr><th>Order</th><th>Status</th><th>Deadline</th><th style={{ textAlign: 'right' }}>Nilai</th><th style={{ textAlign: 'right' }}>Dibayar</th><th style={{ textAlign: 'right' }}>Sisa</th><th>Umur</th></tr></thead><tbody>
            {tampil.map(b => <tr key={b.id} className="baris-klik" title="Klik untuk membuka order & mengisi termin" onClick={() => setDetailId(b.id)}><td><b>{b.judul}</b><div className="redup kecil">{b.klien}{b.marketer ? ` · ${b.marketer}` : ''}</div>{b.termin.length > 0 && <div className="redup kecil">{b.termin.map(t => `${t.label} ${rp(t.jumlah)}${t.dibayarPada ? ' ✓' : t.jatuhTempo ? ` (jt ${tg(t.jatuhTempo)})` : ''}`).join(' · ')}</div>}</td>
              <td><span className={'lencana' + (b.sudahDitagih ? '' : ' nada-warn')} title={b.sudahDitagih ? `Invoice terbit ${rp(b.ditagih)}` : 'Belum ada invoice terbit untuk order ini'}>{b.sudahDitagih ? 'Sudah ditagihkan' : 'Belum dibuat tagihan'}</span>{semua && !b.sudahDelivery && <div className="redup kecil">masih dikerjakan{b.tahap ? ` · ${b.tahap}` : ''}</div>}</td><td>{tg(b.deadline)}</td><td style={{ textAlign: 'right' }}>{rp(b.nilaiBersih)}</td><td style={{ textAlign: 'right' }}>{rp(b.dibayar)}</td><td style={{ textAlign: 'right' }}><b>{rp(b.sisa)}</b></td><td>{b.umurHari} hr</td></tr>)}</tbody></table></div>)}
      {detailId && <DetailOrder orderId={detailId} onTutup={() => { setDetailId(null); muat() }} />}
    </div>
  )
}

// ── Pipeline (audit OGS #11) ──
export function Pipeline({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/pipeline?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const maks = Math.max(1, ...d.tahap.map(t => t.jumlah))
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}><div className="stat"><span className="redup kecil">Order aktif</span><b>{d.total.jumlah}</b></div><div className="stat"><span className="redup kecil">Nilai kotor aktif</span><b>{rp(d.total.nilaiKotor)}</b></div><div className="stat"><span className="redup kecil">Nilai bersih aktif</span><b>{rp(d.total.nilaiBersih)}</b></div></div>
      <div className="panel">{d.tahap.map(t => <div key={t.tahapId ?? 'x'} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 150px', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <span>{t.nama}</span><div className="gf-trek"><i style={{ width: `${(t.jumlah / maks) * 100}%`, background: 'var(--seri-1)' }} /></div><span className="redup kecil">{t.jumlah} order · {rp(t.nilaiBersih)}</span></div>)}</div>
    </div>
  )
}

// ── Riwayat login (audit OGS #12; Kepala Circle ke atas) ──
export function RiwayatLogin() {
  const [bulan, setBulan] = useState(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)), [userId, setUserId] = useState(''), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/riwayat-login?bulan=${bulan}${userId ? `&userId=${userId}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [bulan, userId])
  if (galat) return <div className="galat blok">{galat}</div>
  return (
    <div>
      <div className="toolbar"><input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} /><select value={userId} onChange={e => setUserId(e.target.value)}><option value="">Semua orang</option>{d?.orang.map(o => <option key={o.userId} value={o.userId}>{o.nama} ({o.jumlah})</option>)}</select>
        {d && <TombolUnduh nama={`login-${bulan}`} baris={[['Nama', 'Web', 'IP', 'Perangkat', 'Waktu'], ...d.baris.map(b => [b.nama, b.web, b.ip ?? '', b.perangkat ?? '', new Date(b.waktu).toLocaleString('id-ID')])]} cetak />}</div>
      {!d ? <div className="redup">Memuat…</div> : (<>
        {!userId && <div className="panel"><h3 className="judul-bagian">Ringkasan {bulan}</h3>{d.orang.map(o => <div key={o.userId} className="meta" style={{ marginBottom: 3 }}><b>{o.nama}</b><span className="lencana">{o.jumlah}× login</span><span className="redup kecil">{o.terakhir ? `terakhir ${new Date(o.terakhir).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'tidak ada login'}</span></div>)}</div>}
        <div className="panel"><h3 className="judul-bagian">Catatan (200 terbaru)</h3>{d.baris.length === 0 ? <div className="redup kecil">Tidak ada.</div> : <table><tbody>{d.baris.map(b => <tr key={b.id}><td>{b.nama}</td><td>{new Date(b.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td>{b.web}</td><td className="redup kecil">{b.ip ?? '—'}</td><td className="redup kecil">{(b.perangkat ?? '').slice(0, 40)}</td></tr>)}</tbody></table>}</div>
      </>)}
    </div>
  )
}

// ── Pratinjau pengingat Telegram (audit OGS #10) ──
export function Pengingat({ studioId }) {
  const [daftar, setDaftar] = useState(null), [jenis, setJenis] = useState(''), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { api(`/api/circle/pengingat/pratinjau?studioId=${studioId}`).then(setDaftar).catch(e => setGalat(e.message)) }, [studioId])
  useEffect(() => { setD(null); if (jenis) api(`/api/circle/pengingat/pratinjau?studioId=${studioId}&jenis=${jenis}`).then(setD).catch(e => setGalat(e.message)) }, [studioId, jenis])
  if (!daftar) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Pengingat Telegram {daftar.aktif ? <b>AKTIF</b> : <b>belum dinyalakan</b>}{daftar.aktif ? '' : ' (butuh OTOMASI_AKTIF=1 di server). Di sini hanya pratinjau isi pesan; tidak ada yang terkirim.'} Hanya terkirim ke orang yang sudah menautkan Telegram.</div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar"><select value={jenis} onChange={e => setJenis(e.target.value)}><option value="">— pilih jenis pengingat —</option>{Object.entries(daftar.jenis).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      {jenis && !d ? <div className="redup">Memuat…</div> : d && (d.penerima.length === 0 ? <div className="kosong">Tidak ada pesan untuk jenis ini saat ini.</div> : d.penerima.map((p, i) => <div key={i} className="panel"><div className="meta"><b>{p.nama}</b><span className={'lencana' + (p.punyaTelegram ? '' : ' revisi')}>{p.punyaTelegram ? 'Telegram tertaut' : 'belum menautkan Telegram'}</span></div><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: '6px 0 0' }}>{p.teks}</pre></div>))}
    </div>
  )
}

// ── Peta alur: tiap tahap → siapa memegang kartu apa (audit OGS Workflow Map) ──
export function PetaAlur({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/peta-alur?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders', 'penugasan', 'tugas'])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      <div className="redup kecil" style={{ marginBottom: 8 }}>{d.jumlahOrderAktif} order aktif. Jam di kartu = lama dipegang (jam kerja bersih).</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {d.kolom.map(k => (
          <div key={k.tahapId} className="panel" style={{ margin: 0 }}>
            <div className="meta"><b>{k.nama}</b><span className="lencana">{k.jumlahOrder} order</span></div>
            {k.orang.map(o => <div key={o.userId} style={{ marginTop: 8 }}><div className="kecil"><b>{o.nama}</b> <span className="redup">· {o.kartu.length} kartu</span></div>
              {o.kartu.map(c => <div key={c.penugasanId} className="redup kecil" style={{ marginLeft: 8 }}>{c.mendesak ? '🔥 ' : ''}{c.judul} <span>· {c.progres}% · {c.jam} jam</span></div>)}</div>)}
            {k.tanpaPemegang.length > 0 && <div style={{ marginTop: 8 }}><div className="kecil" style={{ color: 'var(--red)' }}>Belum ada pemegang ({k.tanpaPemegang.length})</div>{k.tanpaPemegang.slice(0, 6).map(c => <div key={c.orderId} className="redup kecil" style={{ marginLeft: 8 }}>{c.judul}</div>)}</div>}
            {!k.orang.length && !k.tanpaPemegang.length && <div className="redup kecil" style={{ marginTop: 6 }}>Kosong</div>}
          </div>))}
      </div>
    </div>
  )
}

// ── Rekap kerja per orang per bulan (audit OGS Worker Month Work Log) ──
export function RekapKerja({ studioId, manajer }) {
  const [bulan, setBulan] = useState(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)), [userId, setUserId] = useState(''), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/rekap-kerja?studioId=${studioId}&bulan=${bulan}${userId ? `&userId=${userId}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, bulan, userId])
  return (
    <div>
      <div className="toolbar"><input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} />
        {manajer && d && <select value={userId || d.userId} onChange={e => setUserId(e.target.value)}>{d.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>}
        {d && <TombolUnduh nama={`rekap-kerja-${d.nama}-${bulan}`} baris={[['Order', 'Klien', 'Tahap', 'Status', 'Jam kerja bersih'], ...d.rows.map(r => [r.judul, r.klien, r.tahap, r.status, r.jam])]} cetak />}</div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : (<>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}><div className="stat"><span className="redup kecil">{d.nama}</span><b>{d.total.kartu} kartu</b></div><div className="stat"><span className="redup kecil">Selesai bulan ini</span><b>{d.total.selesai}</b></div><div className="stat"><span className="redup kecil">Total jam pekerjaan dipegang</span><b>{d.total.jam}</b></div><div className="stat"><span className="redup kecil">Rata-rata per tugas</span><b>{d.total.rataJam} jam</b></div></div>
        {d.rows.length === 0 ? <div className="kosong">Tidak ada kartu yang dipegang pada bulan ini.</div> : <div className="panel"><table><thead><tr><th>Order</th><th>Tahap</th><th>Status</th><th style={{ textAlign: 'right' }}>Jam</th></tr></thead><tbody>
          {d.rows.map(r => <tr key={r.id}><td><b>{r.judul}</b><div className="redup kecil">{r.klien}</div></td><td>{r.tahap}</td><td>{r.status === 'SELESAI' ? 'Selesai' : r.status === 'DIKERJAKAN' ? 'Dikerjakan' : 'Menunggu'}</td><td style={{ textAlign: 'right' }}><b>{r.jam}</b></td></tr>)}</tbody></table>
          <div className="redup kecil" style={{ marginTop: 6 }}>{d.catatan}</div></div>}
      </>)}
    </div>
  )
}

// ── Profil SDM saya + Manpower (audit OGS Sdm/EditProfile, Data/Manpower) ──
// Tautkan Telegram dari web circle (mekanisme kode sama dengan Profil Ekosistem): buat kode → kirim `/daftar KODE` ke bot lewat chat pribadi.
export function TelegramKartu() {
  const [st, setSt] = useState(null), [kode, setKode] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api('/api/circle/telegram').then(setSt).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  useEffect(() => { if (!kode || st?.tertaut) return; const t = setInterval(muat, 4000); return () => clearInterval(t) }, [kode, st?.tertaut, muat])
  if (!st) return galat ? <div className="galat">{galat}</div> : null
  return (
    <div className="panel"><h3 className="judul-bagian">Telegram {st.tertaut ? <span className="lencana jenis-SELESAI">tertaut</span> : <span className="lencana revisi">belum tertaut</span>}</h3>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Untuk menerima pengingat (rencana harian, delivery, setoran, presensi) dan memakai bot @{st.bot}.</div>
      {galat && <div className="galat">{galat}</div>}
      {st.tertaut ? <button className="btn kecil" onClick={() => confirm('Putuskan tautan Telegram?') && aksi(async () => { await api('/api/circle/telegram', { method: 'DELETE' }); setKode(null) }, setGalat, muat)}>Putuskan</button> : (<>
        {!kode ? <button className="btn utama" onClick={() => aksi(async () => setKode(await api('/api/circle/telegram/kode', { method: 'POST' })), setGalat)}>Buat kode tautan</button> : (
          <div><div>1. Buka Telegram, chat pribadi dengan <b>@{kode.bot}</b> (bukan di grup).</div><div>2. Kirim pesan ini dalam 10 menit:</div>
            <div style={{ margin: '8px 0' }}><code style={{ fontSize: 18, padding: '6px 10px', background: 'var(--hover-strong)', borderRadius: 6 }}>/daftar {kode.kode}</code> <button className="btn kecil" onClick={() => navigator.clipboard?.writeText(`/daftar ${kode.kode}`)}>Salin</button></div>
            <div className="redup kecil">Kode sekali pakai. Halaman ini otomatis berubah begitu tertaut.</div></div>)}</>)}
    </div>
  )
}
export function ProfilSaya() {
  const [d, setD] = useState(null), [f, setF] = useState({ posisiBerikut: '', catatan: '' }), [galat, setGalat] = useState(''), [info, setInfo] = useState('')
  useEffect(() => { api('/api/circle/profil-sdm').then(x => { setD(x); setF({ posisiBerikut: x.posisiBerikut ?? '', catatan: x.catatan ?? '' }) }).catch(e => setGalat(e.message)) }, [])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div><TelegramKartu />
    <form className="panel" onSubmit={e => { e.preventDefault(); aksi(async () => { await api('/api/circle/profil-sdm', { method: 'PUT', body: f }); setInfo('Tersimpan ✓') }, setGalat) }}>
      <h3 className="judul-bagian">Profil SDM saya</h3>
      {galat && <div className="galat">{galat}</div>}
      <div className="redup kecil" style={{ marginBottom: 8 }}>Posisi sekarang: <b>{d.posisiSekarang ?? 'belum ditetapkan koordinator'}</b>{d.posisiOtomatis && <span className="redup kecil"> · otomatis dari peran di Management Dashboard</span>}</div>
      <label>Posisi yang ingin kamu tuju<input value={f.posisiBerikut} onChange={e => { setF({ ...f, posisiBerikut: e.target.value }); setInfo('') }} maxLength={120} placeholder="mis. Senior Artist, Koordinator…" /></label>
      <label>Catatan pengembangan diri<textarea rows={3} value={f.catatan} onChange={e => { setF({ ...f, catatan: e.target.value }); setInfo('') }} maxLength={1000} /></label>
      <div className="chips"><button className="btn utama">Simpan</button>{info && <span className="redup kecil">{info}</span>}</div>
    </form></div>
  )
}
export function Manpower({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [edit, setEdit] = useState(null), [teks, setTeks] = useState('')
  const muat = useCallback(() => api(`/api/circle/manpower?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  if (!d) return galat ? <div className="galat">{galat}</div> : null
  return (
    <div className="panel" style={{ marginTop: 16, overflowX: 'auto' }}><h3 className="judul-bagian">Susunan tim · {d.jumlah} orang</h3>
      <div className="chips" style={{ marginBottom: 8 }}>{Object.entries(d.perFungsi).map(([k, n]) => <span key={k} className="lencana">{k}: {n}</span>)}
        <TombolUnduh nama="susunan-tim" baris={[['Nama', 'Peran', 'Fungsi', 'Posisi sekarang', 'Posisi berikutnya'], ...d.orang.map(o => [o.nama, o.peran.join(', '), o.pendamping ? 'Pendamping (tidak perlu fungsi)' : o.fungsi.map(f => f.fungsi + (f.bidang ? ` (${f.bidang})` : '')).join(', '), o.posisiSekarang ?? '', o.posisiBerikut ?? ''])]} /></div>
      {galat && <div className="galat">{galat}</div>}
      <table><thead><tr><th>Nama</th><th>Peran</th><th>Fungsi</th><th>Posisi sekarang</th><th>Ingin menuju</th></tr></thead><tbody>
        {d.orang.map(o => <tr key={o.userId}><td>{o.nama}</td><td className="redup kecil">{o.peran.join(', ')}</td><td className="redup kecil">{o.pendamping ? <span className="chip sub" title="Pendamping/Penasihat tidak memegang fungsi kerja harian — tidak perlu dikonfirmasi">Pendamping · tidak perlu fungsi</span> : o.fungsi.map(f => f.fungsi + (f.bidang ? ` · ${f.bidang}` : '')).join(', ') || '—'}</td>
          <td>{edit === o.userId ? <form className="chips" onSubmit={e => { e.preventDefault(); aksi(async () => { await api('/api/circle/profil-sdm', { method: 'PUT', body: { userId: o.userId, posisiSekarang: teks } }); setEdit(null) }, setGalat, muat) }}><input value={teks} onChange={e => setTeks(e.target.value)} maxLength={120} autoFocus /><button className="btn kecil utama">OK</button></form> : o.posisiOtomatis ? <span title="Otomatis dari peran Koordinator di Management Dashboard">{o.posisiSekarang} <span className="redup kecil">· otomatis</span></span> : <span style={{ cursor: 'pointer' }} title="Klik untuk mengubah" onClick={() => { setEdit(o.userId); setTeks(o.posisiSekarang ?? '') }}>{o.posisiSekarang ?? <span className="redup">— tetapkan</span>}</span>}</td>
          <td className="redup kecil">{o.posisiBerikut ?? '—'}</td></tr>)}</tbody></table></div>
  )
}

// ── Menyamar (Super Admin) ──
export function Menyamar({ onMulai }) {
  const [q, setQ] = useState(''), [daftar, setDaftar] = useState(null), [galat, setGalat] = useState(''), [pilih, setPilih] = useState(null), [alasan, setAlasan] = useState(''), [log, setLog] = useState([])
  useEffect(() => { const t = setTimeout(() => api(`/api/circle/impersonasi/kandidat?q=${encodeURIComponent(q)}`).then(setDaftar).catch(e => setGalat(e.message)), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { api('/api/circle/impersonasi/log').then(setLog).catch(() => {}) }, [])
  const mulai = () => aksi(async () => { const x = await api('/api/circle/impersonasi', { method: 'POST', body: { userId: pilih.userId, alasan } }); onMulai(x) }, setGalat)
  return (
    <div className="panel" style={{ marginTop: 16 }}><h3 className="judul-bagian">Masuk sebagai (Super Admin)</h3>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Untuk membantu/menguji tampilan orang lain. Alasan wajib, sesi 30 menit, tercatat di log. Aksi yang dilakukan saat menyamar tercatat atas nama orang yang ditiru — gunakan seperlunya.</div>
      {galat && <div className="galat">{galat}</div>}
      <input placeholder="Cari nama…" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ maxHeight: 180, overflowY: 'auto', margin: '6px 0' }}>{(daftar ?? []).map(u => <div key={u.userId} className="meta" style={{ marginBottom: 3 }}><button className={'btn kecil' + (pilih?.userId === u.userId ? ' utama' : '')} onClick={() => setPilih(u)}>{u.nama}</button><span className="redup kecil">{u.peran.slice(0, 2).join(' · ')}</span></div>)}</div>
      {pilih && <div className="chips"><input style={{ flex: 1 }} placeholder={`Alasan masuk sebagai ${pilih.nama}…`} value={alasan} onChange={e => setAlasan(e.target.value)} maxLength={200} /><button className="btn utama" disabled={!alasan.trim()} onClick={mulai}>Masuk sebagai {pilih.nama.split(' ')[0]}</button></div>}
      {log.length > 0 && <details style={{ marginTop: 8 }}><summary className="redup kecil">Log terakhir ({log.length})</summary>{log.slice(0, 10).map(l => <div key={l.id} className="redup kecil">{new Date(l.waktu).toLocaleString('id-ID')} · {l.admin} → {l.target} · {l.alasan}</div>)}</details>}
    </div>
  )
}
