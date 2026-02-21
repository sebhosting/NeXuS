'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const AUTH = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.sebhosting.com'

type AuthUser = {
  id: string; username: string; email: string; role: string
  is_active: boolean; created_at: string; last_login?: string
}
type Session = {
  id: string; user_id: string; username: string
  created_at: string; expires_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '24px', borderTop: `3px solid ${color || 'var(--accent)'}`,
    }}>
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export default function AuthPage() {
  const { accessToken, user: currentUser } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [togglingRole, setTogglingRole] = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<string | null>(null)

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  useEffect(() => {
    loadData()
  }, [accessToken])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, sessionsRes] = await Promise.all([
        fetch(`${AUTH}/auth/users`, { headers: hdrs(), credentials: 'include' }),
        fetch(`${AUTH}/auth/sessions`, { headers: hdrs(), credentials: 'include' }),
      ])
      const usersData = await usersRes.json()
      const sessionsData = await sessionsRes.json()
      if (usersRes.ok) setUsers(Array.isArray(usersData) ? usersData : usersData.users || [])
      else setError(usersData.error || 'Failed to load users')
      if (sessionsRes.ok) setSessions(Array.isArray(sessionsData) ? sessionsData : sessionsData.sessions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRole = async (u: AuthUser) => {
    setTogglingRole(u.id)
    try {
      const newRole = u.role === 'admin' ? 'viewer' : 'admin'
      const res = await fetch(`${AUTH}/auth/users/${u.id}/role`, {
        method: 'PUT', headers: hdrs(), credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
      else { const data = await res.json(); setError(data.error || 'Role update failed') }
    } catch (err: any) { setError(err.message) }
    finally { setTogglingRole(null) }
  }

  const handleToggleActive = async (u: AuthUser) => {
    setTogglingActive(u.id)
    try {
      const res = await fetch(`${AUTH}/auth/users/${u.id}/active`, {
        method: 'PUT', headers: hdrs(), credentials: 'include',
        body: JSON.stringify({ is_active: !u.is_active }),
      })
      if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x))
      else { const data = await res.json(); setError(data.error || 'Toggle failed') }
    } catch (err: any) { setError(err.message) }
    finally { setTogglingActive(null) }
  }

  const handleDelete = async (userId: string) => {
    setDeletingId(userId)
    try {
      const res = await fetch(`${AUTH}/auth/users/${userId}`, {
        method: 'DELETE', headers: hdrs(), credentials: 'include',
      })
      if (res.ok) { setUsers(prev => prev.filter(u => u.id !== userId)); setConfirmDeleteId(null) }
      else { const data = await res.json(); setError(data.error || 'Delete failed') }
    } catch (err: any) { setError(err.message) }
    finally { setDeletingId(null) }
  }

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.is_active).length
  const adminCount = users.filter(u => u.role === 'admin').length
  const activeSessions = sessions.length

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING AUTH DATA...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Auth <span style={{ color: 'var(--highlight)' }}>Management</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>User accounts &amp; sessions</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          AUTH SERVICE
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

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <StatCard label="Total Users" value={totalUsers} sub="All registered accounts" color="var(--accent)" />
        <StatCard label="Active Users" value={activeUsers} sub={`${totalUsers - activeUsers} disabled`} color="var(--success)" />
        <StatCard label="Admins" value={adminCount} sub={`${totalUsers - adminCount} viewers`} color="var(--highlight)" />
        <StatCard label="Active Sessions" value={activeSessions} sub="Current sessions" color="#a78bfa" />
      </div>

      {/* Users Table */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Users</h3>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Username', 'Email', 'Role', 'Created', 'Last Login', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '14px 20px', textAlign: h === 'Actions' ? 'right' : 'left',
                    fontFamily: "'Courier New', monospace", fontSize: '0.75rem',
                    letterSpacing: '1px', color: 'var(--muted)', fontWeight: 600,
                    background: 'rgba(76, 201, 240, 0.05)',
                    borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>No users found</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; if (confirmDeleteId === u.id) setConfirmDeleteId(null) }}
                  >
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                      {u.username}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                        fontFamily: "'Courier New', monospace", fontSize: '0.75rem', fontWeight: 700,
                        background: u.role === 'admin' ? 'rgba(255,180,0,0.1)' : 'rgba(76,201,240,0.1)',
                        color: u.role === 'admin' ? 'var(--highlight)' : 'var(--accent)',
                        border: `1px solid ${u.role === 'admin' ? 'rgba(255,180,0,0.3)' : 'rgba(76,201,240,0.3)'}`,
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {formatDate(u.created_at)}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {u.last_login ? timeAgo(u.last_login) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                        background: u.is_active ? 'var(--success)' : 'var(--red)',
                        boxShadow: u.is_active ? '0 0 6px var(--success)' : '0 0 6px var(--red)',
                      }} />
                    </td>
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={togglingRole === u.id}
                          style={{
                            ...actionBtnStyle,
                            opacity: togglingRole === u.id ? 0.5 : 1,
                            cursor: togglingRole === u.id ? 'wait' : 'pointer',
                          }}
                        >
                          {togglingRole === u.id ? '...' : u.role === 'admin' ? 'VIEWER' : 'ADMIN'}
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={togglingActive === u.id}
                          style={{
                            ...actionBtnStyle,
                            opacity: togglingActive === u.id ? 0.5 : 1,
                            cursor: togglingActive === u.id ? 'wait' : 'pointer',
                          }}
                        >
                          {togglingActive === u.id ? '...' : u.is_active ? 'DISABLE' : 'ENABLE'}
                        </button>
                        {currentUser?.id === u.id ? (
                          <button disabled style={{ ...actionBtnStyle, opacity: 0.3, cursor: 'not-allowed' }}>DEL</button>
                        ) : confirmDeleteId === u.id ? (
                          <button onClick={() => handleDelete(u.id)} disabled={deletingId === u.id} style={{
                            ...actionBtnStyle, background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)',
                          }}>
                            {deletingId === u.id ? '...' : 'SURE?'}
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(u.id)} style={actionBtnStyle}>DEL</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessions Table */}
      <div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Sessions</h3>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Username', 'Created', 'Expires'].map(h => (
                  <th key={h} style={{
                    padding: '14px 20px', textAlign: 'left',
                    fontFamily: "'Courier New', monospace", fontSize: '0.75rem',
                    letterSpacing: '1px', color: 'var(--muted)', fontWeight: 600,
                    background: 'rgba(76, 201, 240, 0.05)',
                    borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>No active sessions</td></tr>
              ) : (
                sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                      {s.username}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {formatDate(s.created_at)}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {formatDate(s.expires_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--muted)', fontFamily: "'Courier New', monospace",
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s', letterSpacing: '0.5px',
}
