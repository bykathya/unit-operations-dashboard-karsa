import { useState } from 'react'
import { masuk } from './api'

export default function Login({ onMasuk, identitas }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  async function kirim(e) {
    e.preventDefault()
    setProses(true); setGalat('')
    try { onMasuk(await masuk(email.trim(), password)) }
    catch (err) { setGalat(err.message) }
    finally { setProses(false) }
  }

  return (
    <div className="login-bg">
      <form className="login-kartu" onSubmit={kirim}>
        <div className="logo"><span>{(identitas?.nama ?? 'K')[0]}</span> {identitas?.nama ?? 'Unit Operations'}</div>
        <p className="redup">Ruang kerja harian — produksi &amp; marketing.</p>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {galat && <div className="galat">{galat}</div>}
        <button className="btn utama" disabled={proses}>{proses ? 'Masuk…' : 'Masuk'}</button>
        <p className="redup kecil">Akun sama dengan Management Dashboard.</p>
      </form>
    </div>
  )
}
