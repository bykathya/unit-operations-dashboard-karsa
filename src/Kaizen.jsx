import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { NAMA_BULAN, bulanSekarang, geserBulan } from './api-util'
import { BatangHorizontal, GrafikTren } from './Grafik'

// KAIZEN & SKOR EKSEKUTIF (adaptasi OGS): kartu KPI berstatus (omset vs target, penagihan, beban order, ketepatan, revisi, SDM),
// omset tahunan vs garis dasar CPM, analitik siklus (bottleneck), keterlambatan, ketepatan, dan tindakan perbaikan.
// Omset dari Laporan Omset Ekosistem. Koordinator/Pendamping ke atas; cakupan = unit dalam wewenang.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }))
const kb = (p) => `${p.tahun}-${String(p.bulan).padStart(2, '0')}`
const WARNA = { good: 'var(--nada-ok)', warn: 'var(--nada-warn)', critical: 'var(--nada-bad)', neutral: 'var(--text-muted)' }
const LABEL = { good: 'Baik', warn: 'Waspada', critical: 'Kritis', neutral: 'Belum ada data' }
const jalan = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
function useMuat(url, deps = []) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(url).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [url])
  useEffect(() => { setD(null); muat() }, [muat, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return [d, galat, muat, setGalat]
}
const Bulan = ({ p, setP }) => <div className="toolbar"><button className="btn kecil" onClick={() => setP(geserBulan(p, -1))}>←</button><b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b><button className="btn kecil" onClick={() => setP(geserBulan(p, 1))}>→</button></div>

function Eksekutif() {
  const [p, setP] = useState(bulanSekarang())
  const [d, galat, muat, setGalat] = useMuat(`/api/circle/kaizen/eksekutif?bulan=${kb(p)}`)
  const [target, galatT, muatT] = useMuat(`/api/circle/kaizen/target?tahun=${p.tahun}&bulan=${p.bulan}`)
  return (
    <div>
      <Bulan p={p} setP={setP} />
      {(galat || galatT) && <div className="galat blok">{galat || galatT}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="redup kecil" style={{ marginBottom: 8 }}>{d.cakupan.length} unit: {d.cakupan.map(u => u.nama.trim()).join(', ') || '—'}</div>
        <div className="ringkasan">
          {d.kartu.map(k => (
            <div className="stat" key={k.kunci} style={{ borderLeft: `4px solid ${WARNA[k.status]}` }}>
              <span className="redup kecil">{k.label}</span><b>{k.nilai}</b>
              <span className="kecil" style={{ color: WARNA[k.status], fontWeight: 700 }}>{LABEL[k.status]}</span>
              <span className="redup kecil">{k.petunjuk}</span>
            </div>
          ))}
        </div>
        {d.omzet.adaTarget && <div className="panel" style={{ marginBottom: 12 }}><div className="baris-atas"><b>Pace omset</b><span className="redup kecil">harapan {d.omzet.harapanPct ?? '—'}% · capaian {d.omzet.progressPct}%</span></div><div className="gf-trek" style={{ marginTop: 8, height: 12 }}><i style={{ width: `${Math.min(100, d.omzet.progressPct)}%`, background: WARNA[d.omzet.status] }} /></div></div>}
        <h3 className="judul-bagian">Omset per unit</h3>
        <table><thead><tr><th>Unit</th><th className="kanan">Aktual (USD)</th><th className="kanan">Target (USD)</th></tr></thead>
          <tbody>{d.omzet.unit.map(u => <tr key={u.studioId}><td><b>{u.nama.trim()}</b>{!u.dihitung && <span className="lencana" style={{ marginLeft: 6 }}>kolaborasi</span>}</td><td className="kanan">{usd(u.aktualUsd)}</td><td className="kanan">{u.targetUsd == null ? '—' : usd(u.targetUsd)}</td></tr>)}</tbody></table>
        {target && <div style={{ marginTop: 14 }}><h3 className="judul-bagian">Target omset bulan ini</h3>
          {!target.bisaUbah && <p className="redup kecil">Target diatur Koordinator unit (atau Kepala Circle).</p>}
          {target.unit.filter(u => u.dihitung).map(u => <TargetBaris key={u.studioId} u={u} bisa={target.bisaUbah} simpan={(v) => jalan(() => api('/api/circle/kaizen/target', { method: 'PUT', body: { studioId: u.studioId, tahun: p.tahun, bulan: p.bulan, targetUsd: Number(v) } }), setGalat, () => { muat(); muatT() })} />)}</div>}
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Beban order</h3>
        <BatangHorizontal data={[{ label: 'Terbawa', nilai: d.beban.carryOver }, { label: 'Baru', nilai: d.beban.baru }, { label: 'Masuk', nilai: d.beban.in }, { label: 'Dikerjakan', nilai: d.beban.wip }, { label: 'Delivery', nilai: d.beban.delivery }, { label: 'Selesai', nilai: d.beban.completed }]} />
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>SDM (Penilaian Kader, skala 10)</h3>
        {d.sdm.jumlahPenilaian === 0 ? <div className="kosong">Belum ada penilaian pada bulan ini.</div> : <BatangHorizontal data={d.sdm.kategori.map(k => ({ label: k.label.split(' ')[0], nilai: k.nilai ?? 0, ket: k.label }))} />}
      </>}
    </div>
  )
}
function TargetBaris({ u, bisa, simpan }) {
  const [v, setV] = useState(u.targetUsd == null ? '' : String(u.targetUsd))
  useEffect(() => setV(u.targetUsd == null ? '' : String(u.targetUsd)), [u.targetUsd])
  return <div className="toolbar"><span style={{ minWidth: 160 }}><b>{u.nama.trim()}</b></span><input type="number" min="0" style={{ maxWidth: 160 }} placeholder="USD" disabled={!bisa} value={v} onChange={e => setV(e.target.value)} />{bisa && <button className="btn kecil" disabled={String(u.targetUsd ?? '') === v || v === ''} onClick={() => simpan(v)}>Simpan</button>}</div>
}

function Omzet() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [d, galat] = useMuat(`/api/circle/kaizen/omzet?tahun=${tahun}`)
  return (
    <div>
      <div className="toolbar"><button className="btn kecil" onClick={() => setTahun(tahun - 1)}>←</button><b>{tahun}</b><button className="btn kecil" onClick={() => setTahun(tahun + 1)}>→</button></div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="ringkasan"><div className="stat"><span className="redup kecil">Total omset {d.tahun}</span><b>{usd(d.totalUsd)}</b></div><div className="stat"><span className="redup kecil">Acuan CPM per bulan</span><b>{rp(d.cpmBaselineRp)}</b></div></div>
        <GrafikTren titik={d.bulan.map(b => ({ kunci: `${d.tahun}-${String(b.bulan).padStart(2, '0')}`, omset: b.usd, target: b.targetUsd }))} seri={[{ k: 'omzet', label: 'Omset (USD)', warna: 'var(--seri-1)' }, { k: 'target', label: 'Target (USD)', warna: 'var(--seri-4)' }]} formatKunci={(k) => NAMA_BULAN[Number(k.slice(5)) - 1].slice(0, 3)} />
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Per unit</h3>
        <table><thead><tr><th>Unit</th>{NAMA_BULAN.map(m => <th key={m} className="kanan">{m.slice(0, 3)}</th>)}<th className="kanan">Total</th></tr></thead>
          <tbody>{d.unit.map(u => <tr key={u.studioId}><td><b>{u.nama.trim()}</b></td>{u.bulanan.map((v, i) => <td key={i} className="kanan">{v ? Math.round(v).toLocaleString('en-US') : '·'}</td>)}<td className="kanan"><b>{usd(u.totalUsd)}</b></td></tr>)}</tbody></table>
        <p className="redup kecil" style={{ marginTop: 8 }}>{d.catatan}</p>
      </>}
    </div>
  )
}

