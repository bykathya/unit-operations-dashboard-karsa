import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { formatRp, tanggalPendek } from './format'
import { PilihKategori } from './Pilihan'

// DATA INDUK FREELANCER (10 Nov 2026, masukan tim): diisi lebih dulu; daftar ini jadi pilihan nama freelance di order & LTK.
// Nomor rekening hanya tampil tersamar (4 digit terakhir); mengganti = ketik ulang seluruhnya.
// Per unit (13 Nov 2026, masukan tim): bawaan hanya unit ini; "Bagikan ke unit lain" = tampil di unit lain se-circle (tanpa rekening & fee).
const KOSONG = { nama: '', kontak: '', skill: '', tautanPorto: '', bank: '', atasNamaRekening: '', noRekening: '', catatan: '', bagikan: false }

function Form({ studioId, lingkup, awal, onSelesai, onBatal }) {
  const [f, setF] = useState(awal ? { ...KOSONG, ...awal, noRekening: '', tautanPorto: awal.tautanPorto ?? '', skill: awal.skill ?? '' } : KOSONG)
  const [galat, setGalat] = useState('')
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const kirim = async (e) => {
    e.preventDefault(); setGalat('')
    try {
      const body = { studioId, ...f }
      if (awal) await api(`/api/circle/freelancer/${awal.id}`, { method: 'PATCH', body })
      else await api('/api/circle/freelancer', { method: 'POST', body })
      onSelesai()
    } catch (er) { setGalat(er.message) }
  }
  return (
    <form className="panel" onSubmit={kirim} style={{ marginBottom: 12 }}>
      <h3 className="judul-bagian">{awal ? `Ubah ${awal.nama}` : 'Tambah freelancer'}</h3>
      {galat && <div className="galat">{galat}</div>}
      <div className="dua">
        <label>Nama<input value={f.nama} onChange={ubah('nama')} required maxLength={120} /></label>
        <label>No. HP / WA<input value={f.kontak ?? ''} onChange={ubah('kontak')} maxLength={60} inputMode="tel" /></label>
        <label>Bank<input value={f.bank ?? ''} onChange={ubah('bank')} maxLength={60} placeholder="mis. BCA, BRI, DANA" /></label>
        <label>Atas nama rekening<input value={f.atasNamaRekening ?? ''} onChange={ubah('atasNamaRekening')} maxLength={120} /></label>
        <label>No. rekening{awal?.adaRekening && <span className="redup kecil"> (tersimpan {awal.rekening} — kosongkan bila tidak diganti)</span>}<input value={f.noRekening} onChange={ubah('noRekening')} inputMode="numeric" maxLength={40} autoComplete="off" /></label>
        <label>Drive portofolio<input value={f.tautanPorto} onChange={ubah('tautanPorto')} placeholder="https://drive.google.com/…" maxLength={500} /></label>
      </div>
      <div className="isian">Keahlian / skill (boleh lebih dari satu)<PilihKategori studioId={studioId} value={f.skill} onChange={v => setF({ ...f, skill: v })} /></div>
      <label>Catatan<input value={f.catatan ?? ''} onChange={ubah('catatan')} maxLength={500} /></label>
      <label className="centang"><input type="checkbox" checked={!!f.bagikan} onChange={e => setF({ ...f, bagikan: e.target.checked })} /> Bagikan ke unit lain di {lingkup ?? 'circle ini'} <span className="redup kecil">— nama, no. HP, keahlian & porto terlihat unit lain (rekening & fee tidak). Jangan dicentang bila freelancer tidak mau dimunculkan.</span></label>
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama">Simpan</button></div>
    </form>
  )
}

