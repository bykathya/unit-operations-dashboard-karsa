import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'
import { unduhCsv } from './api-util'
import DetailOrder from './DetailOrder'
import { LabelKhusus } from './KolomKhusus'
import { tanggalPendek } from './format'

// LAPORAN TIM (adaptasi OGS): Task selesai (+batalkan), Progres harian, Kontribusi nilai per orang (uang → Koordinator ke atas), Beban kerja.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const hariIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
const geserHari = (t, n) => new Date(new Date(t + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)
const jamTgl = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function Rentang({ dari, sampai, setDari, setSampai }) {
  return <div className="toolbar"><input type="date" value={dari} onChange={e => e.target.value && setDari(e.target.value)} /><span className="redup kecil">s/d</span><input type="date" value={sampai} onChange={e => e.target.value && setSampai(e.target.value)} />
    <button className="btn kecil" onClick={() => { setDari(hariIni()); setSampai(hariIni()) }}>Hari ini</button><button className="btn kecil" onClick={() => { setDari(geserHari(hariIni(), -6)); setSampai(hariIni()) }}>7 hari</button></div>
}

// ORDER SELESAI BULAN INI milikku (20 Nov 2026, masukan tim; dulu di Tugas saya): order yang ia kerjakan dan sudah Done bulan ini —
// sumber sama dengan Tugas saya (GET /tugas-saya, jenis SELESAI). Beda dengan "Tugas produksi selesai" (tahap yang diselesaikan per tanggal).
function OrderSelesaiSaya({ studioId }) {
  const [daftar, setDaftar] = useState(null), [detailId, setDetailId] = useState(null)
  useEffect(() => { api(`/api/circle/tugas-saya?studioId=${studioId}`).then(x => setDaftar(x.tugas.filter(t => t.jenis === 'SELESAI'))).catch(() => setDaftar([])) }, [studioId])
  if (!daftar?.length) return null
  return (
    <div className="panel"><h3 className="judul-bagian">Order selesai bulan ini — milikku (Done, {daftar.length})</h3>
      {daftar.map(t => (
        <div key={t.id} className="tugas" style={{ cursor: 'pointer' }} title="Klik untuk membuka detail order" onClick={e => { if (!e.target.closest('a,button')) setDetailId(t.id) }}>
          <div><strong>{t.judul}</strong><div className="redup kecil">{t.klien}</div></div>
          <div className="tugas-kanan">
            <LabelKhusus daftar={t.khusus} />
            {t.folder && <a className="btn kecil" href={t.folder} target="_blank" rel="noreferrer noopener" title="Buka folder proyek (Google Drive)">📁 Folder</a>}
            <span className="tahap-lencana jenis-SELESAI">{t.tahap}</span>
            <span className="tgl">⏱ {tanggalPendek(t.deadline)}</span>
          </div>
        </div>))}
      {detailId && <DetailOrder orderId={detailId} onTutup={() => setDetailId(null)} />}
    </div>
  )
}

function TaskSelesai({ studioId }) {
  const [dari, setDari] = useState(hariIni()), [sampai, setSampai] = useState(hariIni()), [d, setD] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/tugas-selesai?studioId=${studioId}&dari=${dari}&sampai=${sampai}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, dari, sampai])
  useEffect(() => { muat() }, [muat])
  return (
    <div>
      <Rentang {...{ dari, sampai, setDari, setSampai }} />
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : (<>
        <div className="panel"><h3 className="judul-bagian">Tugas produksi selesai ({d.tugas.length})</h3>
          {d.tugas.length === 0 ? <div className="redup kecil">Tidak ada.</div> : <table><thead><tr><th>Order</th><th>Tahap</th><th>Pekerja</th><th>Selesai</th><th /></tr></thead><tbody>
            {d.tugas.map(t => <tr key={t.id}><td><b>{t.judul}</b><div className="redup kecil">{t.klien}</div></td><td>{t.tahap}</td><td>{t.pekerja}</td><td>{jamTgl(t.selesaiPada)}</td>
              <td>{t.bisaDibatalkan && <button className="btn kecil" onClick={() => confirm('Batalkan selesai? Tugas kembali ke antrean pekerja.') && aksi(() => api(`/api/circle/penugasan/${t.id}/batal-selesai`, { method: 'POST' }), setGalat, muat)}>Batalkan</button>}</td></tr>)}</tbody></table>}
        </div>
        <OrderSelesaiSaya studioId={studioId} />
        {d.marketer.length > 0 && <div className="panel"><h3 className="judul-bagian">Aktivitas marketer selesai ({d.marketer.length})</h3>
          {d.marketer.map(a => <div key={a.id} className="meta" style={{ marginBottom: 4 }}><b>{a.pekerja}</b><span>{a.judul || a.jenis} {a.jumlah > 1 ? `×${a.jumlah}` : ''}</span><span className="redup kecil">{jamTgl(a.selesaiPada)}</span></div>)}</div>}
      </>)}
    </div>
  )
}

