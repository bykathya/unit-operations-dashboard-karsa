import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { NAMA_BULAN, bulanSekarang, geserBulan } from '../api-util'

function Corong({ corong }) {
  const maks = Math.max(1, ...corong.map(c => c.nilai))
  return (
    <div className="corong">
      {corong.map((c, i) => (
        <div key={c.kunci} className="corong-baris">
          <div className="corong-label"><b>{c.label}</b><span className="redup kecil">{c.petunjuk}</span></div>
          <div className="bar tinggi"><i style={{ width: Math.max(2, (c.nilai / maks) * 100) + '%' }} /><span>{c.nilai}</span></div>
          <div className="corong-laju">{i > 0 && c.lajuDariSebelumnya != null ? `${c.lajuDariSebelumnya}%` : ''}</div>
        </div>
      ))}
    </div>
  )
}

function GrafikHarian({ harian, bulan, tahun }) {
  const hari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate()
  const peta = Object.fromEntries(harian.map(h => [Number(h.tanggal.slice(8)), h.nilai]))
  const maks = Math.max(1, ...Object.values(peta))
  return (
    <div className="grafik">
      {Array.from({ length: hari }, (_, i) => i + 1).map(h => (
        <div key={h} className="grafik-kolom" title={`${h}: ${peta[h] ?? 0}`}><div className="grafik-isi" style={{ height: ((peta[h] ?? 0) / maks) * 100 + '%' }} /><span>{h % 5 === 0 || h === 1 ? h : ''}</span></div>
      ))}
    </div>
  )
}

export default function MkInsight({ studioId }) {
  const [bt, setBt] = useState(bulanSekarang())
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/marketing/insight?studioId=${studioId}&bulan=${bt.bulan}&tahun=${bt.tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bt])
  useEffect(() => { muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat insight…</div>
  return (
    <>
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setBt(geserBulan(bt, -1))}>‹</button><strong>{NAMA_BULAN[bt.bulan - 1]} {bt.tahun}</strong><button className="btn kecil" onClick={() => setBt(geserBulan(bt, 1))}>›</button>
        <span className="redup kecil">{d.cakupan === 'tim' ? 'Seluruh tim studio' : 'Hanya milikmu'} · hanya hitungan, tanpa angka uang</span>
      </div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Aktivitas selesai</span><b>{d.effort}</b></div>
        <div className="stat"><span className="redup kecil">Order bulan ini</span><b>{d.corong.find(c => c.kunci === 'order').nilai}</b></div>
        <div className="stat"><span className="redup kecil">Persentase aktivitas jadi order</span><b>{d.lajuEffortKeOrder == null ? '—' : d.lajuEffortKeOrder + '%'}</b></div>
        {d.perTahap.map(t => <div key={t.kunci} className="stat"><span className="redup kecil">{t.label}</span><b>{t.nilai}</b></div>)}
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 className="judul-bagian">Tahapan penjualan: Aktivitas → Chat → Order → Preview → Delivery</h3>
        <p className="redup kecil">Chat = prospek masuk, Order = prospek/ order bulan ini. Preview dan Delivery terisi <b>otomatis</b> dari alur produksi — tidak perlu dicatat dua kali.</p>
        <Corong corong={d.corong} />
      </div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 className="judul-bagian">Aktivitas per hari</h3>
        <GrafikHarian harian={d.harian} bulan={d.bulan} tahun={d.tahun} />
      </div>
      {d.peringkat && (
        <div className="panel">
          <h3 className="judul-bagian">Peringkat efisiensi marketer (aktivitas → order)</h3>
          {d.peringkat.length === 0 ? <div className="kosong">Belum ada marketer dengan aktivitas selesai bulan ini.</div> : (
            <table><thead><tr><th>#</th><th>Marketer</th><th className="kanan">Aktivitas</th><th className="kanan">Chat</th><th className="kanan">Order</th><th className="kanan">Jadi order</th></tr></thead>
              <tbody>{d.peringkat.map(p => <tr key={p.userId}><td>{p.peringkat}</td><td>{p.nama}</td><td className="kanan">{p.effort}</td><td className="kanan">{p.chat}</td><td className="kanan">{p.order}</td><td className="kanan"><b>{p.laju}%</b></td></tr>)}</tbody></table>
          )}
          {d.marketerTanpaAktivitas.length > 0 && <p className="redup kecil" style={{ marginTop: 10 }}>Belum ada aktivitas selesai: {d.marketerTanpaAktivitas.join(', ')}</p>}
        </div>
      )}
    </>
  )
}
