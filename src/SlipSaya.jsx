import { useEffect, useState } from 'react'
import { api } from './api'
import { cetakSlip } from './slipPdf'

// SLIP GAJI SAYA (adaptasi OGS Payslip): hanya milik sendiri, hanya yang sudah final. Angka sama dengan Payroll Ekosistem.
const rp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')
const NAMA_BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export default function SlipSaya() {
  const [tahun, setTahun] = useState(new Date().getFullYear()), [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/slip-saya?tahun=${tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [tahun])
  return (
    <div>
      <div className="toolbar"><select value={tahun} onChange={e => setTahun(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}</select></div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : d.slip.length === 0 ? <div className="kosong">Belum ada slip final untuk {tahun}. Slip muncul setelah dinyatakan final oleh koordinator.</div> : d.slip.map(s => (
        <div className="panel" key={s.id}>
          <div className="meta"><b>{NAMA_BLN[s.bulan - 1]} {s.tahun}</b><span className="chip sub">{s.unit.trim()}</span><span className={'lencana' + (s.status === 'DIBAYAR' ? ' jenis-SELESAI' : '')}>{s.status === 'DIBAYAR' ? 'Dibayar' : 'Final'}</span><button className="btn kecil" onClick={() => cetakSlip(s.id)}>🖨 Unduh PDF</button></div>
          <table style={{ marginTop: 8 }}><tbody>
            {s.penghasilan.map(p => <tr key={p.nama}><td>{p.nama}</td><td style={{ textAlign: 'right' }}>{rp(p.jumlah)}</td></tr>)}
            {s.tunjangan.map(p => <tr key={p.nama}><td>Tunjangan {p.nama}</td><td style={{ textAlign: 'right' }}>{rp(p.jumlah)}</td></tr>)}
            {s.potongan > 0 && <tr><td>Potongan</td><td style={{ textAlign: 'right', color: 'var(--red)' }}>− {rp(s.potongan)}</td></tr>}
            <tr style={{ fontWeight: 700 }}><td>Diterima (THP)</td><td style={{ textAlign: 'right' }}>{rp(s.thp)}</td></tr></tbody></table>
          {s.lemburPresensi && <div className="redup kecil" style={{ marginTop: 6 }}>Termasuk lembur presensi: {s.lemburPresensi.jam} jam di {s.lemburPresensi.hari} hari.</div>}
          {s.lembur.length > 0 && <details style={{ marginTop: 8 }}><summary className="redup kecil">Rincian lembur ({s.lembur.length})</summary>{s.lembur.map((l, i) => <div key={i} className="redup kecil">{l.tanggal} · {l.order ?? '—'} · {l.level ?? ''} {l.progres} · {rp(l.fee)}</div>)}</details>}
          {s.catatan && <div className="redup kecil" style={{ marginTop: 6 }}>{s.catatan}</div>}
        </div>))}
      {d && <div className="redup kecil">{d.catatan}</div>}
    </div>
  )
}
