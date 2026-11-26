import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { tanggalPendek } from './format'
import { hariIniLokal } from './api-util'
import { PilihCari } from './Pilihan'

// DIREKTORI KLIEN (10 Nov 2026, masukan tim): nama/username, nickname, asal order, jumlah order dengan kita. Klien dari order lama otomatis
// masuk; order baru memakai nama dari sini (tanpa typo). Mengganti nama memperbaiki ejaan di semua order klien itu.
const KOSONG = { nama: '', panggilan: '', asal: '', kontak: '', catatan: '' }

function Form({ studioId, awal, asal, semua, onGabung, onSelesai, onBatal }) {
  const [f, setF] = useState(awal ? { ...KOSONG, ...awal, panggilan: awal.panggilan ?? '', asal: awal.asal ?? '', kontak: awal.kontak ?? '', catatan: awal.catatan ?? '' } : KOSONG)
  const [galat, setGalat] = useState('')
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const kirim = async (e) => {
    e.preventDefault(); setGalat('')
    try {
      if (awal) await api(`/api/circle/klien/${awal.id}`, { method: 'PATCH', body: f })
      else await api('/api/circle/klien', { method: 'POST', body: { studioId, ...f } })
      onSelesai()
    } catch (er) { setGalat(er.message) }
  }
  return (
    <form className="panel" onSubmit={kirim} style={{ marginBottom: 12 }}>
      <h3 className="judul-bagian">{awal ? `Ubah ${awal.nama}` : 'Tambah klien'}</h3>
      {galat && <div className="galat">{galat}</div>}
      {awal && galat.includes('sudah dipakai klien lain') && (() => { const lain = semua.find(x => x.id !== awal.id && x.nama.toLowerCase() === f.nama.trim().toLowerCase()); return lain ? <div className="panel" style={{ marginBottom: 8 }}>Nama "<b>{lain.nama}</b>" sudah ada di direktori. Kalau keduanya klien yang sama, <b>gabungkan</b> "{awal.nama}" ke "{lain.nama}": semua ordernya ikut pindah dan entri "{awal.nama}" hilang. <div className="chips" style={{ marginTop: 6 }}><button type="button" className="btn utama kecil" onClick={() => onGabung(awal, lain)}>Gabungkan ke {lain.nama}</button></div></div> : null })()}
      <div className="dua">
        <label>Nama / username<input value={f.nama} onChange={ubah('nama')} required maxLength={120} /></label>
        <label>Nickname (panggilan)<input value={f.panggilan} onChange={ubah('panggilan')} maxLength={60} /></label>
        <label>Asal order<select value={f.asal} onChange={ubah('asal')}><option value="">— pilih —</option>{asal.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
        <label>Kontak (opsional)<input value={f.kontak} onChange={ubah('kontak')} maxLength={120} /></label>
      </div>
      <label>Catatan<input value={f.catatan} onChange={ubah('catatan')} maxLength={500} /></label>
      {awal && <div className="redup kecil">Mengganti nama ikut memperbaiki ejaan di semua order klien ini.</div>}
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama">Simpan</button></div>
    </form>
  )
}

// FOLLOW UP KLIEN LAMA (24 Nov 2026, masukan tim): dicatat sebagai aktivitas marketer "Follow up klien lama" yang tertaut ke klien ini
// (satu sumber dengan Marketing › Aktivitas; ikut Ringkasan & Laporan Harian Market). Bila klien tertarik → sekalian jadi prospek (Discussing).
function FormFollowUp({ studioId, klien, platform, onSelesai, onBatal }) {
  const [f, setF] = useState({ tanggal: hariIniLokal(), platform: klien.asal && platform.includes(klien.asal) ? klien.asal : '', hasil: '', catatan: '', prospek: false })
  const [galat, setGalat] = useState(''), [sibuk, setSibuk] = useState(false)
  const kirim = async (e) => {
    e.preventDefault(); setGalat(''); setSibuk(true)
    try {
      await api('/api/circle/marketing/aktivitas', { method: 'POST', body: { studioId, tanggal: f.tanggal, items: [{ jenis: 'network_followup_klien', klienId: klien.id, platform: f.platform || undefined, hasil: f.hasil || undefined, catatan: f.catatan || undefined, jumlah: 1, selesai: true }] } })
      if (f.prospek) await api('/api/circle/marketing/lead', { method: 'POST', body: { studioId, klien: klien.nama, platform: f.platform || undefined, kontak: klien.kontak || undefined, catatan: `Dari follow up klien lama${f.hasil ? `: ${f.hasil}` : ''}` } })
      onSelesai(f.prospek)
    } catch (er) { setGalat(er.galat?.map(g => g.pesan).join(' ') || er.message); setSibuk(false) }
  }
  return (
    <form className="panel" onSubmit={kirim} style={{ marginBottom: 12 }}>
      <h3 className="judul-bagian">📞 Follow up {klien.panggilan ? `${klien.nama} (${klien.panggilan})` : klien.nama}</h3>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Catat setelah kamu menyapa klien ini lagi. Tercatat sebagai aktivitas marketing "Follow up klien lama" milikmu{klien.followUp ? `. Terakhir di-follow-up ${tanggalPendek(klien.followUp.tanggal)}${klien.followUp.oleh ? ` oleh ${klien.followUp.oleh}` : ''}.` : '.'}</div>
      {galat && <div className="galat">{galat}</div>}
      <div className="dua">
        <label>Tanggal<input type="date" value={f.tanggal} max={hariIniLokal()} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
        <label>Lewat<select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}><option value="">— pilih —</option>{platform.map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <label>Respon klien / hasil<input value={f.hasil} maxLength={300} placeholder="mis. belum dibalas, tertarik, minta pricelist" onChange={e => setF({ ...f, hasil: e.target.value })} /></label>
      <label>Catatan (opsional)<input value={f.catatan} maxLength={300} onChange={e => setF({ ...f, catatan: e.target.value })} /></label>
      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={f.prospek} onChange={e => setF({ ...f, prospek: e.target.checked })} />Klien tertarik, sekalian jadikan prospek (masuk Prospek › Discussing)</label>
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama" disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan follow up'}</button></div>
    </form>
  )
}

export default function Klien({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [form, setForm] = useState(null), [cari, setCari] = useState(''), [asalFilter, setAsalFilter] = useState(''), [gabungDari, setGabungDari] = useState(null), [urut, setUrut] = useState('order'), [followUp, setFollowUp] = useState(null), [info, setInfo] = useState('')
  const muat = useCallback(() => { api(`/api/circle/klien?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat…</div>
  const kata = cari.trim().toLowerCase()
  const tampil = d.klien.filter(k => (!kata || [k.nama, k.panggilan, k.kontak].some(x => String(x ?? '').toLowerCase().includes(kata))) && (!asalFilter || k.asal === asalFilter))
  // Urutan (13 Nov 2026, masukan tim): cari klien yang perlu di-follow-up lagi — paling lama tidak order / tidak dikabari di atas
  const waktu = (x) => (x ? String(x) : '')
  const terakhirAda = (k) => [waktu(k.terakhir), waktu(k.terakhirKontak), waktu(k.followUp?.tanggal)].sort().pop() // termasuk follow up klien lama (24 Nov 2026)
  const PEMBANDING = {
    order: (a, b) => b.jumlahOrder - a.jumlahOrder,
    lama: (a, b) => (a.jumlahOrder === 0) - (b.jumlahOrder === 0) || terakhirAda(a).localeCompare(terakhirAda(b)),
    baru: (a, b) => waktu(b.terakhir).localeCompare(waktu(a.terakhir)),
    nama: () => 0,
  }
  tampil.sort((a, b) => PEMBANDING[urut](a, b) || a.nama.localeCompare(b.nama, 'id'))
  const repeat = d.klien.filter(k => k.jumlahOrder > 1).length
  const tutup = () => { setForm(null); muat() }
  const lakukanGabung = async (dari, tujuan) => {
    if (!confirm(`Gabungkan "${dari.nama}" ke "${tujuan.nama}"?\n\nSemua order "${dari.nama}" pindah ke "${tujuan.nama}" dan entri "${dari.nama}" dihapus. Tidak bisa dibatalkan.`)) return
    try { await api(`/api/circle/klien/${dari.id}/gabung`, { method: 'POST', body: { keId: tujuan.id } }); setGabungDari(null); setForm(null); muat() } catch (e) { setGalat(e.message) }
  }
  const hapus = async (k) => { if (!confirm(`Hapus "${k.nama}" dari direktori?\n\nHanya bisa bila klien ini belum dipakai order apa pun.`)) return; try { await api(`/api/circle/klien/${k.id}`, { method: 'DELETE' }); muat() } catch (e) { setGalat(e.message) } }
  return (
    <div>
      {form && <Form key={form === 'baru' ? 'baru' : form.id} studioId={studioId} awal={form === 'baru' ? null : form} asal={d.asal} semua={d.klien} onGabung={lakukanGabung} onSelesai={tutup} onBatal={() => setForm(null)} />}
      {followUp && <FormFollowUp key={followUp.id} studioId={studioId} klien={followUp} platform={d.platformFollowUp ?? []} onBatal={() => setFollowUp(null)} onSelesai={(p) => { setInfo(`Follow up ${followUp.nama} dicatat${p ? ' dan masuk Prospek › Discussing' : ''}.`); setFollowUp(null); muat() }} />}
      {info && <div className="ok" style={{ marginBottom: 8 }}>{info}</div>}
      {gabungDari && <div className="panel" style={{ marginBottom: 12 }}>
        <h3 className="judul-bagian">Gabungkan "{gabungDari.nama}" ke klien lain</h3>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Pilih klien yang BENAR (ketik untuk mencari). Semua order "{gabungDari.nama}" pindah ke sana dan entri "{gabungDari.nama}" dihapus.</div>
        <PilihCari pilihan={d.klien.filter(x => x.id !== gabungDari.id).map(x => x.nama)} placeholder="ketik nama klien tujuan…" onPilih={(nama) => { const t = d.klien.find(x => x.nama === nama); if (t) lakukanGabung(gabungDari, t) }} />
        <div className="chips" style={{ marginTop: 8 }}><button className="btn kecil" onClick={() => setGabungDari(null)}>Batal</button></div>
      </div>}
      <div className="panel">
        <div className="toolbar">
          <input className="cari" placeholder="Cari nama, nickname, atau kontak…" value={cari} onChange={e => setCari(e.target.value)} />
          <select style={{ width: 'auto' }} value={asalFilter} onChange={e => setAsalFilter(e.target.value)}><option value="">Semua asal</option>{d.asal.map(a => <option key={a} value={a}>{a}</option>)}</select>
          <select style={{ width: 'auto' }} value={urut} onChange={e => setUrut(e.target.value)} title="Urutkan daftar klien">
            <option value="order">Order terbanyak</option><option value="lama">Paling lama tidak order / dikabari / di-follow-up</option><option value="baru">Order terbaru</option><option value="nama">Nama A–Z</option>
          </select>
          {d.bisaUbah && <button className="btn utama" onClick={() => setForm('baru')}>+ Tambah klien</button>}
        </div>
        <p className="redup kecil">{d.klien.length} klien · {repeat} klien repeat order. Klien dari order sebelumnya otomatis masuk daftar; saat mengisi order baru, nama klien dipilih dari sini supaya tidak typo.</p>
        {tampil.length === 0 ? <div className="kosong">{d.klien.length ? 'Tidak ada yang cocok.' : 'Belum ada klien.'}</div> : (
          <div style={{ overflowX: 'auto' }}><table>
            <thead><tr><th>Nama / username</th><th>Nickname</th><th>Asal order</th><th className="kanan">Order</th><th className="kanan">Berjalan</th><th>Terakhir order</th><th title="Kontak terakhir di Update klien (Preview, Kata, Deliver)">Terakhir dikabari</th><th title="Follow up klien lama terakhir (Marketing › Aktivitas atau tombol Follow up)">Terakhir di-follow-up</th><th /></tr></thead>
            <tbody>{tampil.map(k => (
              <tr key={k.id}>
                <td><b>{k.nama}</b>{k.jumlahOrder > 1 && <span className="lencana"> repeat</span>}{!k.aktif && <span className="lencana"> nonaktif</span>}</td>
                <td>{k.panggilan ?? '—'}</td><td>{k.asal ?? '—'}</td>
                <td className="kanan">{k.jumlahOrder}×</td><td className="kanan">{k.orderBerjalan || ''}</td><td>{k.terakhir ? tanggalPendek(k.terakhir) : '—'}</td><td>{k.terakhirKontak ? tanggalPendek(k.terakhirKontak) : '—'}</td>
                <td style={{ minWidth: 110 }} title={k.followUp ? [k.followUp.lewat && `lewat ${k.followUp.lewat}`, k.followUp.hasil].filter(Boolean).join(': ') : undefined}>{k.followUp ? <>{tanggalPendek(k.followUp.tanggal)}{k.jumlahFollowUp > 1 ? <span className="redup kecil"> ({k.jumlahFollowUp}×)</span> : null}<div className="redup kecil">{k.followUp.oleh}</div>{k.followUp.hasil && <div className="redup kecil" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.followUp.hasil}</div>}</> : '—'}</td>
                <td className="kanan" style={{ whiteSpace: 'nowrap' }}>{d.bisaUbah && <><button className="btn kecil" title="Catat follow up ke klien ini" onClick={() => { setInfo(''); setFollowUp(k) }}>📞 Follow up</button> <button className="btn kecil" onClick={() => setForm(k)}>ubah</button> <button className="btn kecil" title="Gabungkan dengan klien lain (mis. nama typo)" onClick={() => setGabungDari(k)}>gabung</button>{k.jumlahOrder === 0 && <> <button className="btn kecil" title="Hapus entri yang tak dipakai order apa pun" onClick={() => hapus(k)}>hapus</button></>}</>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}
