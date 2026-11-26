import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { hariIniLokal, NAMA_BULAN, bulanSekarang, geserBulan } from './api-util'
import { formatRp } from './format'
import { useSegarkan } from './realtime'

// CATATAN PEMASUKAN (Karsa Circle, 26 Nov 2026): pengganti alur tahapan order untuk studio yang hanya ingin mencatat
// tanggal, jasa, akun jualan, nominal (USD), dan siapa yang mengerjakan. Data tetap disimpan sebagai order (langsung Selesai) di server.
const A = '/api/circle/pemasukan'
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }))
const tgl = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
const kunciBulan = ({ bulan, tahun }) => `${tahun}-${String(bulan).padStart(2, '0')}`

export default function Pemasukan({ studioId }) {
  const [periode, setPeriode] = useState(bulanSekarang)
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [form, setForm] = useState(false), [kirim, setKirim] = useState(false)
  const kosong = { tanggal: hariIniLokal(), jasa: '', akunId: '', nilaiUsd: '', kurs: '', talentUserId: '', klien: '', lunas: true }
  const [f, setF] = useState(kosong)

  const muat = useCallback(() => api(`${A}?studioId=${studioId}&bulan=${kunciBulan(periode)}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, periode])
  useEffect(() => { muat() }, [muat])
  useSegarkan(muat, ['pemasukan'])

  const aksi = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(e.message) } }
  const bukaForm = () => { setF({ ...kosong, kurs: String(d?.pilihan.kursBawaan ?? '') }); setForm(true) }
  const simpan = (e) => {
    e.preventDefault(); if (kirim) return
    setKirim(true)
    aksi(async () => {
      await api(A, { method: 'POST', body: { studioId, ...f, nilaiUsd: Number(f.nilaiUsd), kurs: Number(f.kurs) } })
      setForm(false)
    }).finally(() => setKirim(false))
  }
  const aturLunas = (b) => aksi(() => api(`${A}/${b.id}/lunas`, { method: 'PATCH', body: { lunas: !b.lunas } }))
  const hapus = (b) => { if (window.confirm(`Hapus catatan ${b.jasa} (${usd(b.nilaiUsd)})?`)) aksi(() => api(`${A}/${b.id}`, { method: 'DELETE' })) }

  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const rpKira = f.nilaiUsd && f.kurs ? Number(f.nilaiUsd) * Number(f.kurs) : null

  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, -1))} aria-label="Bulan sebelumnya">‹</button>
        <b>{NAMA_BULAN[periode.bulan - 1]} {periode.tahun}</b>
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, 1))} aria-label="Bulan berikutnya">›</button>
        {d.bolehUbah && !form && <button className="btn utama" style={{ marginLeft: 'auto' }} onClick={bukaForm}>+ Catat pemasukan</button>}
      </div>

      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Pemasukan bulan ini</span><b>{usd(d.ringkasan.totalUsd)}</b></div>
        <div className="stat"><span className="redup kecil">Sudah lunas</span><b>{usd(d.ringkasan.lunasUsd)}</b></div>
        <div className="stat"><span className="redup kecil">Jumlah order</span><b>{d.ringkasan.jumlah}</b></div>
      </div>

      {form && (
        <form className="panel" style={{ marginBottom: 14 }} onSubmit={simpan}>
          <div className="dua">
            <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
            <label>Jasa<input list="jasa-pemasukan" value={f.jasa} onChange={e => setF({ ...f, jasa: e.target.value })} required maxLength={40} placeholder="mis. Original Song" /><datalist id="jasa-pemasukan">{d.pilihan.jasa.map(j => <option key={j} value={j} />)}</datalist></label>
            <label>Akun jualan<select value={f.akunId} onChange={e => setF({ ...f, akunId: e.target.value })} required><option value="">— pilih —</option>{d.pilihan.akun.map(a => <option key={a.id} value={a.id}>{a.nama}{a.feePersen ? ` (potongan ${a.feePersen}%)` : ''}</option>)}<option value="INTERNAL">Order internal (tanpa platform)</option></select></label>
            <label>Nominal (USD)<input type="number" min="0.01" step="0.01" value={f.nilaiUsd} onChange={e => setF({ ...f, nilaiUsd: e.target.value })} required /></label>
            <label>Dikerjakan oleh<select value={f.talentUserId} onChange={e => setF({ ...f, talentUserId: e.target.value })} required><option value="">— pilih —</option>{d.pilihan.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
            <label>Kurs (Rp per 1 USD)<input type="number" min="1000" max="100000" step="1" value={f.kurs} onChange={e => setF({ ...f, kurs: e.target.value })} required /></label>
            <label>Nama klien (opsional)<input value={f.klien} onChange={e => setF({ ...f, klien: e.target.value })} maxLength={200} /></label>
          </div>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={f.lunas} onChange={e => setF({ ...f, lunas: e.target.checked })} /> Klien sudah bayar lunas</label>
          <div className="redup kecil">{rpKira ? `≈ ${formatRp(rpKira)}. ` : ''}Kurs dipakai untuk menghitung gaji dan laporan dalam Rupiah; isian bawaan = kurs catatan terakhir.{d.pilihan.akun.length === 0 ? ' Belum ada akun jualan: tambahkan dulu di menu Akun jualan, atau pilih Order internal.' : ''}</div>
          <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(false)}>Batal</button><button className="btn utama" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Simpan'}</button></div>
        </form>
      )}

      {d.baris.length === 0 ? <div className="kosong">Belum ada pemasukan di bulan ini.</div> : (
        <table>
          <thead><tr><th>Tanggal</th><th>Jasa</th><th>Akun</th><th>Dikerjakan oleh</th><th className="kanan">Nominal</th><th>Bayar</th>{d.bolehUbah && <th />}</tr></thead>
          <tbody>
            {d.baris.map(b => (
              <tr key={b.id}>
                <td>{tgl(b.tanggal)}</td>
                <td>{b.jasa}{b.klien && b.klien !== 'Klien' && <div className="redup kecil">{b.klien}</div>}</td>
                <td>{b.akun}</td>
                <td>{b.dikerjakan.join(', ') || '—'}</td>
                <td className="kanan">{usd(b.nilaiUsd)}</td>
                <td>{d.bolehUbah
                  ? <button className="btn kecil" onClick={() => aturLunas(b)} title="Klik untuk mengubah">{b.lunas ? '✓ Lunas' : 'Belum lunas'}</button>
                  : (b.lunas ? '✓ Lunas' : 'Belum lunas')}</td>
                {d.bolehUbah && <td className="kanan"><button className="btn kecil" onClick={() => hapus(b)}>Hapus</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {d.ringkasan.perOrang.length > 0 && (
        <>
          <h3 className="judul-bagian" style={{ marginTop: 18 }}>Per orang bulan ini</h3>
          <table>
            <thead><tr><th>Nama</th><th className="kanan">Order</th><th className="kanan">Nominal</th></tr></thead>
            <tbody>{d.ringkasan.perOrang.map(o => <tr key={o.nama}><td>{o.nama}</td><td className="kanan">{o.order}</td><td className="kanan">{usd(o.nilaiUsd)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  )
}
