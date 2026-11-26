import { useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'

// DASHBOARD MANAJEMEN (adaptasi OGS Management): leaderboard unit (pace omset vs target), piutang/aging seluruh unit, P&L per rentang bulan.
// Kepala Circle ke atas.
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }))
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const STATUS = { ahead: ['Di depan', 'jenis-SELESAI'], 'on-track': ['Sesuai', ''], behind: ['Tertinggal', 'revisi'], critical: ['Kritis', 'revisi'], neutral: ['—', ''] }

function Papan() {
  const s = new Date(Date.now() + 7 * 3600000)
  const [tahun, setTahun] = useState(s.getUTCFullYear()), [bulan, setBulan] = useState(s.getUTCMonth() + 1), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/manajemen?tahun=${tahun}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [tahun, bulan])
  const geser = (n) => { const t = tahun * 12 + (bulan - 1) + n; setTahun(Math.floor(t / 12)); setBulan((t % 12) + 1) }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      <div className="toolbar"><button className="btn kecil" onClick={() => geser(-1)}>←</button><b>{NAMA_BLN[bulan - 1]} {tahun}</b><button className="btn kecil" onClick={() => geser(1)}>→</button>
        <TombolUnduh nama={`leaderboard-${tahun}-${bulan}`} baris={[['Unit', 'Aktual USD', 'Target USD', '%', 'Status'], ...d.papan.map(p => [p.nama, p.aktualUsd, p.targetUsd ?? '', p.persen ?? '', STATUS[p.status][0]])]} cetak /></div>
      <div className="panel"><h3 className="judul-bagian">Peringkat unit · total {usd(d.total.aktualUsd)}{d.total.targetUsd ? ` / ${usd(d.total.targetUsd)}` : ''}</h3>
        <table><thead><tr><th>#</th><th>Unit</th><th style={{ textAlign: 'right' }}>Aktual</th><th style={{ textAlign: 'right' }}>Target</th><th style={{ minWidth: 130 }}>Pencapaian</th><th>Status</th></tr></thead><tbody>
          {d.papan.map((p, i) => <tr key={p.studioId} className={p.dihitung ? '' : 'redup'}><td>{i + 1}</td><td>{p.nama}{!p.dihitung && <span className="redup kecil"> · kolaborasi (tidak dijumlah)</span>}</td><td style={{ textAlign: 'right' }}><b>{usd(p.aktualUsd)}</b></td><td style={{ textAlign: 'right' }}>{usd(p.targetUsd)}</td>
            <td>{p.persen != null ? <><div className="gf-trek"><i style={{ width: `${Math.min(100, p.persen)}%`, background: 'var(--seri-1)' }} /></div>{p.persen}%{d.berjalan ? <span className="redup kecil"> (harapan {p.harapanPersen}%)</span> : ''}</> : <span className="redup">tanpa target</span>}</td><td><span className={'lencana ' + STATUS[p.status][1]}>{STATUS[p.status][0]}</span></td></tr>)}</tbody></table>
        <div className="redup kecil" style={{ marginTop: 6 }}>{d.catatan}</div>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}><h3 className="judul-bagian">Piutang seluruh unit · {rp(d.piutang.total)}</h3>
        {/* Satu arti piutang (14 Nov 2026) = Belum dibayar klien: project sudah Delivery/Done & belum lunas */}
        <div className="redup kecil" style={{ marginBottom: 6 }}>Project yang sudah Delivery atau Done tetapi belum lunas (sama dengan menu Belum dibayar klien).{d.piutang.masihDikerjakan?.jumlah > 0 ? ` Di luar itu ada ${d.piutang.masihDikerjakan.jumlah} order belum lunas yang masih dikerjakan (${rp(d.piutang.masihDikerjakan.total)}).` : ''}</div>
        <div className="chips" style={{ marginBottom: 8 }}>{Object.entries(d.piutang.aging).sort().map(([k, v]) => <span key={k} className={'lencana' + (k === '>90' ? ' revisi' : '')}>{k} hari: {rp(v.total)} ({v.jumlah})</span>)}
          <TombolUnduh nama="piutang-outstanding" baris={[['Unit', 'Order', 'Klien', 'Nilai bersih', 'Dibayar', 'Sisa', 'Umur (hari)', 'Kelompok'], ...d.piutang.baris.map(b => [b.unit, b.judul, b.klien, b.nilaiBersih, b.dibayar, b.sisa, b.umurHari, b.kelompok])]} cetak /></div>
        {d.piutang.baris.length === 0 ? <div className="redup kecil">Tidak ada piutang.</div> : <table><thead><tr><th>Unit</th><th>Order</th><th style={{ textAlign: 'right' }}>Sisa</th><th>Umur</th><th>Tagihan</th></tr></thead><tbody>
          {d.piutang.baris.slice(0, 40).map(b => <tr key={b.orderId}><td>{b.unit}</td><td><b>{b.judul}</b><div className="redup kecil">{b.klien}</div></td><td style={{ textAlign: 'right' }}>{rp(b.sisa)}</td><td>{b.umurHari} hr</td><td><span className={'lencana' + (b.sudahDitagih ? '' : ' nada-warn')}>{b.sudahDitagih ? 'Sudah ditagihkan' : 'Belum dibuat tagihan'}</span></td></tr>)}</tbody></table>}
        {d.piutang.baris.length > 40 && <div className="redup kecil">Menampilkan 40 teratas; unduh untuk semuanya.</div>}
      </div>
    </div>
  )
}

