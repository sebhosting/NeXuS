'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const AI = process.env.NEXT_PUBLIC_AI_URL || 'https://ai-gateway.sebhosting.com'

type Stats = {
  requests_24h: number; total_tokens_24h: number
  avg_latency_ms: number; models_used: number
}

type HistoryEntry = {
  date: string; requests: number; input_tokens: number
  output_tokens: number; total_tokens: number; avg_latency: number
}

type RequestEntry = {
  id: string; model: string; prompt_tokens: number
  completion_tokens: number; total_tokens: number
  latency_ms: number; status: string; error: string | null
  created_at: string
}

type Config = {
  default_model: string; max_tokens: number
  [key: string]: string | number
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
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

export default function AiGatewayPage() {
  const { accessToken } = useAuth()
  const [tab, setTab] = useState<'history' | 'requests' | 'config'>('history')
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [requests, setRequests] = useState<RequestEntry[]>([])
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Config form
  const [configForm, setConfigForm] = useState({ default_model: '', max_tokens: '' })
  const [saving, setSaving] = useState(false)

  // Pagination
  const [reqOffset, setReqOffset] = useState(0)
  const reqLimit = 50

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadStats = async () => {
    try {
      const res = await fetch(`${AI}/stats`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      const models = data.models || []
      const totalRequests = models.reduce((s: number, m: any) => s + Number(m.total_requests || 0), 0)
      const totalTokens = models.reduce((s: number, m: any) => s + Number(m.total_tokens || 0), 0)
      const avgLatency = models.length > 0
        ? Math.round(models.reduce((s: number, m: any) => s + Number(m.avg_latency_ms || 0), 0) / models.length)
        : 0
      setStats({
        requests_24h: totalRequests,
        total_tokens_24h: totalTokens,
        avg_latency_ms: avgLatency,
        models_used: models.length,
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadHistory = async () => {
    try {
      const res = await fetch(`${AI}/stats/history`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setHistory(Array.isArray(data) ? data : data.result || data.history || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadRequests = async (offset = 0) => {
    try {
      const res = await fetch(`${AI}/stats/requests?limit=${reqLimit}&offset=${offset}`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : data.result || data.requests || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch(`${AI}/config`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setConfig(data)
      setConfigForm({
        default_model: data.default_model || '',
        max_tokens: data.max_tokens != null ? String(data.max_tokens) : '',
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadStats(), loadHistory(), loadRequests(0), loadConfig()])
      setLoading(false)
    })()
  }, [accessToken])

  const handleSaveConfig = async () => {
    setSaving(true); setError('')
    try {
      const body: Record<string, string | number> = {}
      if (configForm.default_model) body.default_model = configForm.default_model
      if (configForm.max_tokens) body.max_tokens = Number(configForm.max_tokens)
      const res = await fetch(`${AI}/config`, { method: 'PUT', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
      await loadConfig()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handlePrevPage = () => {
    const newOffset = Math.max(0, reqOffset - reqLimit)
    setReqOffset(newOffset)
    loadRequests(newOffset)
  }

  const handleNextPage = () => {
    const newOffset = reqOffset + reqLimit
    setReqOffset(newOffset)
    loadRequests(newOffset)
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING AI GATEWAY...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            AI <span style={{ color: 'var(--highlight)' }}>Gateway</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Manage AI model routing, usage and configuration</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          AI
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="Requests 24h" value={stats ? stats.requests_24h.toLocaleString() : '--'} color="#4cc9f0" />
        <StatCard label="Total Tokens" value={stats ? stats.total_tokens_24h.toLocaleString() : '--'} sub="last 24 hours" color="#22c55e" />
        <StatCard label="Avg Latency" value={stats ? `${stats.avg_latency_ms.toLocaleString()}ms` : '--'} color="#ffb400" />
        <StatCard label="Models Used" value={stats ? stats.models_used.toLocaleString() : '--'} color="#a855f7" />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {([
            { key: 'history' as const, label: 'Usage History' },
            { key: 'requests' as const, label: 'Recent Requests' },
            { key: 'config' as const, label: 'Configuration' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 22px', border: 'none', cursor: 'pointer',
              fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s',
              background: tab === t.key ? 'rgba(255,180,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: tab === t.key ? 'var(--highlight)' : 'var(--muted)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Usage History Tab */}
      {tab === 'history' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Requests', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Avg Latency'].map(h => (
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
              {history.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No usage history found
                </td></tr>
              ) : (
                history.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {entry.date}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {Number(entry.requests || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {Number(entry.input_tokens || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {Number(entry.output_tokens || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                      {Number(entry.total_tokens || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                      {Number(entry.avg_latency || 0).toLocaleString()}ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Requests Tab */}
      {tab === 'requests' && (
        <>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Model', 'Tokens In', 'Tokens Out', 'Latency', 'Status', 'Time'].map(h => (
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
                {requests.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                    No recent requests found
                  </td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>
                        {req.model}
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                        {(req.prompt_tokens ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                        {(req.completion_tokens ?? 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                        {(req.latency_ms ?? 0).toLocaleString()}ms
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
                          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
                          background: Number(req.status) < 400 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: Number(req.status) < 400 ? '#22c55e' : '#ef4444',
                          border: `1px solid ${Number(req.status) < 400 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                          {String(req.status)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {req.created_at ? timeAgo(req.created_at) : '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button onClick={handlePrevPage} disabled={reqOffset === 0} style={{
              ...actionBtnStyle,
              opacity: reqOffset === 0 ? 0.4 : 1,
              cursor: reqOffset === 0 ? 'not-allowed' : 'pointer',
            }}>
              PREV
            </button>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
              {reqOffset + 1}&ndash;{reqOffset + requests.length}
            </span>
            <button onClick={handleNextPage} disabled={requests.length < reqLimit} style={{
              ...actionBtnStyle,
              opacity: requests.length < reqLimit ? 0.4 : 1,
              cursor: requests.length < reqLimit ? 'not-allowed' : 'pointer',
            }}>
              NEXT
            </button>
          </div>
        </>
      )}

      {/* Configuration Tab */}
      {tab === 'config' && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            Model Configuration
          </div>

          {config && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Default Model</label>
                <input
                  value={configForm.default_model}
                  onChange={e => setConfigForm({ ...configForm, default_model: e.target.value })}
                  placeholder="e.g. gpt-4o"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Max Tokens</label>
                <input
                  value={configForm.max_tokens}
                  onChange={e => setConfigForm({ ...configForm, max_tokens: e.target.value })}
                  placeholder="e.g. 4096"
                  type="number"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSaveConfig} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => {
              if (config) {
                setConfigForm({
                  default_model: config.default_model || '',
                  max_tokens: config.max_tokens != null ? String(config.max_tokens) : '',
                })
              }
            }} style={{
              padding: '10px 28px', background: 'rgba(255,255,255,0.03)',
              color: 'var(--muted)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
            }}>
              Reset
            </button>
          </div>
        </div>
      )}
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

const selectStyle: React.CSSProperties = {
  padding: '10px 14px', background: 'var(--panel)',
  border: '1px solid var(--border)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '0.9rem', cursor: 'pointer',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--muted)', fontFamily: "'Courier New', monospace",
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s', letterSpacing: '0.5px',
}
