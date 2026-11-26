import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { formatRp, tanggalPendek } from '../format'
import { useAkunOrder, PilihAkun, useKlien, useFreelancer, useKurs, KetKurs, TIPE } from '../FormOrder'
import { InputAngka } from '../Pilihan'

const STATUS = [['DISCUSSING', 'Discussing'], ['FOLLOW_UP', 'Follow up'], ['NEGO', 'Nego'], ['CONVERTED', 'Jadi order'], ['LOST', 'Lost']]
const TUJUAN = { DISCUSSING: ['FOLLOW_UP', 'LOST'], FOLLOW_UP: ['NEGO', 'LOST'], NEGO: ['FOLLOW_UP', 'LOST'], LOST: ['DISCUSSING'] }
const LABEL = Object.fromEntries(STATUS)

// Isian nilai Rupiah ATAU USD × kurs (9 Nov 2026 — marketer banyak menerima order dalam dolar). Nilai disimpan Rupiah hasil konversi; asal USD ikut tercatat.
function IsianNilai({ f, setF, kunciRp, label, kurs }) {
  const rpUsd = Math.round((Number(f.nilaiUsd) || 0) * (Number(f.kurs) || 0))
  return (
    <div>
      <div className="tab-mini" style={{ marginBottom: 2 }}><button type="button" className={f.mataUang !== 'USD' ? 'aktif' : ''} onClick={() => setF({ ...f, mataUang: 'IDR' })}>Rupiah</button><button type="button" className={f.mataUang === 'USD' ? 'aktif' : ''} onClick={() => setF({ ...f, mataUang: 'USD' })}>Dolar (USD)</button></div>
      {f.mataUang === 'USD'
        ? <label>{label} (USD) × kurs<div className="chips"><input inputMode="decimal" style={{ width: 110 }} value={f.nilaiUsd} onChange={e => setF({ ...f, nilaiUsd: e.target.value.replace(/[^\d.]/g, '') })} placeholder="USD" /><span>×</span><input inputMode="numeric" style={{ width: 100 }} value={f.kurs} onChange={e => setF({ ...f, kurs: e.target.value.replace(/[^\d]/g, '') })} title="Kurs Rp per 1 USD" /></div>
            <span className="redup kecil">= {formatRp(rpUsd)}</span><KetKurs k={kurs} /></label>
        : <label>{label} (Rp)<InputAngka terbilang value={f[kunciRp]} onChange={e => setF({ ...f, [kunciRp]: String(e.target.value).replace(/[^\d]/g, '') })} /></label>}
    </div>
  )
}

// Isian prospek = isian Tambah order (13 Nov 2026, masukan tim) — estimasi nilai, bukan nilai disepakati. Dipakai untuk TAMBAH dan UBAH;
// semua isian terbawa saat "Jadikan order" sehingga marketer tinggal melengkapi.
const dariLead = (l) => ({
  judul: l?.judul ?? '', klien: l?.klien ?? '', tipeKlien: l?.tipeKlien ?? 'EKSTERNAL', platform: l?.platform ?? '', akunId: l?.akunId ?? '',
  estimasiNilai: l?.mataUang === 'USD' ? '' : String(l?.estimasiNilai ?? ''), mataUang: l?.mataUang === 'USD' ? 'USD' : 'IDR', nilaiUsd: l?.nilaiUsd ?? '', kurs: l?.kurs ? String(l.kurs) : '',
  deadline: l?.deadline ? String(l.deadline).slice(0, 10) : '', talentUserId: l?.talentUserId ?? (l?.namaFreelance ? '__freelance' : ''), namaFreelance: l?.namaFreelance ?? '',
  kontak: l?.kontak ?? '', catatan: l?.catatan ?? '',
})
const bodyProspek = (f) => ({
  judul: f.judul, klien: f.klien, tipeKlien: f.tipeKlien, platform: f.platform || null, akunId: f.akunId || null, kontak: f.kontak, catatan: f.catatan,
  deadline: f.deadline || null, talentUserId: f.talentUserId && f.talentUserId !== '__freelance' ? f.talentUserId : null, namaFreelance: f.talentUserId === '__freelance' ? f.namaFreelance : null,
  ...(f.mataUang === 'USD' ? { mataUang: 'USD', nilaiUsd: Number(f.nilaiUsd), kurs: Number(f.kurs) } : { mataUang: 'IDR', estimasiNilai: f.estimasiNilai }),
})

