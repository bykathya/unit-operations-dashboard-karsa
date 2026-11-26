import { useState } from 'react'

// SATU pilihan "Masuk antrean talent / ⏸ Tunda" untuk semua tempat pengelola memindah kartu ke tahap kerja (12 Nov 2026, masukan tim):
// Produksi, Tugas saya › Update klien, dan Tugas saya › Kurasi QC (16 Nov 2026, masukan tim — dulu dua tempat terakhir langsung masuk antrean).
// Server: `antrean:false` pada POST /orders/:id/aksi maupun PATCH /orders/:id/tahap → tugas talent dibuat DITUNDA.
export const JENIS_KERJA_UI = ['KERJA', 'REVISI_INTERNAL', 'REVISI_KLIEN', 'FINALISASI']
export const perluTanyaAntrean = ({ adaTalentInternal, jenisTujuan }) => !!adaTalentInternal && JENIS_KERJA_UI.includes(jenisTujuan)

/** const [tanya, modal] = useTanyaAntrean(); const pilihan = await tanya({ judul, talent, tujuan }) → true (masuk) | false (tunda) | null (batal) */
export function useTanyaAntrean() {
  const [t, setT] = useState(null)
  const tanya = (isi) => new Promise(selesai => setT({ ...isi, selesai }))
  const jawab = (v) => { t?.selesai(v); setT(null) }
  const modal = t && (
    <div className="modal-latar" onClick={() => jawab(null)}><div className="modal" onClick={e => e.stopPropagation()}>
      <h3 style={{ marginTop: 0 }}>Pindah ke {t.tujuan}</h3>
      <p className="redup">"{t.judul}" akan dikerjakan {t.talent?.length ? t.talent.join(', ') : 'talent'}. Masukkan ke antrean talent sekarang?</p>
      <div className="modal-aksi" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn" onClick={() => jawab(null)}>Batal</button>
        <button className="btn" onClick={() => jawab(false)} title="Pekerjaan tidak masuk Antreanku talent hari ini; tetap terlihat di Tugasku (prioritas berikutnya / bisa untuk lembur)">⏸ Tunda — bukan hari ini</button>
        <button className="btn utama" onClick={() => jawab(true)}>Masuk antrean talent</button>
      </div>
      <p className="redup kecil" style={{ marginBottom: 0 }}>Yang ditunda bisa dimasukkan ke antrean kapan saja di menu Penugasan.</p>
    </div></div>
  )
  return [tanya, modal]
}
