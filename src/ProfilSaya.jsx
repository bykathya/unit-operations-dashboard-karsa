import { useEffect, useState } from 'react'
import { api } from './api'
import Stiker from './Stiker'

// PROFIL SAYA (Karsa Circle, tahap 6, 26 Nov 2026): anggota mengisi "Tentang aku" sendiri (semua boleh kosong) yang tampil di kartu Tim.
// Data resmi (nama, kontak, rekening) hanya ditampilkan — diubah Koordinator di web pusat › SDM. Rekening hanya 4 digit akhir di layar.
const STATUS = { JOMBLO: 'Jomblo', TAKEN: 'Taken', RAHASIA: 'Rahasia' }

export default function ProfilSaya() {
  const [d, setD] = useState(null), [f, setF] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState(''), [kirim, setKirim] = useState(false)
  useEffect(() => { api('/api/circle/profil-saya').then(x => { setD(x); setF(x.tentang) }).catch(e => setGalat(e.message)) }, [])
  if (!d || !f) return <div className="redup">{galat || 'Memuat…'}</div>
  const ubah = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setInfo('') }
  const simpan = async (e) => {
    e.preventDefault(); setKirim(true); setGalat(''); setInfo('')
    try { await api('/api/circle/profil-saya', { method: 'PUT', body: f }); setInfo('Tersimpan. Kartu Tim-mu sudah diperbarui.') } catch (er) { setGalat(er.message) } finally { setKirim(false) }
  }
  const r = d.resmi
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
      <form className="panel" onSubmit={simpan}>
        <div className="meta" style={{ justifyContent: 'space-between' }}><h3 className="judul-bagian" style={{ margin: 0 }}>Tentang aku</h3><Stiker nama={r.nama} ukuran={64} alt="" /></div>
        <p className="redup kecil">Tampil di kartu Tim. Semua boleh dikosongkan.</p>
        <div className="dua">
          <label style={{ gridColumn: '1 / -1' }}>Tautan foto<input type="url" value={f.fotoUrl} onChange={ubah('fotoUrl')} placeholder="https://… (mis. dari Google Drive atau Instagram)" maxLength={500} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Bio singkat<textarea rows={3} value={f.bio} onChange={ubah('bio')} maxLength={300} placeholder="Ceritakan dirimu dalam 1–2 kalimat" /></label>
          <label>Keahlian<input value={f.keahlian} onChange={ubah('keahlian')} maxLength={200} placeholder="mis. BGM, mixing" /></label>
          <label>Paling aktif<input value={f.jamAktif} onChange={ubah('jamAktif')} maxLength={60} placeholder="mis. malam, 20.00–02.00" /></label>
          <label>Zodiak<select value={f.zodiak} onChange={ubah('zodiak')}><option value="">—</option>{d.pilihan.zodiak.map(z => <option key={z}>{z}</option>)}</select></label>
          <label>Ulang tahun (HH-BB)<input value={f.ulangTahun} onChange={ubah('ulangTahun')} placeholder="21-03" pattern="(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])" maxLength={5} /></label>
          <label>Status<select value={f.status} onChange={ubah('status')}><option value="">—</option>{d.pilihan.status.map(s => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
          <label>Instagram<input value={f.instagram} onChange={ubah('instagram')} maxLength={60} placeholder="@username" /></label>
        </div>
        {galat && <div className="galat blok">{galat}</div>}
        {info && <div role="status" className="chip" style={{ marginTop: 8 }}>{info}</div>}
        <div className="modal-aksi"><button className="btn utama" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
      <div className="panel">
        <h3 className="judul-bagian">Data resmi</h3>
        <p className="redup kecil">Diisi koordinator. Kalau ada yang salah, hubungi koordinator studiomu.</p>
        {[['Nama', r.nama], ['Posisi', r.posisi], ['Email', r.email], ['Nomor HP', r.nomorWa], ['Tanggal lahir', r.tanggalLahir ? new Date(r.tanggalLahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null], ['Rekening', r.rekening4 ? `${r.bank ?? ''} ••••${r.rekening4} · ${r.atasNama ?? r.nama}` : null]].map(([l, v]) => (
          <div key={l} className="meta" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}><span className="redup">{l}</span><span>{v || <span className="redup">—</span>}</span></div>
        ))}
        {d.ndaUrl && <a className="btn kecil" style={{ marginTop: 10 }} href={d.ndaUrl} target="_blank" rel="noopener noreferrer">Buka NDA-ku</a>}
      </div>
    </div>
  )
}
