import { useEffect, useState } from 'react'
import { api } from '../api'
import { NAMA_BULAN, bulanSekarang, geserBulan } from '../api-util'
import { BatangHorizontal, GrafikTren } from '../Grafik'
import MkRincianAktivitas from './MkRincianAktivitas'

// Dashboard Marketing lengkap (adaptasi OGS): KPI, corong, seri order, aktivitas per tahap, pemenuhan preview/delivery,
// konversi Effort→Order per bulan, peringkat efisiensi. Bulan atau tahun; manajer bisa memfilter per marketer.
export default function MkDashboard({ studioId }) {
  const [p, setP] = useState(bulanSekarang())
  const [tampilan, setTampilan] = useState('bulan')
  const [marketerId, setMarketerId] = useState('')
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [rinci, setRinci] = useState(null) // { userId, nama, tahap } — rincian aktivitas satu marketer (22 Nov 2026)
  useEffect(() => {
    setD(null); setGalat('')
    const q = `studioId=${studioId}&bulan=${p.bulan}&tahun=${p.tahun}&tampilan=${tampilan}${marketerId ? `&marketerId=${marketerId}` : ''}`
    api(`/api/circle/marketing/dashboard?${q}`).then(setD).catch(e => setGalat(e.message))
  }, [studioId, p, tampilan, marketerId])
  const fk = (k) => (tampilan === 'tahun' ? NAMA_BULAN[Number(k.slice(5)) - 1]?.slice(0, 3) : k.slice(8))
  return (
    <div>
      <div className="toolbar">
        <div className="tab-mini" style={{ margin: 0 }}>{[['bulan', 'Bulan'], ['tahun', 'Tahun']].map(([k, l]) => <button key={k} className={tampilan === k ? 'aktif' : ''} onClick={() => setTampilan(k)}>{l}</button>)}</div>
        <button className="btn kecil" onClick={() => setP(geserBulan(p, tampilan === 'tahun' ? -12 : -1))}>←</button>
        <b>{tampilan === 'tahun' ? p.tahun : `${NAMA_BULAN[p.bulan - 1]} ${p.tahun}`}</b>
        <button className="btn kecil" onClick={() => setP(geserBulan(p, tampilan === 'tahun' ? 12 : 1))}>→</button>
        {d?.marketer?.length > 0 && (
          <select style={{ width: 'auto' }} value={marketerId} onChange={e => setMarketerId(e.target.value)}>
            <option value="">Semua marketer</option>{d.marketer.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
        )}
      </div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="ringkasan">
          {[['Order', d.kpi.order], ['Aktivitas', d.kpi.effort], ['Chat (prospek)', d.kpi.chat], ['Preview', d.kpi.preview], ['Delivery', d.kpi.delivery]].map(([l, v]) => <div className="stat" key={l}><span className="redup kecil">{l}</span><b>{v}</b></div>)}
          <div className="stat"><span className="redup kecil">Aktivitas → Order</span><b>{d.lajuEffortKeOrder == null ? '—' : d.lajuEffortKeOrder + '%'}</b></div>
        </div>
        <h3 className="judul-bagian">Tahapan penjualan</h3>
        <BatangHorizontal data={d.corong.map(c => ({ label: c.label, nilai: c.nilai, ket: c.lajuDariSebelumnya != null ? `${c.lajuDariSebelumnya}% dari tahap sebelumnya` : c.petunjuk }))} />
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Order masuk</h3>
        <GrafikTren titik={d.seri} seri={[{ k: 'order', label: 'Order', warna: 'var(--seri-1)' }]} formatKunci={fk} />
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Aktivitas per tahap</h3>
        <GrafikTren titik={d.seri} seri={[{ k: 'publish', label: 'Unggah konten', warna: 'var(--seri-1)' }, { k: 'engage', label: 'Interaksi', warna: 'var(--seri-2)' }, { k: 'network', label: 'Jejaring', warna: 'var(--seri-3)' }, { k: 'optimize', label: 'Optimasi', warna: 'var(--seri-4)' }, { k: 'lainnya', label: 'Lainnya', warna: 'var(--seri-5)' }]} formatKunci={fk} />
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Jumlah Preview &amp; Delivery (pertama kali)</h3>
        <GrafikTren titik={d.seri} seri={[{ k: 'preview', label: 'Preview', warna: 'var(--seri-1)' }, { k: 'delivery', label: 'Delivery', warna: 'var(--seri-3)' }]} formatKunci={fk} />
        {d.konversiTahunan && <>
          <h3 className="judul-bagian" style={{ marginTop: 18 }}>Aktivitas jadi order per bulan {d.konversiTahunan.rataRata != null && <span className="redup kecil">· rata-rata {d.konversiTahunan.rataRata}%</span>}</h3>
          <GrafikTren titik={d.konversiTahunan.bulan.filter(b => !b.mendatang).map(b => ({ kunci: `${d.tahun}-${String(b.bulan).padStart(2, '0')}`, laju: b.laju ?? 0, effort: b.effort, order: b.order }))} seri={[{ k: 'laju', label: 'Jadi order (%)', warna: 'var(--seri-1)' }, { k: 'effort', label: 'Aktivitas', warna: 'var(--seri-4)' }, { k: 'order', label: 'Order', warna: 'var(--seri-2)' }]} formatKunci={fk} />
        </>}
        {d.peringkat && <>
          <h3 className="judul-bagian" style={{ marginTop: 18 }}>Peringkat efisiensi (paling sedikit aktivitas per order)</h3>
          {d.peringkat.length === 0 ? <div className="kosong">Belum ada marketer dengan aktivitas pada periode ini.</div> : (
            <table><thead><tr><th>#</th><th>Marketer</th><th className="kanan">Aktivitas</th><th className="kanan">Chat</th><th className="kanan">Order</th><th className="kanan">Aktivitas → Order</th></tr></thead>
              <tbody>{d.peringkat.map(r => <tr key={r.userId}><td><b>{r.peringkat}</b></td><td>{r.nama}</td><td className="kanan">{r.effort}</td><td className="kanan">{r.chat}</td><td className="kanan">{r.order}</td><td className="kanan">{r.laju == null ? '—' : r.laju + '%'}</td></tr>)}</tbody></table>
          )}
          <h3 className="judul-bagian" style={{ marginTop: 18 }}>Aktivitas per marketer</h3>
          <div className="redup kecil" style={{ marginBottom: 6 }}>Klik nama atau angka untuk melihat isi aktivitasnya (judul, link postingan, akun target, hasil).</div>
          <table><thead><tr><th>Marketer</th><th className="kanan">Unggah konten</th><th className="kanan">Interaksi</th><th className="kanan">Jejaring</th><th className="kanan">Optimasi</th><th className="kanan">Total</th></tr></thead>
            <tbody>{d.perMarketer.map(r => { const buka = (tahap = '') => () => setRinci({ userId: r.userId, nama: r.nama, tahap }); const sel = (k) => <td className="kanan">{r[k] > 0 ? <button type="button" className="tautan" onClick={buka(k)}>{r[k]}</button> : r[k]}</td>; return (
              <tr key={r.userId}><td><button type="button" className="tautan" onClick={buka()}>{r.nama}</button></td>{sel('publish')}{sel('engage')}{sel('network')}{sel('optimize')}<td className="kanan"><b>{r.effort > 0 ? <button type="button" className="tautan" onClick={buka()}>{r.effort}</button> : r.effort}</b></td></tr>) })}</tbody></table>
        </>}
        {rinci && <MkRincianAktivitas studioId={studioId} userId={rinci.userId} nama={rinci.nama} tahapAwal={rinci.tahap} p={p} tampilan={tampilan} onTutup={() => setRinci(null)} />}
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Cara membaca</h3>
        <ul className="redup kecil" style={{ paddingLeft: 18 }}>{d.catatanBaca.map(c => <li key={c}>{c}</li>)}</ul>
      </>}
    </div>
  )
}
