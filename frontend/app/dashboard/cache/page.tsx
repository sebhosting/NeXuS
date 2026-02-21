'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const CACHE = process.env.NEXT_PUBLIC_CACHE_URL || 'https://cache.sebhosting.com'

type CacheStats = {
  hits: number; misses: number; memory_used: string; total_keys: number
}

type CacheKey = {
  key: string; type: string; ttl: number
}

const TYPE_COLORS: Record<string, string> = {
  string: '#4cc9f0', hash: '#22c55e', list: '#ffb400', set: '#a78bfa',
  zset: '#f97316', stream: '#ef4444', none: '#8ea2b5',
}

function formatTtl(ttl: number): string {
  if (ttl < 0) return 'NO EXPIRY'
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
  return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`
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

export default function CachePage() {
  const { accessToken } = useAuth()
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [keys, setKeys] = useState<CacheKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pattern, setPattern] = useState('*')
  const [scanning, setScanning] = useState(false)

  const [showSetForm, setShowSetForm] = useState(false)
  const [keyForm, setKeyForm] = useState({ key: '', value: '', ttl: '' })
  const [saving, setSaving] = useState(false)

  const [viewingKey, setViewingKey] = useState<string | null>(null)
  const [viewValue, setViewValue] = useState<string>('')
  const [viewLoading, setViewLoading] = useState(false)

  const [flushConfirm, setFlushConfirm] = useState(false)
  const [flushing, setFlushing] = useState(false)

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadStats = async () => {
    try {
      const res = await fetch(`${CACHE}/stats`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const scanKeys = async (p?: string) => {
    setScanning(true); setError('')
    try {
      const q = encodeURIComponent(p ?? pattern)
      const res = await fetch(`${CACHE}/keys?pattern=${q}`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setKeys(Array.isArray(data) ? data : data.result || data.keys || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadStats(), scanKeys('*')])
      setLoading(false)
    })()
  }, [accessToken])

  const handleFlush = async () => {
    if (!flushConfirm) { setFlushConfirm(true); return }
    setFlushing(true); setError('')
    try {
      const res = await fetch(`${CACHE}/flush`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Flush failed') }
      setFlushConfirm(false)
      await Promise.all([loadStats(), scanKeys('*')])
    } catch (err: any) { setError(err.message) }
    finally { setFlushing(false) }
  }

  const handleSetKey = async () => {
    setSaving(true); setError('')
    try {
      const body: any = { key: keyForm.key, value: keyForm.value }
      if (keyForm.ttl) body.ttl = parseInt(keyForm.ttl, 10)
      const res = await fetch(`${CACHE}/key`, { method: 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Set key failed') }
      setShowSetForm(false); setKeyForm({ key: '', value: '', ttl: '' })
      await Promise.all([loadStats(), scanKeys()])
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleViewKey = async (key: string) => {
    if (viewingKey === key) { setViewingKey(null); setViewValue(''); return }
    setViewingKey(key); setViewLoading(true); setViewValue('')
    try {
      const res = await fetch(`${CACHE}/key/${encodeURIComponent(key)}`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setViewValue(typeof data === 'string' ? data : typeof data.value === 'string' ? data.value : JSON.stringify(data.value ?? data, null, 2))
    } catch (err: any) {
      setViewValue(`Error: ${err.message}`)
    } finally {
      setViewLoading(false)
    }
  }

  const handleDeleteKey = async (key: string) => {
    try {
      const res = await fetch(`${CACHE}/key/${encodeURIComponent(key)}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setKeys(prev => prev.filter(k => k.key !== key))
      if (viewingKey === key) { setViewingKey(null); setViewValue('') }
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const hitRatio = stats ? (stats.hits + stats.misses > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1) : '0.0') : '0.0'

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING CACHE...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Cache <span style={{ color: 'var(--highlight)' }}>Manager</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Redis cache monitoring and management</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          REDIS
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="Hits" value={stats?.hits ?? 0} color="#22c55e" />
        <StatCard label="Misses" value={stats?.misses ?? 0} color="#ef4444" />
        <StatCard label="Hit Ratio" value={`${hitRatio}%`} color="#4cc9f0" />
        <StatCard label="Memory Used" value={stats?.memory_used ?? '--'} color="#a78bfa" />
        <StatCard label="Total Keys" value={stats?.total_keys ?? 0} color="#ffb400" />
      </div>

      {/* Actions Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleFlush}
          disabled={flushing}
          onMouseLeave={() => setFlushConfirm(false)}
          style={{
            padding: '10px 22px', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '1px',
            cursor: flushing ? 'wait' : 'pointer', transition: 'all 0.3s', textTransform: 'uppercase',
            borderRadius: 'var(--radius-sm)', border: 'none',
            ...(flushConfirm
              ? { background: 'rgba(239,68,68,0.15)', color: 'var(--red)' }
              : { background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', border: '1px solid var(--border)' }
            ),
          }}
        >
          {flushing ? 'Flushing...' : flushConfirm ? 'Confirm Flush?' : 'Flush All'}
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { setShowSetForm(!showSetForm) }}
          style={{
            padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
            border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
            transition: 'all 0.3s', textTransform: 'uppercase',
          }}
        >
          + Set Key
        </button>
      </div>

      {/* Set Key Form */}
      {showSetForm && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            Set Key
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Key</label>
              <input value={keyForm.key} onChange={e => setKeyForm({ ...keyForm, key: e.target.value })} placeholder="cache:key:name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TTL (seconds)</label>
              <input type="number" value={keyForm.ttl} onChange={e => setKeyForm({ ...keyForm, ttl: e.target.value })} placeholder="optional" style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Value</label>
              <textarea value={keyForm.value} onChange={e => setKeyForm({ ...keyForm, value: e.target.value })} placeholder="Value..." style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSetKey} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Setting...' : 'Set Key'}
            </button>
            <button onClick={() => { setShowSetForm(false); setKeyForm({ key: '', value: '', ttl: '' }) }} style={{
              padding: '10px 28px', background: 'rgba(255,255,255,0.03)',
              color: 'var(--muted)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Key Browser */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="Pattern (e.g. user:*)" style={{ ...inputStyle, flex: 1, maxWidth: '360px' }}
          onKeyDown={e => { if (e.key === 'Enter') scanKeys() }}
        />
        <button onClick={() => scanKeys()} disabled={scanning} style={{
          padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
          border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
          fontSize: '0.9rem', letterSpacing: '1px', cursor: scanning ? 'wait' : 'pointer',
          opacity: scanning ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
        }}>
          {scanning ? 'Scanning...' : 'Scan'}
        </button>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
          {keys.length} key{keys.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Keys Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Key', 'Type', 'TTL', 'Actions'].map(h => (
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
            {keys.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                No keys found
              </td></tr>
            ) : (
              keys.map(k => (
                <KeyRow
                  key={k.key}
                  cacheKey={k}
                  onView={() => handleViewKey(k.key)}
                  onDelete={() => handleDeleteKey(k.key)}
                  viewing={viewingKey === k.key}
                  viewValue={viewingKey === k.key ? viewValue : ''}
                  viewLoading={viewingKey === k.key && viewLoading}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KeyRow({ cacheKey, onView, onDelete, viewing, viewValue, viewLoading }: {
  cacheKey: CacheKey; onView: () => void; onDelete: () => void
  viewing: boolean; viewValue: string; viewLoading: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const typeColor = TYPE_COLORS[cacheKey.type] || '#8ea2b5'

  return (
    <>
      <tr style={{ borderBottom: viewing ? 'none' : '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
      >
        <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cacheKey.key}
        </td>
        <td style={{ padding: '12px 20px' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
            fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
            background: `${typeColor}15`, color: typeColor, border: `1px solid ${typeColor}30`,
          }}>
            {cacheKey.type.toUpperCase()}
          </span>
        </td>
        <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: cacheKey.ttl < 0 ? 'var(--muted)' : 'var(--text)' }}>
          {formatTtl(cacheKey.ttl)}
        </td>
        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={(e) => { e.stopPropagation(); onView() }} style={{
              ...actionBtnStyle,
              ...(viewing ? { background: 'rgba(76,201,240,0.1)', border: '1px solid rgba(76,201,240,0.3)', color: '#4cc9f0' } : {}),
            }}>
              VIEW
            </button>
            {confirmDelete ? (
              <button onClick={onDelete} style={{
                ...actionBtnStyle, background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)',
              }}>
                SURE?
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={actionBtnStyle}>DEL</button>
            )}
          </div>
        </td>
      </tr>
      {viewing && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td colSpan={4} style={{ padding: '0 20px 16px 20px' }}>
            <div style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '16px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem',
              color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: '300px', overflowY: 'auto',
            }}>
              {viewLoading ? (
                <span style={{ color: 'var(--accent)', letterSpacing: '2px' }}>LOADING...</span>
              ) : (
                viewValue || <span style={{ color: 'var(--muted)' }}>empty</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
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

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--muted)', fontFamily: "'Courier New', monospace",
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s', letterSpacing: '0.5px',
}
