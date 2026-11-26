import { useState } from 'react'
import MkAntrean from './MkAntrean'
import MkAktivitas from './MkAktivitas'
import MkProspek from './MkProspek'
import MkRencana from './MkRencana'
import MkInsight from './MkInsight'
import MkProfil from './MkProfil'
import MkDashboard from './MkDashboard'

// Ruang kerja marketing (adaptasi OGS): antrean klien (fase milik marketer), aktivitas harian, prospek, rencana bulanan,
// insight, profil & log. Marketer melihat datanya sendiri; Koordinator ke atas melihat seluruh tim studio.
const TAB = [
  { k: 'antrean', l: 'Antrean klien' },
  { k: 'aktivitas', l: 'Aktivitas' },
  { k: 'prospek', l: 'Prospek' },
  { k: 'rencana', l: 'Rencana' },
  { k: 'dashboard', l: 'Ringkasan' },
  { k: 'insight', l: 'Analisis' },
  { k: 'profil', l: 'Profil & catatan harian' },
]

export default function Marketing({ studioId, manajer }) {
  const [tab, setTab] = useState('antrean')
  return (
    <>
      <div className="subtab">
        {TAB.map(t => <button key={t.k} className={tab === t.k ? 'aktif' : ''} onClick={() => setTab(t.k)}>{t.l}</button>)}
        <span className="spasi" />
        <span className="redup kecil">{manajer ? 'Tampilan tim (Koordinator ke atas)' : 'Tampilan pribadi'}</span>
      </div>
      {tab === 'antrean' && <MkAntrean key={studioId} studioId={studioId} />}
      {tab === 'aktivitas' && <MkAktivitas key={studioId} studioId={studioId} />}
      {tab === 'prospek' && <MkProspek key={studioId} studioId={studioId} />}
      {tab === 'rencana' && <MkRencana key={studioId} studioId={studioId} />}
      {tab === 'dashboard' && <MkDashboard key={studioId} studioId={studioId} />}
      {tab === 'insight' && <MkInsight key={studioId} studioId={studioId} />}
      {tab === 'profil' && <MkProfil key={studioId} studioId={studioId} />}
    </>
  )
}
