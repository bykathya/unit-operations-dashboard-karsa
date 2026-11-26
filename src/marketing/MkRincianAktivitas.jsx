import { useEffect, useState } from 'react'
import { api } from '../api'
import { NAMA_BULAN } from '../api-util'
import { tanggalPendek } from '../format'
import TombolUnduh from '../TombolUnduh'

// Rincian aktivitas satu marketer (22 Nov 2026, masukan tim/Keiko): isi aktivitas yang ia catat (judul, link postingan, akun target,
// hasil) untuk kurasi & evaluasi Koordinator. Saringan sama dengan tabel "Aktivitas per marketer" (aktivitas selesai pada periode itu).
export default function MkRincianAktivitas({ studioId, userId, nama, p, tampilan, tahapAwal = '', onTutup }) {
  const [tahap, setTahap] = useState(tahapAwal)
  const [semua, setSemua] = useState(false)
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  useEffect(() => {
    setD(null); setGalat('')
    const q = `studioId=${studioId}&userId=${userId}&bulan=${p.bulan}&tahun=${p.tahun}&tampilan=${tampilan}${tahap ? `&tahap=${tahap}` : ''}${semua ? '&semua=1' : ''}`
    api(`/api/circle/marketing/aktivitas-rincian?${q}`).then(setD).catch(e => setGalat(e.message))
  }, [studioId, userId, p, tampilan, tahap, semua])
  const periode = tampilan === 'tahun' ? String(p.tahun) : `${NAMA_BULAN[p.bulan - 1]} ${p.tahun}`
  const total = d ? d.baris.reduce((s, b) => s + (b.selesai ? b.jumlah : 0), 0) : 0
  return (
    <div className="modal-latar" onClick={onTutup}>
      <div className="modal" style={{ maxWidth: 1000, width: '100%' }} onClick={e => e.stopPropagation()}>
        <h3 className="judul-bagian">Aktivitas {nama}, {periode}</h3>
        <div className="toolbar">
          <select style={{ width: 'auto' }} value={tahap} onChange={e => setTahap(e.target.value)}>
            <option value="">Semua jenis</option>
            {(d?.tahapPilihan ?? []).map(t => <option key={t.kunci} value={t.kunci}>{t.label}</option>)}
          </select>
          <label style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 6, margin: 0, cursor: 'pointer' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={semua} onChange={e => setSemua(e.target.checked)} /> Tampilkan juga yang belum selesai</label>
          {d && d.baris.length > 0 && <TombolUnduh nama={`aktivitas-${(nama ?? 'marketer').toLowerCase().replace(/\s+/g, '-')}-${periode.replace(/\s+/g, '-')}`} baris={[['Tanggal', 'Jenis', 'Akun', 'Judul', 'Platform', 'Jam', 'Link', 'Akun target', 'Follower target', 'Hasil', 'Jumlah', 'Selesai', 'Catatan'], ...d.baris.map(b => [b.tanggal, b.label, b.akun ?? '', b.judul ?? '', b.platform ?? '', b.jamPosting ?? '', b.link ?? '', b.targetAkun ?? '', b.pengikut ?? '', b.hasil ?? '', b.jumlah, b.selesai ? 'ya' : 'belum', b.catatan ?? ''])]} />}
        </div>
        {d?.dibatasiAkun && <div className="redup kecil">Hanya aktivitas di akun jualan yang kamu pegang.</div>}
        {galat && <div className="galat">{galat}</div>}
        {!d && !galat && <div className="redup">Memuat…</div>}
        {d && (d.baris.length === 0 ? <div className="kosong">Belum ada aktivitas {semua ? '' : 'selesai '}pada periode ini.</div> : <>
          <div className="redup kecil" style={{ margin: '4px 0 8px' }}>{d.baris.length} catatan, {total} aktivitas selesai (angka ini sama dengan tabel Aktivitas per marketer).</div>
          <div style={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <table>
              <thead><tr><th>Tanggal</th><th>Jenis</th><th>Akun</th><th>Isi</th><th>Link</th><th>Target</th><th>Hasil</th><th className="kanan">Jml</th></tr></thead>
              <tbody>{d.baris.map(b => (
                <tr key={b.id} style={b.selesai ? undefined : { opacity: 0.6 }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{tanggalPendek(b.tanggal)}{b.jamPosting ? <div className="redup kecil">{b.jamPosting}</div> : null}</td>
                  <td>{b.label}{b.tahap ? <div className="redup kecil">{b.tahap}</div> : null}{!b.selesai && <div className="redup kecil">belum selesai</div>}</td>
                  <td>{b.akun ?? '—'}</td>
                  <td>{b.judul ?? '—'}{b.platform ? <div className="redup kecil">{b.platform}</div> : null}{b.catatan ? <div className="redup kecil">{b.catatan}</div> : null}</td>
                  <td style={{ maxWidth: 220, wordBreak: 'break-all' }}>{b.tautan ? <a href={b.tautan} target="_blank" rel="noreferrer noopener">Buka ↗</a> : (b.link ?? '—')}</td>
                  <td>{b.targetAkun ?? '—'}{b.pengikut != null ? <div className="redup kecil">{b.pengikut.toLocaleString('id-ID')} follower</div> : null}</td>
                  <td>{b.hasil ?? '—'}</td>
                  <td className="kanan">{b.jumlah}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>)}
        <div className="modal-aksi"><button className="btn" onClick={onTutup}>Tutup</button></div>
      </div>
    </div>
  )
}