function Progres({ studioId }) {
  const [dari, setDari] = useState(geserHari(hariIni(), -6)), [sampai, setSampai] = useState(hariIni()), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/progres-harian?studioId=${studioId}&dari=${dari}&sampai=${sampai}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, dari, sampai])
  return (
    <div>
      <Rentang {...{ dari, sampai, setDari, setSampai }} />
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : d.hari.map(h => (
        <div className="panel" key={h.tanggal}>
          <div className="meta"><b>{new Date(h.tanggal + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</b><span className="lencana">{h.selesai}/{h.total} selesai · {h.persen}%</span><span className="redup kecil">carry-over {h.selesaiCarry}/{h.totalCarry} · baru {h.selesaiBaru}/{h.totalBaru}</span></div>
          <div className="gf-trek" style={{ margin: '6px 0' }}><i style={{ width: `${h.persen}%`, background: 'var(--seri-1)' }} /></div>
          {h.perPekerja.map(w => <div key={w.userId} className="redup kecil">{w.nama}: {w.selesai}/{w.total} ({w.persen}%) · carry-over {w.selesaiCarry}/{w.totalCarry} · baru {w.selesaiBaru}/{w.totalBaru}</div>)}
        </div>))}
    </div>
  )
}

function Kontribusi({ studioId }) {
  const [tahun, setTahun] = useState(new Date().getFullYear()), [bulan, setBulan] = useState(0), [d, setD] = useState(null), [galat, setGalat] = useState(''), [rinci, setRinci] = useState(null)
  useEffect(() => { setD(null); setRinci(null); api(`/api/circle/kontribusi?studioId=${studioId}&tahun=${tahun}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, tahun, bulan])
  const buka = (userId, scope) => api(`/api/circle/kontribusi/detail?studioId=${studioId}&userId=${userId}&tahun=${tahun}&bulan=${bulan}&scope=${scope}`).then(x => setRinci({ ...x, userId, nama: d.orang.find(o => o.userId === userId)?.nama })).catch(e => setGalat(e.message))
  return (
    <div>
      <div className="toolbar"><select value={tahun} onChange={e => setTahun(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}</select>
        <select value={bulan} onChange={e => setBulan(Number(e.target.value))}><option value={0}>Seluruh tahun</option>{NAMA_BLN.map((b, i) => <option key={b} value={i + 1}>s/d {b}</option>)}</select>
        {d && <TombolUnduh nama={`kontribusi-${tahun}`} baris={[['Nama', 'Tahap (bulan)', 'Nilai (bulan)', 'Tahap (kumulatif)', 'Order (kumulatif)', 'Nilai (kumulatif)'], ...d.orang.map(o => [o.nama, o.bulan.tahap, o.bulan.nilai, o.kumulatif.tahap, o.kumulatif.order, o.kumulatif.nilai])]} cetak />}</div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : d.orang.length === 0 ? <div className="kosong">Belum ada tahap selesai pada periode ini.</div> : (
        <div className="panel"><div className="redup kecil" style={{ marginBottom: 8 }}>{d.catatan} Hanya terlihat oleh Koordinator ke atas.</div>
          <table><thead><tr><th>Nama</th>{bulan ? <th style={{ textAlign: 'right' }}>Bulan {NAMA_BLN[bulan - 1]}</th> : null}<th style={{ textAlign: 'right' }}>Kumulatif</th><th style={{ textAlign: 'right' }}>Tahap</th><th style={{ textAlign: 'right' }}>Order</th></tr></thead><tbody>
            {d.orang.map(o => <tr key={o.userId}><td><button className="btn kecil" onClick={() => buka(o.userId, 'kumulatif')}>{o.nama}</button></td>{bulan ? <td style={{ textAlign: 'right' }}>{rp(o.bulan.nilai)}</td> : null}<td style={{ textAlign: 'right' }}><b>{rp(o.kumulatif.nilai)}</b></td><td style={{ textAlign: 'right' }}>{o.kumulatif.tahap}</td><td style={{ textAlign: 'right' }}>{o.kumulatif.order}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td>Total</td>{bulan ? <td style={{ textAlign: 'right' }}>{rp(d.total.bulan.nilai)}</td> : null}<td style={{ textAlign: 'right' }}>{rp(d.total.kumulatif.nilai)}</td><td style={{ textAlign: 'right' }}>{d.total.kumulatif.tahap}</td><td /></tr></tbody></table></div>)}
      {rinci && <div className="panel"><h3 className="judul-bagian">Rincian {rinci.nama} · {rinci.scope === 'bulan' ? 'bulan terpilih' : 'kumulatif'} · {rp(rinci.total)}</h3>
        {bulan > 0 && <div className="chips" style={{ marginBottom: 6 }}><button className="btn kecil" onClick={() => buka(rinci.userId, 'bulan')}>Bulan itu saja</button><button className="btn kecil" onClick={() => buka(rinci.userId, 'kumulatif')}>Kumulatif</button></div>}
        <table><tbody>{rinci.baris.map(b => <tr key={b.id}><td><b>{b.judul}</b><div className="redup kecil">{b.klien}</div></td><td>{b.tahap}</td><td>{jamTgl(b.selesaiPada)}</td><td style={{ textAlign: 'right' }}>{rp(b.porsi)}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

function Beban({ studioId }) {
  const [tahun, setTahun] = useState(new Date().getFullYear()), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/beban-kerja?studioId=${studioId}&tahun=${tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, tahun])
  return (
    <div>
      <div className="toolbar"><select value={tahun} onChange={e => setTahun(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}</select>
        {d && <TombolUnduh nama={`beban-kerja-${tahun}`} baris={[['Nama', ...NAMA_BLN, 'Total', 'Pindah tahap', 'Tahap selesai', 'Catatan'], ...d.orang.map(o => [o.nama, ...o.bulan, o.total, o.pindahTahap, o.tahapSelesai, o.catatan])]} cetak />}</div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : d.orang.length === 0 ? <div className="kosong">Belum ada aksi tercatat tahun ini.</div> : (
        <div className="panel" style={{ overflowX: 'auto' }}><div className="redup kecil" style={{ marginBottom: 8 }}>{d.catatan}</div>
          <table><thead><tr><th>Nama</th>{NAMA_BLN.map(b => <th key={b} style={{ textAlign: 'right' }}>{b}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead><tbody>
            {d.orang.map(o => <tr key={o.userId}><td>{o.nama}<div className="redup kecil">{o.pindahTahap} pindah · {o.tahapSelesai} selesai · {o.catatan} catatan</div></td>{o.bulan.map((n, i) => <td key={i} style={{ textAlign: 'right' }}>{n || <span className="redup">·</span>}</td>)}<td style={{ textAlign: 'right' }}><b>{o.total}</b></td></tr>)}</tbody></table></div>)}
    </div>
  )
}

export default function Laporan({ studioId, manajer }) {
  const TAB = manajer ? [['selesai', 'Tugas selesai'], ['progres', 'Progres harian'], ['kontribusi', 'Kontribusi'], ['beban', 'Beban kerja']] : [['selesai', 'Tugas selesai']]
  const [sub, setSub] = useState('selesai')
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'selesai' && <TaskSelesai studioId={studioId} />}
      {sub === 'progres' && <Progres studioId={studioId} />}
      {sub === 'kontribusi' && <Kontribusi studioId={studioId} />}
      {sub === 'beban' && <Beban studioId={studioId} />}
    </div>
  )
}
