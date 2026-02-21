'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const AUTH = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.sebhosting.com'
const CACHE = 'https://cache.sebhosting.com'

type ServiceStatus = { name: string; url: string; ok: boolean | null }

const SERVICES: { name: string; url: string }[] = [
  { name: 'Frontend', url: 'nexus.sebhosting.com' },
  { name: 'API', url: 'api.sebhosting.com' },
  { name: 'Auth', url: 'auth.sebhosting.com' },
  { name: 'CMS', url: 'cms.sebhosting.com' },
  { name: 'CDN', url: 'cdn.sebhosting.com' },
  { name: 'Cache', url: 'cache.sebhosting.com' },
  { name: 'WAF', url: 'waf.sebhosting.com' },
  { name: 'AI Gateway', url: 'ai-gateway.sebhosting.com' },
  { name: 'MCP', url: 'mcp.sebhosting.com' },
  { name: 'Backup', url: 'backup.sebhosting.com' },
]

export default function SettingsPage() {
  const { accessToken, user } = useAuth()

  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ ...s, ok: null }))
  )
  const [healthLoading, setHealthLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState('')
  const [error, setError] = useState('')

  const [flushConfirm, setFlushConfirm] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [flushMsg, setFlushMsg] = useState('')

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  // Health checks on mount
  useEffect(() => {
    (async () => {
      setHealthLoading(true)
      const results = await Promise.all(
        SERVICES.map(async (svc) => {
          try {
            const res = await fetch(`https://${svc.url}/health`, {
              headers: hdrs(),
              credentials: 'include',
            })
            return { name: svc.name, url: svc.url, ok: res.ok }
          } catch {
            return { name: svc.name, url: svc.url, ok: false }
          }
        })
      )
      setServices(results)
      setHealthLoading(false)
    })()
  }, [accessToken])

  const handleChangePassword = async () => {
    setError(''); setPwSuccess('')
    if (!currentPassword || !newPassword) {
      setError('All password fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch(`${AUTH}/auth/me/password`, {
        method: 'PUT',
        headers: hdrs(),
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || d.message || 'Password change failed')
      }
      setPwSuccess('Password updated successfully')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPwSaving(false)
    }
  }

  const handleFlush = async () => {
    if (!flushConfirm) {
      setFlushConfirm(true)
      return
    }
    setFlushing(true); setFlushMsg('')
    try {
      const res = await fetch(`${CACHE}/flush`, {
        method: 'POST',
        headers: hdrs(),
        credentials: 'include',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || d.message || 'Flush failed')
      }
      setFlushMsg('All caches flushed successfully')
    } catch (err: any) {
      setFlushMsg(`Flush failed: ${err.message}`)
    } finally {
      setFlushing(false); setFlushConfirm(false)
    }
  }

  if (!user) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING SETTINGS...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            System <span style={{ color: 'var(--highlight)' }}>Settings</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Service health, profile, and system controls</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          SETTINGS
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', marginBottom: '24px', borderRadius: 'var(--radius-sm)',
          background: 'var(--red-dim)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: '0.9rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1.1rem' }}>x</button>
        </div>
      )}

      {/* Success */}
      {pwSuccess && (
        <div style={{
          padding: '14px 18px', marginBottom: '24px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
          color: '#22c55e', fontSize: '0.9rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{pwSuccess}</span>
          <button onClick={() => setPwSuccess('')} style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', fontSize: '1.1rem' }}>x</button>
        </div>
      )}

      {/* ─── Section 1: Service Status ─── */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
        borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          Service Status
          {healthLoading && (
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)', letterSpacing: '2px' }}>CHECKING...</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {services.map(svc => (
            <div key={svc.name} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 18px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
              border: '1px solid var(--border)',
            }}>
              {/* Health dot */}
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                background: svc.ok === null ? 'var(--muted)' : svc.ok ? '#22c55e' : '#ef4444',
                boxShadow: svc.ok === null ? 'none' : svc.ok ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem', marginBottom: '2px' }}>{svc.name}</div>
                <div style={{
                  fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {svc.url}
                </div>
              </div>
              <div style={{
                fontFamily: "'Courier New', monospace", fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px',
                color: svc.ok === null ? 'var(--muted)' : svc.ok ? '#22c55e' : '#ef4444',
              }}>
                {svc.ok === null ? 'PENDING' : svc.ok ? 'HEALTHY' : 'DOWN'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section 2: User Profile ─── */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
        borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
          User Profile
        </div>

        {/* Read-only profile info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '28px' }}>
          <div>
            <label style={labelStyle}>Username</label>
            <div style={{
              padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
              borderRadius: '8px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)',
            }}>
              {user.username}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{
              padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
              borderRadius: '8px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)',
            }}>
              {user.email}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <div style={{ padding: '10px 14px' }}>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
                background: user.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(76,201,240,0.1)',
                color: user.role === 'admin' ? '#ef4444' : '#4cc9f0',
                border: `1px solid ${user.role === 'admin' ? 'rgba(239,68,68,0.3)' : 'rgba(76,201,240,0.3)'}`,
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password form */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>
            Change Password
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <button onClick={handleChangePassword} disabled={pwSaving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: pwSaving ? 'wait' : 'pointer',
              opacity: pwSaving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {pwSaving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Section 3: Danger Zone ─── */}
      <div style={{
        background: 'var(--panel)', border: '1px solid rgba(239,68,68,0.3)', borderLeft: '3px solid #ef4444',
        borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444', marginBottom: '20px' }}>
          Danger Zone
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '4px' }}>
              Flush All Caches
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
              Purges every cached response across all edge nodes. This will temporarily increase response times while caches rebuild.
            </div>
          </div>
          <button
            onClick={handleFlush}
            disabled={flushing}
            onMouseLeave={() => setFlushConfirm(false)}
            style={{
              padding: '10px 28px', flexShrink: 0,
              background: flushConfirm ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px',
              cursor: flushing ? 'wait' : 'pointer',
              opacity: flushing ? 0.6 : 1,
              transition: 'all 0.3s', textTransform: 'uppercase',
              fontFamily: "'Courier New', monospace",
            }}
          >
            {flushing ? 'Flushing...' : flushConfirm ? 'ARE YOU SURE?' : 'FLUSH'}
          </button>
        </div>

        {flushMsg && (
          <div style={{
            marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
            fontFamily: "'Courier New', monospace", fontSize: '0.85rem',
            background: flushMsg.includes('failed') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            color: flushMsg.includes('failed') ? '#ef4444' : '#22c55e',
            border: `1px solid ${flushMsg.includes('failed') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          }}>
            {flushMsg}
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '6px',
  fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '1px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text)',
  fontFamily: "'Courier New', monospace", fontSize: '0.9rem',
  transition: 'border-color 0.3s',
}
