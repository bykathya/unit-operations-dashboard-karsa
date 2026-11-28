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
  const r = d.resmi, k = d.kerja
  const tglId = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null)
  const hari = new Date(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z')
  const sisa = k?.kontrakAkhir ? Math.ceil((new Date(k.kontrakAkhir) - hari) / 864e5) : null
  const n = DOK.filter(([j]) => d.dokumen?.[j]).length
  const baris = [
    ...(k ? [['Studio', k.studio.join(', ')], ['Peran', k.peran.join(', ')]] : [['Posisi', r.posisi]]),
    ['WhatsApp', r.nomorWa], ['Bergabung', tglId(k?.tanggalMasuk)],
    ['Kontrak', k && (k.kontrakMulai || k.kontrakAkhir) ? `${tglId(k.kontrakMulai) ?? '…'} – ${tglId(k.kontrakAkhir) ?? '…'}${sisa != null ? (sisa < 0 ? ' (berakhir)' : ` (${sisa} hari lagi)`) : ''}` : null],
    ['Rekening gaji', r.rekening4 ? `${r.bank ?? ''} ••••${r.rekening4} · ${r.atasNama ?? r.nama}` : null],
  ]
  return (
    <div className="kd">
      <p className="sub" style={{ marginTop: 0 }}>WhatsApp dan bio diisi sendiri. Data kerja lainnya dan dokumen diisi koordinator di web pusat; di sini kamu hanya melihatnya.</p>
      <div className="pf-dua">
        <form className="kartu pf-form" onSubmit={simpan}>
          <div className="orang" style={{ gap: 14 }}><span className="pf-foto"><Stiker nama={r.nama} ukuran={72} alt="" foto={f.fotoUrl || r.foto} /></span><div><b style={{ fontFamily: 'var(--font-judul)', fontSize: 18 }}>{r.nama}</b><small>{r.email}</small></div></div>
          <h2 style={{ margin: '18px 0 10px', fontSize: 18 }}>Data diri &amp; bio</h2>
          <div className="dua">
            <label style={{ gridColumn: '1 / -1' }}>Nomor WhatsApp<input type="tel" inputMode="tel" value={f.nomorWa} onChange={ubah('nomorWa')} maxLength={30} placeholder="08…" /><small className="redup">Otomatis masuk ke data HR, supaya koordinator bisa menghubungimu</small></label>
            <label style={{ gridColumn: '1 / -1' }}>Tautan foto (opsional)<input type="url" value={f.fotoUrl} onChange={ubah('fotoUrl')} placeholder="https://… (mis. dari Google Drive atau Instagram)" maxLength={500} /></label>
            <label style={{ gridColumn: '1 / -1' }}>Bio<textarea rows={3} value={f.bio} onChange={ubah('bio')} maxLength={300} placeholder="Ceritakan dirimu dalam 1–2 kalimat" /></label>
            <label>Keahlian<input value={f.keahlian} onChange={ubah('keahlian')} maxLength={200} placeholder="mis. chat klien, admin VGen" /></label>
            <label>Paling aktif<input value={f.jamAktif} onChange={ubah('jamAktif')} maxLength={60} placeholder="mis. malam, 20.00–02.00" /></label>
            <label>Zodiak<select value={f.zodiak} onChange={ubah('zodiak')}><option value="">—</option>{d.pilihan.zodiak.map(z => <option key={z}>{z}</option>)}</select></label>
            <label>Ulang tahun (HH-BB)<input value={f.ulangTahun} onChange={ubah('ulangTahun')} placeholder="21-03" pattern="(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])" maxLength={5} /></label>
            <label>Status<select value={f.status} onChange={ubah('status')}><option value="">—</option>{d.pilihan.status.map(x => <option key={x} value={x}>{STATUS[x]}</option>)}</select></label>
            <label>Instagram<input value={f.instagram} onChange={ubah('instagram')} maxLength={60} placeholder="@username" /></label>
          </div>
          {galat && <div className="galat blok">{galat}</div>}
          {info && <div role="status" className="chip" style={{ marginTop: 10 }}>{info}</div>}
          <div className="baris" style={{ marginTop: 14 }}><button className="tombol p" disabled={kirim}>{kirim ? 'Menyimpan…' : 'Simpan'}</button></div>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="kartu pf-kanan">
            <h2>Data kerja saya</h2>
            <small className="arti">diisi koordinator (kecuali WhatsApp) · hubungi koordinator kalau ada yang salah</small>
            {baris.map(([l, v]) => <div key={l} className="pf-baris"><span>{l}</span><b>{v || 'Belum diisi'}</b></div>)}
            {d.ndaUrl && <a className="tombol k" style={{ marginTop: 12, textDecoration: 'none' }} href={d.ndaUrl} target="_blank" rel="noopener noreferrer">Buka NDA-ku</a>}
          </div>
          <div className="kartu pf-kanan">
            <div className="baris" style={{ justifyContent: 'space-between' }}><h2>Dokumen saya</h2><b>{n}/4 lengkap</b></div>
            <div className="bar" style={{ margin: '10px 0 12px' }}><i style={{ width: `${n * 25}%` }} /></div>
            <div className="pf-dok">{DOK.map(([j, l]) => <div key={j} className={d.dokumen?.[j] ? 'ada' : ''}><span>{l}</span><b>{d.dokumen?.[j] ? '✓ Ada' : 'Belum'}</b></div>)}</div>
            <p className="arti" style={{ marginTop: 10 }}>Kirim dokumen yang belum ada ke koordinatormu. Koordinator yang mengunggahnya di web pusat.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const DOK = [['KTP', 'Foto KTP'], ['NDA', 'Kontrak NDA'], ['SKCK', 'SKBB / SKCK'], ['BANK', 'Buku Rekening']]
