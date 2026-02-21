'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register, user, loading } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess(''); setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        router.replace('/dashboard')
      } else {
        await register(username, email, password)
        setSuccess('Account created! You can now log in.')
        setMode('login')
        setUsername(''); setPassword('')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontFamily: "'Courier New', monospace", color: 'var(--accent)', letterSpacing: '3px', fontSize: '1rem' }}>LOADING...</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div className="grid-bg" />

      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: 'radial-gradient(circle at 50% 50%, rgba(76, 201, 240, 0.05), transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative', zIndex: 10 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontFamily: "'Courier New', monospace", fontSize: '2.5rem',
            fontWeight: 900, color: 'var(--accent)', marginBottom: '12px',
          }}>
            &lt;SEB/&gt;
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '2px' }}>
            NEXUS MGR
          </div>
          <div style={{
            fontFamily: "'Courier New', monospace", fontSize: '0.75rem',
            color: 'var(--muted)', letterSpacing: '2px', marginTop: '6px',
          }}>
            INFRASTRUCTURE CONTROL PANEL
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '36px',
          position: 'relative', overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}>
          {/* Top accent line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--accent)' }} />

          {/* Mode toggle */}
          <div style={{ display: 'flex', marginBottom: '28px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px' }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                style={{
                  flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                  borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem',
                  letterSpacing: '2px', textTransform: 'uppercase',
                  background: mode === m ? 'var(--panel)' : 'transparent',
                  color: mode === m ? 'var(--accent)' : 'var(--muted)',
                  boxShadow: mode === m ? '0 0 8px rgba(76,201,240,0.2)' : 'none',
                  transition: 'all 0.2s', fontFamily: 'inherit',
                }}>
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            {mode === 'register' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={formLabelStyle}>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} required placeholder="seb"
                  style={formInputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--highlight)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <label style={formLabelStyle}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="seb@sebhosting.com"
                style={formInputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--highlight)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={formLabelStyle}>Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••"
                style={formInputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--highlight)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {error && (
              <div style={{ padding: '12px 16px', marginBottom: '18px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--red)' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '12px 16px', marginBottom: '18px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--success)' }}>
                {success}
              </div>
            )}

            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: busy ? 'rgba(255,255,255,0.05)' : 'var(--accent-2)',
              fontWeight: 700, fontSize: '1rem', letterSpacing: '2px',
              color: busy ? 'var(--muted)' : '#04101d',
              boxShadow: busy ? 'none' : '0 6px 20px rgba(56, 189, 248, 0.3)',
              transition: 'all 0.3s', textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}>
              {busy ? 'PROCESSING...' : mode === 'login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>

        <div style={{
          textAlign: 'center', marginTop: '24px',
          fontFamily: "'Courier New', monospace", fontSize: '0.7rem',
          color: 'var(--muted)', letterSpacing: '2px', opacity: 0.5,
        }}>
          NEXUS MGR v3.0 · SECURE ACCESS
        </div>
      </div>
    </div>
  )
}

const formLabelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '8px', fontSize: '0.8rem',
  fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: '1px',
}

const formInputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px', color: 'var(--text)',
  fontSize: '1rem', transition: 'border-color 0.3s',
  fontFamily: 'inherit',
  outline: 'none',
}