function Rentang() {
  const s = new Date(Date.now() + 7 * 3600000), ym = s.toISOString().slice(0, 7)
  const [dari, setDari] = useState(`${s.getUTCFullYear()}-01`), [sampai, setSampai] = useState(ym), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/buku/rentang?dari=${dari}&sampai=${sampai}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [dari, sampai])
  return (
    <div>
      <div className="toolbar"><input type="month" value={dari} onChange={e => e.target.value && setDari(e.target.value)} /><span className="redup kecil">s/d</span><input type="month" value={sampai} onChange={e => e.target.value && setSampai(e.target.value)} />
        {d && <TombolUnduh nama={`laba-rugi-unit-${dari}-${sampai}`} baris={[['Unit', 'Masuk', 'Keluar', 'Laba rugi', 'Margin %', 'Kas akhir'], ...d.unit.map(u => [u.nama, u.masuk, u.keluar, u.hasil, u.marginPersen ?? '', u.kasAkhir]), ['Total', d.total.masuk, d.total.keluar, d.total.hasil, '', d.total.kasAkhir]]} cetak />}</div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : (
        <div className="panel" style={{ overflowX: 'auto' }}><table><thead><tr><th>Unit</th><th style={{ textAlign: 'right' }}>Masuk</th><th style={{ textAlign: 'right' }}>Keluar</th><th style={{ textAlign: 'right' }}>Laba rugi</th><th style={{ textAlign: 'right' }}>Margin</th><th style={{ textAlign: 'right' }}>Kas akhir</th><th>Ditutup</th></tr></thead><tbody>
          {d.unit.map(u => <tr key={u.studioId}><td>{u.nama}</td><td style={{ textAlign: 'right' }}>{rp(u.masuk)}</td><td style={{ textAlign: 'right' }}>{rp(u.keluar)}</td><td style={{ textAlign: 'right', color: u.hasil < 0 ? 'var(--red)' : undefined }}><b>{rp(u.hasil)}</b></td><td style={{ textAlign: 'right' }}>{u.marginPersen != null ? u.marginPersen + '%' : '—'}</td><td style={{ textAlign: 'right' }}>{rp(u.kasAkhir)}</td><td>{u.bulanDitutup}/{u.jumlahBulan}</td></tr>)}
          <tr style={{ fontWeight: 700 }}><td>Total</td><td style={{ textAlign: 'right' }}>{rp(d.total.masuk)}</td><td style={{ textAlign: 'right' }}>{rp(d.total.keluar)}</td><td style={{ textAlign: 'right' }}>{rp(d.total.hasil)}</td><td /><td style={{ textAlign: 'right' }}>{rp(d.total.kasAkhir)}</td><td /></tr></tbody></table>
          <div className="redup kecil" style={{ marginTop: 6 }}>{d.catatan} Mode bayangan: tidak memengaruhi Laporan Omset di Management Dashboard.</div></div>)}
    </div>
  )
}

export default function Manajemen() {
  const [sub, setSub] = useState('papan')
  return (
    <div>
      <div className="tab-mini"><button className={sub === 'papan' ? 'aktif' : ''} onClick={() => setSub('papan')}>Peringkat & piutang</button><button className={sub === 'rentang' ? 'aktif' : ''} onClick={() => setSub('rentang')}>Laba rugi per rentang</button></div>
      {sub === 'papan' ? <Papan /> : <Rentang />}
    </div>
  )
}
