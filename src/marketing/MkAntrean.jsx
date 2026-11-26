import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { LabelKhusus } from '../KolomKhusus'
import { formatRp, tanggalPendek, lewatDeadline } from '../format'

const WARNA = { PREVIEW_KLIEN: 'jenis-PREVIEW_KLIEN', MENUNGGU_KLIEN: 'jenis-MENUNGGU_KLIEN', DELIVERY: 'jenis-DELIVERY' }

// Antrean klien: order di fase yang dipegang marketer (Preview klien, Menunggu client, Delivery). Tombol datang dari mesin alur.
export default function MkAntrean({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(null)
  const muat = useCallback(() => api(`/api/circle/marketing/ruang?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])

  async function aksi(o, a) {
    setSibuk(o.id)
    try { await api(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', body: { aksi: a.aksi } }) } catch (e) { alert(e.message) }
    setSibuk(null); muat()
  }
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat antrean…</div>
  const grup = [['PREVIEW_KLIEN', 'Preview klien'], ['MENUNGGU_KLIEN', 'Menunggu client'], ['DELIVERY', 'Delivery']]
  return (
    <>
      <div className="ringkasan">
        {grup.map(([j, l]) => <div key={j} className="stat"><span className="redup kecil">{l}</span><b>{d.antrean.filter(o => o.jenis === j).length}</b></div>)}
        <div className="stat"><span className="redup kecil">Prospek aktif</span><b>{['DISCUSSING', 'FOLLOW_UP', 'NEGO'].reduce((a, k) => a + (d.lead[k] ?? 0), 0)}</b></div>
      </div>
      {d.antrean.length === 0 && <div className="kosong">Tidak ada order di fase klien. Order muncul di sini begitu pekerjaan siap dipreview, ditunggu klien, atau siap dikirim.</div>}
      {d.milikDiProduksi > 0 && <div className="redup kecil" style={{ marginTop: 8 }}>📌 {d.milikDiProduksi} order milikmu masih di tahap produksi (belum sampai fase klien) — pantau atau geser tahapnya (order freelance) di menu <b>Produksi</b>.</div>}
      {grup.map(([j, l]) => {
        const isi = d.antrean.filter(o => o.jenis === j)
        if (!isi.length) return null
        return (
          <div className="panel" key={j} style={{ marginBottom: 12 }}>
            <h3 className="judul-bagian">{l} <span className="hitung">{isi.length}</span></h3>
            {isi.map(o => (
              <div key={o.id} className={'tugas' + (lewatDeadline(o.deadline, o.jenis) ? ' telat' : '')}>
                <div>
                  <strong>{o.judul}</strong>{o.tanpaPemegang && <span className="lencana" style={{ marginLeft: 6 }} title="Order ini belum punya marketer pemegang — koordinator/admin bisa menetapkannya di detail order">tanpa pemegang</span>}
                  {o.khusus?.length > 0 && <div style={{ marginTop: 2 }}><LabelKhusus daftar={o.khusus} /></div>}
                  <div className="redup kecil"><span className="chip">{o.klien}</span> {o.talent.length > 0 && <>· 👤 {o.talent.join(', ')}</>} · {formatRp(o.nilaiDisepakati ?? o.nilaiBersih)}</div>
                </div>
                <div className="tugas-kanan">
                  <span className={'tahap-lencana ' + WARNA[o.jenis]}>{o.tahap}</span>
                  {o.revisiKe > 0 && <span className="lencana revisi">↺ {o.revisiKe}</span>}
                  {o.deadline && <span className={'tgl' + (lewatDeadline(o.deadline, o.jenis) ? ' merah' : '')}>⏱ {tanggalPendek(o.deadline)}</span>}
                  {o.aksi.map((a, i) => <button key={a.aksi} className={'btn kecil' + (i === 0 && a.aksi !== 'revisi_klien' ? ' utama' : a.aksi === 'revisi_klien' ? ' bahaya' : '')} disabled={sibuk === o.id} onClick={() => aksi(o, a)}>{a.label}</button>)}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