function Siklus() {
  const [d, galat] = useMuat('/api/circle/kaizen/siklus')
  const [t, galatT] = useMuat('/api/circle/kaizen/keterlambatan')
  const [o, galatO] = useMuat('/api/circle/kaizen/ketepatan?bulan=6')
  const g = galat || galatT || galatO
  return (
    <div>
      {g && <div className="galat blok">{g}</div>}
      {d && <>
        <div className="ringkasan">
          <div className="stat"><span className="redup kecil">Order selesai (waktunya tercatat)</span><b>{d.ringkasan.order}</b></div>
          <div className="stat"><span className="redup kecil">Rata-rata lama pengerjaan</span><b>{d.ringkasan.rataLead} hari</b><span className="redup kecil">median {d.ringkasan.medianLead}</span></div>
          <div className="stat"><span className="redup kecil">Order ber-revisi</span><b>{d.revisi.persenDenganRevisi}%</b><span className="redup kecil">rata {d.revisi.rataPerOrder} revisi/order</span></div>
        </div>
        <h3 className="judul-bagian">Tahap paling lama — rata-rata hari per tahap (sampel ≥ {d.minSampel})</h3>
        {d.bottleneck.length === 0 ? <div className="kosong">Belum cukup data kecepatan kerja. Data terkumpul seiring order dikerjakan lewat alur web circle.</div> : <BatangHorizontal data={d.bottleneck.slice(0, 12).map((b, i) => ({ label: b.tahap, nilai: b.rataHari, nada: i === 0 ? 'bad' : undefined, ket: `${b.jumlah}×` }))} satuan=" hari" />}
        <h3 className="judul-bagian" style={{ marginTop: 18 }}>Tren lama pengerjaan (6 bulan)</h3>
        <GrafikTren titik={d.tren.map(x => ({ kunci: x.bulan, rata: x.rataHari ?? 0, jumlah: x.jumlah }))} seri={[{ k: 'rata', label: 'Rata-rata hari', warna: 'var(--seri-1)' }, { k: 'jumlah', label: 'Order selesai', warna: 'var(--seri-3)' }]} formatKunci={(k) => k.slice(2)} />
        {d.perUnit.length > 0 && <><h3 className="judul-bagian" style={{ marginTop: 18 }}>Per unit</h3><table><tbody>{d.perUnit.map(u => <tr key={u.studioId}><td><b>{u.unit.trim()}</b></td><td className="kanan">{u.rataHari} hari</td><td className="kanan redup">{u.jumlah} order</td></tr>)}</tbody></table></>}
      </>}
      {o && <><h3 className="judul-bagian" style={{ marginTop: 18 }}>Ketepatan deadline (6 bulan) {o.rate != null && <span className="redup kecil">· {o.rate}% terkirim tepat</span>}</h3>
        {o.perUnit.length === 0 ? <div className="kosong">Belum ada order ber-deadline.</div> : <table><thead><tr><th>Unit</th><th className="kanan">Rencana</th><th className="kanan">Terkirim</th><th className="kanan">Telat</th><th className="kanan">Berjalan</th><th className="kanan">Rate</th></tr></thead><tbody>{o.perUnit.map(u => <tr key={u.studioId}><td><b>{u.unit?.trim()}</b></td><td className="kanan">{u.rencana}</td><td className="kanan">{u.terkirim}</td><td className={'kanan ' + (u.telat ? 'nada-bad' : '')}>{u.telat}</td><td className="kanan">{u.berjalan}</td><td className="kanan">{u.rate == null ? '—' : u.rate + '%'}</td></tr>)}</tbody></table>}</>}
      {t && <><h3 className="judul-bagian" style={{ marginTop: 18 }}>Keterlambatan — {t.periode}: {t.telat} dari {t.total} order lewat deadline ({t.persenTelat}%)</h3>
        {t.daftar.length === 0 ? <div className="kosong">Tidak ada order yang lewat deadline dan belum terkirim.</div> : <table><thead><tr><th>Order</th><th>Unit</th><th>Tahap</th><th>Deadline</th><th className="kanan">Telat</th></tr></thead><tbody>{t.daftar.map(x => <tr key={x.orderId}><td><b>{x.judul}</b><div className="redup kecil">{x.klien}</div></td><td>{x.unit?.trim()}</td><td>{x.status}</td><td>{x.deadline}</td><td className="kanan nada-bad">{x.hariTelat} hari</td></tr>)}</tbody></table>}</>}
    </div>
  )
}

