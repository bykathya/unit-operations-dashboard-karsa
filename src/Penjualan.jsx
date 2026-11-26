import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'
import { useSegarkan } from './realtime'

// PENJUALAN / Sales dashboard (adaptasi OGS): omset (USD, nilai bersih order) vs target per akun, per periode closing (P1…Pn, kekurangan dibawa),
// dan 12 bulan. Target diisi per akun oleh Koordinator unit (CEO unit) atau Kepala Circle.
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }))
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const STATUS = { ahead: ['Di depan', 'jenis-SELESAI'], 'on-track': ['Sesuai', ''], behind: ['Tertinggal', 'revisi'], critical: ['Kritis', 'revisi'], neutral: ['—', ''] }
const tg = (t) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function Bar({ persen, warna = 'var(--seri-1)' }) { return <div className="gf-trek"><i style={{ width: `${Math.min(100, persen ?? 0)}%`, background: warna }} /></div> }

function Target({ studioId, tahun, bulan, onSimpan }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [nilai, setNilai] = useState({})
  useEffect(() => { api(`/api/circle/penjualan/target?studioId=${studioId}&tahun=${tahun}&bulan=${bulan}`).then(x => { setD(x); setNilai(Object.fromEntries(x.akun.map(a => [a.akunId, a.targetUsd ?? '']))) }).catch(e => setGalat(e.message)) }, [studioId, tahun, bulan])
  if (!d) return galat ? <div className="galat">{galat}</div> : null
  const simpan = async (akunId) => { setGalat(''); try { await api('/api/circle/penjualan/target', { method: 'PUT', body: { akunId, tahun, bulan, targetUsd: Number(nilai[akunId] || 0) } }); onSimpan() } catch (e) { setGalat(e.message) } }
  return (
    <div className="panel"><h3 className="judul-bagian">Target per akun · {NAMA_BLN[bulan - 1]} {tahun}</h3>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Target unit = jumlah target akun{d.targetUnit != null ? ` (sekarang ${usd(d.targetUnit)}${d.targetUnitDariAkun ? '' : ', diisi langsung di Kaizen'})` : ''}. Kosongkan / 0 untuk menghapus. {d.bisaUbah ? '' : 'Hanya Koordinator unit (atau Kepala Circle) yang bisa mengubah.'}</div>
      {galat && <div className="galat">{galat}</div>}
      {d.akun.map(a => <div key={a.akunId} className="meta" style={{ marginBottom: 6 }}><span style={{ minWidth: 180 }}>{a.nama} <span className="redup kecil">· {a.platform}</span></span>
        <input type="number" min="0" style={{ width: 120 }} value={nilai[a.akunId] ?? ''} disabled={!d.bisaUbah} onChange={e => setNilai({ ...nilai, [a.akunId]: e.target.value })} placeholder="USD" />
        {d.bisaUbah && <button className="btn kecil" onClick={() => simpan(a.akunId)}>Simpan</button>}</div>)}
    </div>
  )
}