function IsianOrder({ f, setF, studioId, akun, platform, talent, kunciNilai = 'estimasiNilai', labelNilai = 'Estimasi nilai', akunWajib = false }) {
  const klienDir = useKlien(studioId)
  const freelancer = useFreelancer(studioId)
  const kurs = useKurs(studioId, setF)
  // 13 Nov 2026 (masukan tim): chat di inbox akun marketplace = platform akun itu → "Chat masuk lewat" ikut terisi saat akun dipilih,
  // kecuali marketer sudah mengisinya dengan kanal lain (DM IG/Discord/WA). Isian tetap ada: sumber prospek yang belum punya akun jualan.
  const platformAkun = (id) => (akun ?? []).find(a => a.id === id)?.platform
  const pilihAkun = (id) => {
    const lama = platformAkun(f.akunId), baru = platformAkun(id)
    const ikut = platform && baru && platform.includes(baru) && (!f.platform || f.platform === lama)
    setF({ ...f, akunId: id, ...(ikut ? { platform: baru } : {}) })
  }
  return (
    <>
      <label>Judul / nama karakter<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} placeholder="boleh dikosongkan dulu" /></label>
      <div className="dua">
        <label>Klien / akun klien<input list="daftar-klien-prospek" value={f.klien} onChange={e => setF({ ...f, klien: e.target.value })} required autoComplete="off" placeholder="ketik untuk mencari klien yang sudah ada" />
          <datalist id="daftar-klien-prospek">{klienDir.map(k => <option key={k.id} value={k.nama}>{[k.panggilan, k.asal, k.jumlahOrder ? `${k.jumlahOrder}× order` : null].filter(Boolean).join(' · ')}</option>)}</datalist></label>
        <label>Jenis klien<select value={f.tipeKlien} onChange={e => setF({ ...f, tipeKlien: e.target.value })}>{TIPE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></label>
      </div>
      <div className="dua">
        {akunWajib
          ? <PilihAkun akun={akun} value={f.akunId} onChange={v => setF({ ...f, akunId: v })} />
          : <label>Akun jualan<select value={f.akunId} onChange={e => pilihAkun(e.target.value)}><option value="">— nanti saja —</option>{(akun ?? []).map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select></label>}
        {platform && <label>Chat masuk lewat<select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}><option value="">—</option>{platform.map(p => <option key={p}>{p}</option>)}</select><span className="redup kecil">Kanal tempat klien pertama menghubungi. Terisi otomatis dari akun jualan — ganti bila chat lewat DM IG, X, Discord, WA, dst.</span></label>}
      </div>
      <div className="dua">
        <IsianNilai f={f} setF={setF} kunciRp={kunciNilai} label={labelNilai} kurs={kurs} />
        <label>Deadline<input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></label>
      </div>
      <label>Talent<select value={f.talentUserId} onChange={e => setF({ ...f, talentUserId: e.target.value, ...(e.target.value !== '__freelance' ? { namaFreelance: '' } : {}) })}>
        <option value="">— belum ditentukan —</option>
        {(talent ?? []).map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
        <option value="__freelance">+ Freelance (tulis nama)…</option>
      </select></label>
      {f.talentUserId === '__freelance' && <label>Nama freelance<input list="daftar-freelance-prospek" value={f.namaFreelance} onChange={e => setF({ ...f, namaFreelance: e.target.value })} maxLength={200} required />
        <datalist id="daftar-freelance-prospek">{freelancer.map(p => <option key={p.nama} value={p.nama}>{[p.skill, p.kontak].filter(Boolean).join(' · ')}</option>)}</datalist></label>}
    </>
  )
}

function FormProspek({ studioId, lead, akun, platform, talent, onTutup, onSimpan }) {
  const [f, setF] = useState(() => dariLead(lead))
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const kirim = async (e) => {
    e.preventDefault(); setSibuk(true); setGalat('')
    try {
      if (lead) await api(`/api/circle/marketing/lead/${lead.id}`, { method: 'PATCH', body: bodyProspek(f) })
      else await api('/api/circle/marketing/lead', { method: 'POST', body: { studioId, ...bodyProspek(f) } })
      onSimpan()
    } catch (err) { setGalat(err.message); setSibuk(false) }
  }
  const hapus = async () => {
    if (!confirm(`Hapus prospek "${lead.judul || lead.klien}"?\n\nUntuk salah input saja — prospek yang tidak jadi pesan cukup dipindah ke Lost.`)) return
    setSibuk(true); setGalat('')
    try { await api(`/api/circle/marketing/lead/${lead.id}`, { method: 'DELETE' }); onSimpan() } catch (err) { setGalat(err.message); setSibuk(false) }
  }
  return (
    <div className="modal-latar" onClick={onTutup}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={kirim}>
        <h3>{lead ? 'Ubah prospek' : 'Tambah prospek'}</h3>
        <p className="redup kecil">Isiannya sama dengan Tambah order. Saat klien jadi pesan, klik <b>Jadikan order</b> — semua isian ini terbawa, tinggal dilengkapi.</p>
        <IsianOrder f={f} setF={setF} studioId={studioId} akun={akun} platform={platform} talent={talent} />
        <label>Kontak klien<input value={f.kontak} placeholder="mis. @username Discord / email / link profil" onChange={e => setF({ ...f, kontak: e.target.value })} /><span className="redup kecil">Cara menghubungi klien ini (bukan kontakmu).</span></label>
        <label>Catatan<textarea rows={3} value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} /></label>
        {galat && <div className="galat">{galat}</div>}
        <div className="modal-aksi">
          {/* Hapus = salah input (16 Nov 2026, masukan tim); prospek sungguhan yang gagal → Lost (ikut dihitung di Jadi order %) */}
          {lead && lead.status !== 'CONVERTED' && <button type="button" className="btn" style={{ marginRight: 'auto', color: 'var(--red)' }} disabled={sibuk} onClick={hapus} title="Untuk prospek yang salah input. Prospek sungguhan yang tidak jadi → pindahkan ke Lost">Hapus prospek</button>}
          <button type="button" className="btn" onClick={onTutup}>Batal</button><button className="btn utama" disabled={sibuk}>{sibuk ? 'Menyimpan…' : lead ? 'Simpan perubahan' : 'Simpan prospek'}</button></div>
      </form>
    </div>
  )
}

