import { useState } from 'react'
import { unduhCsv, unduhXlsx } from './api-util'

// Tombol unduh CSV + Excel (+ opsional Cetak/PDF lewat dialog cetak peramban).
export default function TombolUnduh({ nama, baris, cetak = false }) {
  const [galat, setGalat] = useState('')
  return (
    <span className="chips" style={{ display: 'inline-flex', gap: 4 }}>
      <button type="button" className="btn kecil" onClick={() => unduhCsv(nama, baris)}>CSV</button>
      <button type="button" className="btn kecil" onClick={() => unduhXlsx(nama, baris).catch(e => setGalat(e.message))}>Excel</button>
      {cetak && <button type="button" className="btn kecil" onClick={() => window.print()}>Cetak / PDF</button>}
      {galat && <span className="redup kecil">{galat}</span>}
    </span>
  )
}
