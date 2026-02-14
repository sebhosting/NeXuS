'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register, user, loading } = useAuth()
  const router = useRouter()

  const [mode, setMode]         = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [success, setSuccess]   = useState('')

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-base)' }}>
      <div style={{ fontFamily:'JetBrains Mono', color:'var(--cyan)', letterSpacing:'3px' }}>LOADING...</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
      backgroundSize: '40px 40px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>

        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{
            width:'48px', height:'48px', background:'var(--cyan)',
            clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
            margin:'0 auto 16px', boxShadow:'0 0 30px var(--cyan-dim)',
          }} />
          <div style={{ fontFamily:'Rajdhani', fontSize:'24px', fontWeight:700, letterSpacing:'4px', color:'var(--cyan)' }}>
            NEXUS MGR
          </div>
          <div style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', letterSpacing:'2px', marginTop:'4px' }}>
            INFRASTRUCTURE CONTROL PANEL
          </div>
        </div>

        <div style={{
          background:'var(--bg-card)', border:'1px solid var(--border)',
          borderRadius:'6px', padding:'32px', position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:'var(--cyan)', boxShadow:'0 0 10px var(--cyan)' }} />

          <div style={{ display:'flex', marginBottom:'28px', background:'var(--bg-base)', borderRadius:'4px', padding:'3px' }}>
            {(['login','register'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                style={{
                  flex:1, padding:'8px', border:'none', cursor:'pointer',
                  borderRadius:'3px', fontFamily:'Rajdhani', fontWeight:700,
                  fontSize:'13px', letterSpacing:'2px', textTransform:'uppercase',
                  background: mode===m ? 'var(--bg-card)' : 'transparent',
                  color: mode===m ? 'var(--cyan)' : 'var(--text-muted)',
                  boxShadow: mode===m ? '0 0 8px var(--cyan-dim)' : 'none',
                  transition:'all 0.2s',
                }}>
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handle}>
            {mode === 'register' && (
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontFamily:'JetBrains Mono', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'2px', marginBottom:'6px' }}>USERNAME</label>
                <input value={username} onChange={e => setUsername(e.target.value)} required placeholder="seb"
                  style={{ width:'100%', padding:'10px 14px', background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text-primary)', fontFamily:'JetBrains Mono', fontSize:'13px', outline:'none' }}
                  onFocus={e => (e.target.style.borderColor='var(--cyan)')}
                  onBlur={e  => (e.target.style.borderColor='var(--border)')}
                />
              </div>
            )}

            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontFamily:'JetBrains Mono', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'2px', marginBottom:'6px' }}>EMAIL</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="seb@sebhosting.com"
                style={{ width:'100%', padding:'10px 14px', background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text-primary)', fontFamily:'JetBrains Mono', fontSize:'13px', outline:'none' }}
                onFocus={e => (e.target.style.borderColor='var(--cyan)')}
                onBlur={e  => (e.target.style.borderColor='var(--border)')}
              />
            </div>

            <div style={{ marginBottom:'24px' }}>
              <label style={{ display:'block', fontFamily:'JetBrains Mono', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'2px', marginBottom:'6px' }}>PASSWORD</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••"
                style={{ width:'100%', padding:'10px 14px', background:'var(--bg-base)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text-primary)', fontFamily:'JetBrains Mono', fontSize:'13px', outline:'none' }}
                onFocus={e => (e.target.style.borderColor='var(--cyan)')}
                onBlur={e  => (e.target.style.borderColor='var(--border)')}
              />
            </div>

            {error && (
              <div style={{ padding:'10px 14px', marginBottom:'16px', background:'var(--red-dim)', border:'1px solid var(--red)', borderRadius:'4px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--red)' }}>
                ✗ {error}
              </div>
            )}
            {success && (
              <div style={{ padding:'10px 14px', marginBottom:'16px', background:'var(--green-dim)', border:'1px solid var(--green)', borderRadius:'4px', fontFamily:'JetBrains Mono', fontSize:'11px', color:'var(--green)' }}>
                ✓ {success}
              </div>
            )}

            <button type="submit" disabled={busy} style={{
              width:'100%', padding:'12px', border:'none', borderRadius:'4px',
              cursor: busy ? 'not-allowed' : 'pointer',
              background: busy ? 'var(--bg-hover)' : 'var(--cyan)',
              fontFamily:'Rajdhani', fontWeight:700, fontSize:'14px', letterSpacing:'3px',
              color: busy ? 'var(--text-muted)' : 'var(--bg-base)',
              boxShadow: busy ? 'none' : '0 0 15px var(--cyan-dim)',
              transition:'all 0.2s',
            }}>
              {busy ? 'PROCESSING...' : mode==='login' ? 'ACCESS SYSTEM' : 'CREATE ACCOUNT'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:'20px', fontFamily:'JetBrains Mono', fontSize:'9px', color:'var(--text-dim)', letterSpacing:'2px' }}>
          NEXUS MGR v3.0 · SECURE ACCESS
        </div>
      </div>
    </div>
  )
}