function JadiOrder({ lead, studioId, talent, onTutup, onSimpan }) {
  const awal = dariLead(lead)
  const [f, setF] = useState({ ...awal, nilaiDisepakati: awal.estimasiNilai })
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const akun = useAkunOrder(studioId)
  const kirim = async (e) => {
    e.preventDefault(); setSibuk(true); setGalat('')
    const b = bodyProspek(f)
    try { await api(`/api/circle/marketing/lead/${lead.id}/jadi-order`, { method: 'POST', body: { ...b, estimasiNilai: undefined, nilaiDisepakati: f.mataUang === 'USD' ? undefined : f.nilaiDisepakati, akunId: f.akunId || undefined } }); onSimpan() } catch (err) { setGalat(err.message); setSibuk(false) }
  }
  return (
    <div className="modal-latar" onClick={onTutup}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={kirim}>
        <h3>Jadikan order · {lead.klien}</h3>
        <p className="redup kecil">Isian dari prospek sudah terisi — periksa & lengkapi yang belum ada. Order masuk Inbox produksi dan prospek ditandai "Jadi order".</p>
        <IsianOrder f={f} setF={setF} studioId={studioId} akun={akun} talent={talent} kunciNilai="nilaiDisepakati" labelNilai="Nilai disepakati" akunWajib />
        {galat && <div className="galat">{galat}</div>}
        <div className="modal-aksi"><button type="button" className="btn" onClick={onTutup}>Batal</button><button className="btn utama" disabled={sibuk || !f.akunId}>{sibuk ? 'Menyimpan…' : 'Jadikan order'}</button></div>
      </form>
    </div>
  )
}