export default function Penjualan({ studioId, atasan }) {
  const sekarang = new Date(Date.now() + 7 * 3600000)
  const [tahun, setTahun] = useState(sekarang.getUTCFullYear()), [bulan, setBulan] = useState(sekarang.getUTCMonth() + 1), [d, setD] = useState(null), [galat, setGalat] = useState(''), [atur, setAtur] = useState(false)
  const muat = useCallback(() => api(`/api/circle/penjualan?studioId=${studioId}&tahun=${tahun}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, tahun, bulan])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders'])
  const geser = (n) => { const t = tahun * 12 + (bulan - 1) + n; setTahun(Math.floor(t / 12)); setBulan((t % 12) + 1) }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const maks = Math.max(1, ...d.tahunan.flatMap(m => [m.aktualUsd, m.targetUsd ?? 0]))
  return (
    <div>
      <div className="toolbar"><button className="btn kecil" onClick={() => geser(-1)}>←</button><b>{NAMA_BLN[bulan - 1]} {tahun}</b><button className="btn kecil" onClick={() => geser(1)}>→</button>
        <TombolUnduh nama={`penjualan-${tahun}-${bulan}`} baris={[['Akun', 'Platform', 'Order', 'Aktual USD', 'Target USD', '%'], ...d.akun.map(a => [a.nama, a.platform, a.order, a.aktualUsd, a.targetUsd ?? '', a.persen ?? '']), ['Total', '', d.total.order, d.total.aktualUsd, d.total.targetUsd ?? '', d.total.persen ?? '']]} cetak />
        {atasan && <button className="btn kecil" onClick={() => setAtur(!atur)}>{atur ? 'Tutup target' : 'Atur target'}</button>}</div>
      {galat && <div className="galat blok">{galat}</div>}
      {atur && <Target studioId={studioId} tahun={tahun} bulan={bulan} onSimpan={muat} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="stat"><span className="redup kecil">Omset bersih bulan ini</span><b>{usd(d.total.aktualUsd)}</b></div>
        <div className="stat"><span className="redup kecil">Target</span><b>{usd(d.total.targetUsd)}</b></div>
        <div className="stat progres"><span className="redup kecil">Pencapaian</span><b>{d.total.persen != null ? d.total.persen + '%' : '—'}</b><Bar persen={d.total.persen} /></div>
        <div className="stat"><span className="redup kecil">Order masuk</span><b>{d.total.order}</b></div>
        <div className="stat"><span className="redup kecil">Kurs bawaan (order Rp)</span><b>Rp {Math.round(d.kursBawaan).toLocaleString('id-ID')}</b><span className="redup kecil" title="Satu sumber kurs: Laporan Mingguan. Form order USD memakai kurs laporan terbaru.">rata-rata Laporan Mingguan · ubah di menu Keuangan</span></div>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}><h3 className="judul-bagian">Per periode tutup buku (Jumat & akhir bulan)</h3>
        <table><thead><tr><th>Periode</th><th>Tanggal</th><th style={{ textAlign: 'right' }}>Target</th><th style={{ textAlign: 'right' }}>+ dibawa</th><th style={{ textAlign: 'right' }}>Efektif</th><th style={{ textAlign: 'right' }}>Aktual</th><th style={{ minWidth: 110 }}>%</th><th>Status</th></tr></thead><tbody>
          {d.periode.map(p => <tr key={p.index} style={p.berjalan ? { background: 'var(--hover-overlay)' } : undefined}><td>P{p.index}{p.berjalan ? ' ●' : ''}</td><td>{tg(p.mulai)} – {tg(p.akhir)}</td><td style={{ textAlign: 'right' }}>{usd(p.dasar)}</td><td style={{ textAlign: 'right', color: p.carry > 0 ? 'var(--red)' : undefined }}>{p.carry ? usd(p.carry) : '·'}</td><td style={{ textAlign: 'right' }}>{usd(p.efektif)}</td><td style={{ textAlign: 'right' }}><b>{usd(p.aktual)}</b></td><td><Bar persen={p.persen} />{p.efektif > 0 ? p.persen + '%' : ''}</td><td><span className={'lencana ' + STATUS[p.status][1]}>{STATUS[p.status][0]}</span></td></tr>)}
        </tbody></table>
        <div className="redup kecil" style={{ marginTop: 6 }}>Target dasar = target bulan ÷ jumlah periode. Kekurangan periode yang sudah selesai dibawa ke periode berikutnya (kelebihan mengurangi).</div>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}><h3 className="judul-bagian">Per akun{d.lihatSemua ? '' : ' (akun yang kamu pegang)'}</h3>
        {d.akun.length === 0 ? <div className="redup kecil">Belum ada akun.</div> : <table><thead><tr><th>Akun</th><th style={{ textAlign: 'right' }}>Order</th><th style={{ textAlign: 'right' }}>Aktual</th><th style={{ textAlign: 'right' }}>Target</th><th style={{ minWidth: 120 }}>%</th></tr></thead><tbody>
          {d.akun.map(a => <tr key={a.akunId}><td>{a.nama}<span className="redup kecil"> · {a.platform}</span></td><td style={{ textAlign: 'right' }}>{a.order}</td><td style={{ textAlign: 'right' }}><b>{usd(a.aktualUsd)}</b></td><td style={{ textAlign: 'right' }}>{usd(a.targetUsd)}</td><td>{a.persen != null ? <><Bar persen={a.persen} />{a.persen}%</> : <span className="redup">tanpa target</span>}</td></tr>)}</tbody></table>}
      </div>
      <div className="panel"><h3 className="judul-bagian">12 bulan {tahun}</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 130 }}>
          {d.tahunan.map(m => <div key={m.bulan} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: m.masaDepan ? 0.4 : 1 }} title={`${NAMA_BLN[m.bulan - 1]}: ${usd(m.aktualUsd)}${m.targetUsd ? ` / target ${usd(m.targetUsd)} (${m.persen}%)` : ''}`} onClick={() => setBulan(m.bulan)}>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 100, cursor: 'pointer' }}><i style={{ width: 9, height: `${(m.aktualUsd / maks) * 100}%`, minHeight: m.aktualUsd ? 2 : 0, background: 'var(--accent)', borderRadius: 2 }} /><i style={{ width: 9, height: `${((m.targetUsd ?? 0) / maks) * 100}%`, minHeight: m.targetUsd ? 2 : 0, background: 'var(--text-secondary)', borderRadius: 2 }} /></div>
            <span className={m.bulan === bulan ? '' : 'redup'} style={{ fontSize: 10, fontWeight: m.bulan === bulan ? 700 : 400 }}>{NAMA_BLN[m.bulan - 1]}</span></div>)}
        </div>
        <div className="redup kecil" style={{ marginTop: 6 }}><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} /> omset &nbsp; <i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--text-secondary)', borderRadius: 2 }} /> target — klik bulan untuk membukanya. {d.catatan}</div>
      </div>
    </div>
  )
}
