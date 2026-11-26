import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { hariIniLokal } from '../api-util'
import { PilihCari } from '../Pilihan'

const KPI = [['post', 'Post'], ['reply', 'Komen/Reply'], ['update', 'Update'], ['seo', 'SEO']]
const KOSONG = { jenis: 'publish_post', judul: '', platform: '', akunId: '', link: '', jamPosting: '', targetAkun: '', pengikut: '', jumlah: 1, catatan: '', klienId: '', hasil: '' }

function FormAktivitas({ d, tanggal, studioId, onSimpan, onTutup }) {
  const [baris, setBaris] = useState([{ ...KOSONG }])
  const [galat, setGalat] = useState([])
  const [pesan, setPesan] = useState('')
  const [proses, setProses] = useState(false)
  const def = (j) => d.katalog.find(k => k.kunci === j)
  const ubah = (i, p) => setBaris(b => b.map((x, n) => (n === i ? { ...x, ...p } : x)))
  const g = (i, f) => galat.find(x => x.baris === i + 1 && x.field === f)?.pesan
  const platformDari = (j) => { const l = def(j)?.lingkup; return l === 'marketing' ? d.platform.sosmed : l === 'marketplace' ? d.platform.akun : [...d.platform.sosmed, ...d.platform.akun] }
  const grup = useMemo(() => Object.entries(d.tahapAktivitas).map(([k, label]) => [label, d.katalog.filter(x => x.tahap === k)]), [d])
  // Follow up klien lama (24 Nov 2026, masukan tim): klien dipilih dari direktori Klien unit
  const [klien, setKlien] = useState(null)
  const perluKlien = baris.some(b => def(b.jenis)?.butuhKlien)
  useEffect(() => { if (perluKlien && !klien) api(`/api/circle/klien?studioId=${studioId}`).then(x => setKlien(x.klien)).catch(() => setKlien([])) }, [perluKlien, klien, studioId])
  const labelKlien = (k) => (k.panggilan ? `${k.nama} (${k.panggilan})` : k.nama)

  async function kirim(e) {
    e.preventDefault(); setProses(true); setGalat([]); setPesan('')
    const items = baris.map(b => { const x = { ...b, jumlah: Number(b.jumlah) || 1 }; Object.keys(x).forEach(k => x[k] === '' && delete x[k]); if (x.pengikut !== undefined) x.pengikut = Number(x.pengikut); return x })
    try { await api('/api/circle/marketing/aktivitas', { method: 'POST', body: { studioId, tanggal, items } }); onSimpan() }
    catch (err) { setPesan(err.message); if (err.galat) setGalat(err.galat); setProses(false) }
  }

  return (
    <div className="modal-latar" onClick={onTutup}>
      <form className="modal lebar" onClick={e => e.stopPropagation()} onSubmit={kirim}>
        <h3>Tambah aktivitas · {tanggal}</h3>
        {d.akun.length === 0 && baris.some(b => def(b.jenis)?.butuhAkun) && <div className="galat" style={{ marginBottom: 10 }}>Belum ada akun yang ditugaskan padamu. Minta koordinator menugaskan akun (tab Rencana).</div>}
        {baris.map((b, i) => {
          const df = def(b.jenis)
          return (
            <div key={i} className="aktivitas-form">
              <div className="dua">
                <label>Jenis
                  <select value={b.jenis} onChange={e => ubah(i, { jenis: e.target.value, platform: '' })}>
                    {grup.map(([label, daftar]) => <optgroup key={label} label={label}>{daftar.map(k => <option key={k.kunci} value={k.kunci}>{k.label}</option>)}</optgroup>)}
                  </select>
                </label>
                {df.butuhKlien ? <div className="isian">Klien (dari direktori Klien)
                  {b.klienId ? <div className="chips" style={{ margin: 0 }}><b>{labelKlien(klien?.find(k => k.id === b.klienId) ?? { nama: '…' })}</b><button type="button" className="btn kecil" onClick={() => ubah(i, { klienId: '' })}>ganti</button></div>
                    : <PilihCari pilihan={(klien ?? []).map(labelKlien)} placeholder={klien ? 'ketik nama klien…' : 'memuat klien…'} onPilih={l => { const k = (klien ?? []).find(x => labelKlien(x) === l); if (k) ubah(i, { klienId: k.id }) }} kosong="Tidak ada — tambahkan dulu di menu Klien" />}
                  {g(i, 'klienId') && <em className="galat-f">{g(i, 'klienId')}</em>}</div>
                : <label>{b.jenis === 'lainnya' ? 'Nama aktivitas' : 'Judul / deskripsi'}<input value={b.judul} placeholder={b.jenis === 'lainnya' ? 'mis. Riset tren, Bikin mockup katalog' : ''} onChange={e => ubah(i, { judul: e.target.value })} />{g(i, 'judul') && <em className="galat-f">{g(i, 'judul')}</em>}</label>}
              </div>
              {df.butuhKlien && <div className="dua">
                <label>Lewat<select value={b.platform} onChange={e => ubah(i, { platform: e.target.value })}><option value="">— pilih —</option>{platformDari(b.jenis).map(p => <option key={p}>{p}</option>)}</select></label>
                <label>Respon klien / hasil<input value={b.hasil} maxLength={300} placeholder="mis. belum dibalas, tertarik, minta pricelist" onChange={e => ubah(i, { hasil: e.target.value })} /></label>
              </div>}
              {df.butuhAkun && (
                <div className="dua">
                  <label>Akun<select value={b.akunId} onChange={e => ubah(i, { akunId: e.target.value })}><option value="">— pilih akun —</option>{d.akun.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select>{g(i, 'akunId') && <em className="galat-f">{g(i, 'akunId')}</em>}</label>
                  <label>Platform<select value={b.platform} onChange={e => ubah(i, { platform: e.target.value })}><option value="">— pilih —</option>{platformDari(b.jenis).map(p => <option key={p}>{p}</option>)}</select>{g(i, 'platform') && <em className="galat-f">{g(i, 'platform')}</em>}</label>
                </div>
              )}
              {df.butuhAkun && <label>Link<input value={b.link} placeholder="https://…" onChange={e => ubah(i, { link: e.target.value })} />{g(i, 'link') && <em className="galat-f">{g(i, 'link')}</em>}</label>}
              <div className="dua">
                {df.tahap === 'publish' && <label>Jam posting<input type="time" value={b.jamPosting} onChange={e => ubah(i, { jamPosting: e.target.value })} />{g(i, 'jamPosting') && <em className="galat-f">{g(i, 'jamPosting')}</em>}</label>}
                {df.tahap === 'engage' && <label>Akun yang dikomen<input value={b.targetAkun} placeholder="@nama" onChange={e => ubah(i, { targetAkun: e.target.value })} />{g(i, 'targetAkun') && <em className="galat-f">{g(i, 'targetAkun')}</em>}</label>}
                {df.tahap === 'engage' && <label>Jumlah follower akun itu<input inputMode="numeric" value={b.pengikut} onChange={e => ubah(i, { pengikut: e.target.value.replace(/[^\d]/g, '') })} />{g(i, 'pengikut') && <em className="galat-f">{g(i, 'pengikut')}</em>}</label>}
                <label>Jumlah (kali)<input inputMode="numeric" value={b.jumlah} onChange={e => ubah(i, { jumlah: e.target.value.replace(/[^\d]/g, '') })} /><span className="redup kecil">Berapa kali aktivitas yang sama ini dilakukan hari itu — mis. 5 reply ke akun berbeda = 5. Isi 1 bila sekali.</span></label>
              </div>
              {baris.length > 1 && <button type="button" className="btn kecil" onClick={() => setBaris(x => x.filter((_, n) => n !== i))}>Hapus baris</button>}
            </div>
          )
        })}
        <button type="button" className="btn kecil" onClick={() => setBaris(b => [...b, { ...KOSONG }])}>+ Tambah baris</button>
        {pesan && <div className="galat" style={{ marginTop: 10 }}>{pesan}</div>}
        <div className="modal-aksi"><button type="button" className="btn" onClick={onTutup}>Batal</button><button className="btn utama" disabled={proses || (d.akun.length === 0 && baris.some(b => def(b.jenis)?.butuhAkun))}>{proses ? 'Menyimpan…' : `Simpan ${baris.length} aktivitas`}</button></div>
      </form>
    </div>
  )
}

export default function MkAktivitas({ studioId }) {
  const [tanggal, setTanggal] = useState(hariIniLokal())
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [form, setForm] = useState(false)
  const muat = useCallback(() => api(`/api/circle/marketing/ruang?studioId=${studioId}&tanggal=${tanggal}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, tanggal])
  useEffect(() => { muat() }, [muat])

  async function centang(a) { try { await api(`/api/circle/marketing/aktivitas/${a.id}`, { method: 'PATCH', body: { selesai: !a.selesai } }) } catch (e) { alert(e.message) } muat() }
  async function hapus(a) { if (!window.confirm('Hapus aktivitas ini?')) return; try { await api(`/api/circle/marketing/aktivitas/${a.id}`, { method: 'DELETE' }) } catch (e) { alert(e.message) } muat() }
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat…</div>
  const label = (j) => d.katalog.find(k => k.kunci === j)?.label ?? j
  const selesai = d.aktivitas.filter(a => a.selesai).length
  return (
    <>
      <div className="toolbar">
        <input type="date" value={tanggal} max={hariIniLokal()} onChange={e => setTanggal(e.target.value)} style={{ maxWidth: 170 }} />
        <button className="btn utama" onClick={() => setForm(true)}>+ Tambah aktivitas</button>
        <span className="redup kecil">{selesai} dari {d.aktivitas.length} selesai hari ini</span>
      </div>
      <div className="ringkasan">
        {KPI.map(([k, l]) => <div key={k} className="stat"><span className="redup kecil">{l} (bulan ini)</span><b>{d.kpiBulanIni[k] ?? 0}</b></div>)}
      </div>
      <div className="panel">
        <h3 className="judul-bagian">Aktivitas {tanggal}</h3>
        {d.aktivitas.length === 0 && <div className="kosong">Belum ada aktivitas di tanggal ini.</div>}
        {d.aktivitas.map(a => (
          <div key={a.id} className={'tugas' + (a.selesai ? ' selesai' : '')}>
            <label className="centang"><input type="checkbox" checked={a.selesai} onChange={() => centang(a)} />
              <span><strong>{label(a.jenis)}</strong> — {a.klien ?? a.judul}<span className="redup kecil"> {a.akun ? `· ${a.akun.platform} ${a.akun.namaAkun}` : a.platform ? `· ${a.platform}` : ''}{a.jamPosting ? ` · ${a.jamPosting}` : ''}{a.targetAkun ? ` · ${a.targetAkun}` : ''}{a.jumlah > 1 ? ` · ×${a.jumlah}` : ''}</span></span>
            </label>
            <div className="tugas-kanan">{a.link && <a className="tautan-k" href={a.link} target="_blank" rel="noreferrer noopener">buka ↗</a>}<button className="btn kecil" onClick={() => hapus(a)}>✕</button></div>
          </div>
        ))}
      </div>
      {form && <FormAktivitas d={d} tanggal={tanggal} studioId={studioId} onTutup={() => setForm(false)} onSimpan={() => { setForm(false); muat() }} />}
    </>
  )
}