export default function Freelancer({ studioId, lingkup }) {
  const [daftar, setDaftar] = useState(null), [galat, setGalat] = useState(''), [form, setForm] = useState(null), [cari, setCari] = useState('')
  const muat = useCallback(() => { api(`/api/circle/freelancer?studioId=${studioId}`).then(d => { setDaftar(d); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId])
  useEffect(() => { setDaftar(null); muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!daftar) return <div className="redup tengah">Memuat…</div>
  const kata = cari.trim().toLowerCase()
  const tampil = daftar.filter(f => !kata || [f.nama, f.skill, f.kontak].some(x => String(x ?? '').toLowerCase().includes(kata)))
  const tutup = () => { setForm(null); muat() }
  return (
    <div>
      {form && <Form key={form === 'baru' ? 'baru' : form.id} studioId={studioId} lingkup={lingkup} awal={form === 'baru' ? null : form} onSelesai={tutup} onBatal={() => setForm(null)} />}
      <div className="panel">
        <div className="toolbar">
          <input className="cari" placeholder="Cari nama, keahlian, atau no. HP…" value={cari} onChange={e => setCari(e.target.value)} />
          <button className="btn utama" onClick={() => setForm('baru')}>+ Tambah freelancer</button>
        </div>
        <p className="redup kecil">Isi data freelancer di sini dulu — daftar ini yang muncul sebagai pilihan saat mengisi order. Freelancer hanya terlihat di unit ini, kecuali dicentang "Bagikan ke unit lain" (unit lain di {lingkup} lalu bisa memakainya, tanpa rekening & fee). Order & total fee = order unit ini saja. Nomor rekening hanya tampil 4 digit terakhir.</p>
        {tampil.length === 0 ? <div className="kosong">{daftar.length ? 'Tidak ada yang cocok.' : 'Belum ada freelancer. Klik "+ Tambah freelancer".'}</div> : (
          <div style={{ overflowX: 'auto' }}><table>
            <thead><tr><th>Nama</th><th>No. HP</th><th>Keahlian</th><th>Rekening</th><th>Porto</th><th className="kanan">Order</th><th className="kanan">Total fee</th><th>Terakhir</th><th /></tr></thead>
            <tbody>{tampil.map(f => (
              <tr key={f.id}>
                <td><b>{f.nama}</b>{!f.aktif && <span className="lencana"> nonaktif</span>}{f.milik ? (f.bagikan && <span className="lencana" title="Terlihat juga di unit lain se-circle"> dibagikan</span>) : <div className="redup kecil">dari {f.dariUnit}</div>}</td>
                <td>{f.kontak ?? '—'}</td>
                <td>{f.skill ?? '—'}</td>
                <td>{f.adaRekening ? <span>{f.bank ?? ''} {f.rekening}{f.atasNamaRekening ? <span className="redup kecil"> · {f.atasNamaRekening}</span> : null}</span> : '—'}</td>
                <td>{f.tautanPorto ? <a href={f.tautanPorto} target="_blank" rel="noreferrer noopener">buka</a> : '—'}</td>
                <td className="kanan">{f.jumlahOrder}</td><td className="kanan">{formatRp(f.totalFee)}</td><td>{f.terakhir ? tanggalPendek(f.terakhir) : '—'}</td>
                <td className="kanan">{f.milik && <><button className="btn kecil" onClick={() => setForm(f)}>ubah</button> <button className="btn kecil" onClick={() => api(`/api/circle/freelancer/${f.id}`, { method: 'PATCH', body: { studioId, aktif: !f.aktif } }).then(muat).catch(e => setGalat(e.message))}>{f.aktif ? 'nonaktifkan' : 'aktifkan'}</button> <button className="btn kecil" title="Hapus dari daftar (riwayat order tetap)" onClick={() => confirm(`Hapus ${f.nama} dari daftar freelancer?${f.jumlahOrder ? `\n\nNamanya di ${f.jumlahOrder} order tetap tercatat — riwayat, fee & pembayaran tidak berubah.` : ''}\n\nTidak bisa dibatalkan.`) && api(`/api/circle/freelancer/${f.id}?studioId=${studioId}`, { method: 'DELETE' }).then(muat).catch(e => setGalat(e.message))}>hapus</button></>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
