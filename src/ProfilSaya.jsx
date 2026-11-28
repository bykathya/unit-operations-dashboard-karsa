import { useEffect, useState } from 'react'
import { api } from './api'
import Stiker from './Stiker'

// PROFIL SAYA (Karsa Circle, tahap 6, 26 Nov 2026): anggota mengisi "Tentang aku" sendiri (semua boleh kosong) yang tampil di kartu Tim.
// Data resmi (nama, kontak, rekening) hanya ditampilkan — diubah Koordinator di web pusat › SDM. Rekening hanya 4 digit akhir di layar.
// Nomor WhatsApp diisi sendiri dan langsung masuk data HR (28 Nov 2026).
const STATUS = { JOMBLO: 'Jomblo', TAKEN: 'Taken', RAHASIA: 'Rahasia' }

export default function ProfilSaya() {
  const [d, setD] = useState(null), [f, setF] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState(''), [kirim, setKirim] = useState(false)
  useEffect(() => { api('/api/circle/profil-saya').then(x => { setD(x); setF({ ...x.tentang, nomorWa: x.resmi.nomorWa ?? '' }) }).catch(e => setGalat(e.message)) }, [])
  if (!d || !f) return <div className="redup">{galat || 'Memuat…'}</div>
  const ubah = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setInfo('') }
  const simpan = async (e) => {
    e.preventDefault(); setKirim(true); setGalat(''); setInfo('')
    try { await api('/api/circle/profil-saya', { method: 'PUT', body: f }); setD({ ...d, resmi: { ...d.resmi, nomorWa: f.nomorWa || null } }); setInfo('Tersimpan. Kartu Tim dan data HR-mu sudah diperbarui.') } catch (er) { setGalat(er.message) } finally { setKirim(false) }
  }
  const r = d.resmi
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
      <form className="panel" onSubmit={simpan}>
        <div className="meta" style={{ justifyContent: 'space-between' }}><h3 className="judul-bagian" style={{ margin: 0 }}>Tentang aku</h3><Stiker nama={r.nama} ukuran={64} alt="" /></div>
        <p className="redup kecil">Tampil di kartu Tim. Semua boleh dikosongkan.</p>
        <div className="dua">
          <label style={{ gridColumn: '1 / -1' }}>Nomor WhatsApp<input type="tel" inputMode="tel" value={f.nomorWa} onChange={ubah('nomorWa')} maxLength={30} placeholder="08…" /><small className="redup">Otomatis masuk ke data HR, supaya koordinator bisa menghubungimu</small></label>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel">
        <h3 className="judul-bagian">Data resmi</h3>
        <p className="redup kecil">Diisi koordinator. Kalau ada yang salah, hubungi koordinator studiomu.</p>
        {[['Nama', r.nama], ['Posisi', r.posisi], ['Email', r.email], ['WhatsApp', r.nomorWa], ['Tanggal lahir', r.tanggalLahir ? new Date(r.tanggalLahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : null], ['Rekening', r.rekening4 ? `${r.bank ?? ''} ••••${r.rekening4} · ${r.atasNama ?? r.nama}` : null]].map(([l, v]) => (
          <div key={l} className="meta" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}><span className="redup">{l}</span><span>{v || <span className="redup">—</span>}</span></div>
        ))}
        {d.ndaUrl && <a className="btn kecil" style={{ marginTop: 10 }} href={d.ndaUrl} target="_blank" rel="noopener noreferrer">Buka NDA-ku</a>}
      </div>
      {d.kerja && <DataKerja k={d.kerja} dok={d.dokumen} />}
      </div>
    </div>
  )
}

// Data kerja & dokumen (HR & Database, 28 Nov 2026): diisi Koordinator di web pusat; di sini hanya dilihat.
const DOK = [['KTP', 'Foto KTP'], ['NDA', 'Kontrak NDA'], ['SKCK', 'SKBB / SKCK'], ['BANK', 'Buku Rekening']]
const tgl = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null)
function DataKerja({ k, dok }) {
  const hari = new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z')
  const sisa = k.kontrakAkhir ? Math.ceil((new Date(k.kontrakAkhir) - hari) / 864e5) : null
  const n = DOK.filter(([j]) => dok?.[j]).length
  const baris = [['Studio', k.studio.join(', ')], ['Peran', k.peran.join(', ')], ['Bergabung', tgl(k.tanggalMasuk)], ['Kontrak', k.kontrakMulai || k.kontrakAkhir ? `${tgl(k.kontrakMulai) ?? '…'} – ${tgl(k.kontrakAkhir) ?? '…'}` : null], ...(sisa != null ? [['Sisa kontrak', sisa < 0 ? 'Sudah berakhir' : `${sisa} hari`]] : [])]
  return (
    <>
      <div className="panel">
        <h3 className="judul-bagian">Data kerja saya</h3>
        <p className="redup kecil">Diisi koordinator. Hubungi koordinator kalau ada yang salah.</p>
        {baris.map(([l, v]) => <div key={l} className="meta" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '6px 0' }}><span className="redup">{l}</span><span>{v || <span className="redup">Belum diisi</span>}</span></div>)}
      </div>
      <div className="panel">
        <div className="meta" style={{ justifyContent: 'space-between' }}><h3 className="judul-bagian" style={{ margin: 0 }}>Dokumen saya</h3><b>{n}/4 lengkap</b></div>
        <div style={{ height: 7, borderRadius: 99, background: 'var(--track)', margin: '8px 0 10px' }}><div style={{ width: `${n * 25}%`, height: '100%', borderRadius: 99, background: 'var(--accent)' }} /></div>
        <div className="dua">{DOK.map(([j, l]) => <div key={j} className="meta" style={{ justifyContent: 'space-between', border: `1px ${dok?.[j] ? 'solid' : 'dashed'} var(--border-hover)`, borderRadius: 10, padding: '8px 10px', background: dok?.[j] ? 'var(--accent-subtle)' : 'transparent' }}><span>{l}</span><b className="kecil">{dok?.[j] ? '✓ Ada' : 'Belum'}</b></div>)}</div>
        <p className="redup kecil" style={{ marginTop: 10 }}>Kirim dokumen yang belum ada ke koordinatormu. Koordinator yang mengunggahnya di web pusat.</p>
      </div>
    </>
  )
}