export default function MkProspek({ studioId }) {
  const [d, setD] = useState(null)
  const [meta, setMeta] = useState(null)
  const [galat, setGalat] = useState('')
  const [form, setForm] = useState(false)
  const [order, setOrder] = useState(null)
  const [ubahLead, setUbahLead] = useState(null)
  // Urutan kolom yang masih dikejar (22 Nov 2026, masukan tim): bawaan TERBARU MASUK di atas; pilihan kedua = paling lama belum
  // di-follow-up di atas (urutan 13 Nov). Diingat per perangkat. Kolom Jadi order & Lost tetap terbaru di atas (urutan server).
  const [urut, setUrut] = useState(() => { try { return localStorage.getItem('uo-urut-prospek') || 'baru' } catch { return 'baru' } })
  const ubahUrut = (v) => { setUrut(v); try { localStorage.setItem('uo-urut-prospek', v) } catch { /* abaikan */ } }
  const muat = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([api(`/api/circle/marketing/lead?studioId=${studioId}`), api(`/api/circle/marketing/ruang?studioId=${studioId}`)])
      setD(l); setMeta({ akun: r.akun, platform: [...r.platform.sosmed, ...r.platform.akun] }); setGalat('')
    } catch (e) { setGalat(e.message) }
  }, [studioId])
  useEffect(() => { muat() }, [muat])
  async function ubah(l, status) { try { await api(`/api/circle/marketing/lead/${l.id}`, { method: 'PATCH', body: { status } }) } catch (e) { alert(e.message) } muat() }
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d || !meta) return <div className="redup tengah">Memuat prospek…</div>
  return (
    <>
      <div className="toolbar"><button className="btn utama" onClick={() => setForm(true)}>+ Tambah prospek</button><select style={{ width: 'auto' }} value={urut} onChange={e => ubahUrut(e.target.value)} title="Urutan kartu di Discussing, Follow up, dan Nego"><option value="baru">Urutkan: terbaru masuk</option><option value="followup">Urutkan: paling lama belum di-follow-up</option></select><span className="redup kecil">Prospek = lead Ekosistem. "Jadikan order" membuatnya masuk ke antrean produksi.</span></div>
      <div className="papan">
        {STATUS.map(([k, l]) => {
          const isi = d.lead.filter(x => x.status === k)
          if (!['CONVERTED', 'LOST'].includes(k)) isi.sort(urut === 'followup'
            ? (a, b) => String(a.tanggalFollowUpTerakhir ?? a.tanggalMasuk).localeCompare(String(b.tanggalFollowUpTerakhir ?? b.tanggalMasuk))
            : (a, b) => String(b.tanggalMasuk ?? '').localeCompare(String(a.tanggalMasuk ?? '')))
          return (
            <section key={k} className="kolom">
              <header><b>{l}</b><span className="hitung">{isi.length}</span></header>
              <div className="isi-kolom">
                {isi.map(x => (
                  <div key={x.id} className="kartu-order">
                    <div className="meta"><strong className="judul-order">{x.judul ? `${x.judul} · ${x.klien}` : x.klien}</strong>{x.bisaUbah && <><span className="spasi" /><button className="btn kecil" title="Ubah isian prospek" onClick={() => setUbahLead(x)}>✎ Ubah</button></>}</div>
                    <div className="meta">{x.platform && <span className="chip">{x.platform}</span>}{x.akun && <span className="chip sub">{x.akun.namaAkun}</span>}{x.marketer && <span className="redup kecil">👤 {x.marketer}</span>}</div>
                    {x.estimasiNilai != null && <div className="nilai"><b>{x.mataUang === 'USD' ? `$${x.nilaiUsd}` : formatRp(x.estimasiNilai)}</b> <span className="redup kecil">estimasi{x.mataUang === 'USD' ? ` · ${formatRp(x.estimasiNilai)}` : ''}</span></div>}
                    {(x.deadline || x.talent || x.namaFreelance) && <div className="redup kecil">{x.deadline ? `⏱ ${tanggalPendek(x.deadline)}` : ''}{x.deadline && (x.talent || x.namaFreelance) ? ' · ' : ''}{x.talent ? `🎨 ${x.talent}` : x.namaFreelance ? `🎨 ${x.namaFreelance} (freelance)` : ''}</div>}
                    {x.kontak && <div className="redup kecil">📇 {x.kontak}</div>}
                    {x.catatan && <div className="redup kecil">{x.catatan}</div>}
                    <div className="redup kecil">masuk {tanggalPendek(x.tanggalMasuk)}{x.tanggalFollowUpTerakhir ? ` · follow-up ${tanggalPendek(x.tanggalFollowUpTerakhir)}` : ''}</div>
                    {k === 'CONVERTED' && x.orderBatal && (
                      <div className="aksi-order">
                        <span className="redup kecil">Ordernya sudah dihapus di Produksi.</span>
                        {x.bisaUbah && <><button className="btn kecil" onClick={() => ubah(x, 'NEGO')}>↩ Kembali ke Nego</button><button className="btn kecil" onClick={() => ubah(x, 'LOST')}>→ Lost</button></>}
                      </div>
                    )}
                    {k !== 'CONVERTED' && (
                      <div className="aksi-order">
                        {(TUJUAN[k] ?? []).map(t => <button key={t} className="btn kecil" onClick={() => ubah(x, t)}>→ {LABEL[t]}</button>)}
                        {['NEGO', 'FOLLOW_UP', 'DISCUSSING'].includes(k) && <button className="btn kecil utama" onClick={() => setOrder(x)}>Jadikan order</button>}
                      </div>
                    )}
                  </div>
                ))}
                {isi.length === 0 && <div className="kosong">Kosong</div>}
              </div>
            </section>
          )
        })}
      </div>
      {(form || ubahLead) && <FormProspek studioId={studioId} lead={ubahLead} akun={meta.akun} platform={meta.platform} talent={d.talent} onTutup={() => { setForm(false); setUbahLead(null) }} onSimpan={() => { setForm(false); setUbahLead(null); muat() }} />}
      {order && <JadiOrder lead={order} studioId={studioId} talent={d.talent} onTutup={() => setOrder(null)} onSimpan={() => { setOrder(null); muat() }} />}
    </>
  )
}