const STATUS = { BARU: 'Baru', PROSES: 'Proses', SELESAI: 'Selesai', BATAL: 'Batal' }
function Tindakan() {
  const [status, setStatus] = useState('')
  const [d, galat, muat, setGalat] = useMuat(`/api/circle/kaizen/tindakan${status ? `?status=${status}` : ''}`, [status])
  const [f, setF] = useState({ judul: '', deskripsi: '', pemilikId: '', jatuhTempo: '', prioritas: 'SEDANG' })
  const [buka, setBuka] = useState(false)
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar"><div className="tab-mini" style={{ margin: 0 }}>{[['', 'Semua'], ['BARU', 'Baru'], ['PROSES', 'Proses'], ['SELESAI', 'Selesai'], ['BATAL', 'Batal']].map(([k, l]) => <button key={k} className={status === k ? 'aktif' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div><button className="btn utama" onClick={() => setBuka(!buka)}>+ Tindakan</button></div>
      {d && <div className="ringkasan"><div className="stat"><span className="redup kecil">Baru</span><b>{d.ringkasan.baru}</b></div><div className="stat"><span className="redup kecil">Proses</span><b>{d.ringkasan.proses}</b></div><div className="stat"><span className="redup kecil">Selesai</span><b>{d.ringkasan.selesai}</b></div><div className="stat"><span className="redup kecil">Terlambat</span><b className={d.ringkasan.terlambat ? 'nada-bad' : ''}>{d.ringkasan.terlambat}</b></div></div>}
      {buka && d && (
        <form className="panel" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); jalan(async () => { await api('/api/circle/kaizen/tindakan', { method: 'POST', body: { ...f, pemilikId: f.pemilikId || undefined, jatuhTempo: f.jatuhTempo || undefined, sumberTab: 'manual' } }); setF({ judul: '', deskripsi: '', pemilikId: '', jatuhTempo: '', prioritas: 'SEDANG' }); setBuka(false) }, setGalat, muat) }}>
          <label>Judul<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={200} placeholder="mis. Percepat QC tahap Line Art" /></label>
          <label>Deskripsi<textarea rows={2} value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} /></label>
          <div className="dua"><label>Penanggung jawab<select value={f.pemilikId} onChange={e => setF({ ...f, pemilikId: e.target.value })}><option value="">—</option>{d.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label><label>Jatuh tempo<input type="date" value={f.jatuhTempo} onChange={e => setF({ ...f, jatuhTempo: e.target.value })} /></label></div>
          <label>Prioritas<select value={f.prioritas} onChange={e => setF({ ...f, prioritas: e.target.value })}><option value="RENDAH">Rendah</option><option value="SEDANG">Sedang</option><option value="TINGGI">Tinggi</option></select></label>
          <button className="btn utama">Simpan</button>
        </form>
      )}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : d.tindakan.length === 0 ? <div className="kosong">Belum ada tindakan perbaikan. Catat tindak lanjut dari temuan di tab lain.</div> : d.tindakan.map(t => (
        <div className="panel" key={t.id} style={{ marginBottom: 8 }}>
          <div className="baris-atas"><b>{t.judul}</b><span className={'tahap-lencana' + (t.status === 'SELESAI' ? ' jenis-SELESAI' : '')}>{STATUS[t.status]}</span></div>
          <div className="meta" style={{ margin: '4px 0' }}><span className={'lencana' + (t.prioritas === 'TINGGI' ? ' revisi' : '')}>{t.prioritas.toLowerCase()}</span>{t.pemilik && <span>👤 {t.pemilik}</span>}{t.jatuhTempo && <span className={t.terlambat ? 'nada-bad' : 'redup'}>⏱ {t.jatuhTempo}{t.terlambat ? ' · terlambat' : ''}</span>}<span className="redup kecil">oleh {t.dibuatOleh}</span></div>
          {t.deskripsi && <div className="redup" style={{ whiteSpace: 'pre-wrap' }}>{t.deskripsi}</div>}
          {t.catatanHasil && <div className="kecil" style={{ marginTop: 4 }}><b>Hasil:</b> {t.catatanHasil}</div>}
          <div className="toolbar" style={{ marginTop: 6 }}>{['BARU', 'PROSES', 'SELESAI', 'BATAL'].filter(s => s !== t.status).map(s => <button key={s} className="btn kecil" onClick={() => { const catatanHasil = s === 'SELESAI' ? prompt('Hasil / catatan (opsional):') : undefined; jalan(() => api(`/api/circle/kaizen/tindakan/${t.id}`, { method: 'PATCH', body: { status: s, ...(catatanHasil ? { catatanHasil } : {}) } }), setGalat, muat) }}>→ {STATUS[s]}</button>)}</div>
        </div>
      ))}
    </div>
  )
}

export default function Kaizen() {
  const [sub, setSub] = useState('eksekutif')
  const TAB = [['eksekutif', 'Ringkasan kinerja'], ['omzet', 'Omset tahunan'], ['siklus', 'Kecepatan & ketepatan waktu'], ['tindakan', 'Rencana perbaikan']]
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'eksekutif' && <Eksekutif />}
      {sub === 'omzet' && <Omzet />}
      {sub === 'siklus' && <Siklus />}
      {sub === 'tindakan' && <Tindakan />}
    </div>
  )
}
