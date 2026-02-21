'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const WAF = process.env.NEXT_PUBLIC_WAF_URL || 'https://waf.sebhosting.com'

type IpRule = {
  id: string; ip_address: string; action: string; reason: string
  expires_at: string | null; created_at: string
}
type RateRule = {
  id: string; path_pattern: string; max_requests: number; window_seconds: number
  action: string; enabled: boolean; created_at: string; updated_at: string
}
type BlockedEntry = {
  id: string; ip: string; path: string; rule: string; blocked_at: string
}
type WafStats = {
  blocked_24h: number; active_ip_rules: number; active_rate_rules: number
  top_blocked_ip: string | null
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

const emptyIpForm = { ip_address: '', action: 'block', reason: '', expires_at: '' }
const emptyRateForm = { path_pattern: '', max_requests: 100, window_seconds: 60, action: 'block', enabled: true }

export default function WafPage() {
  const { accessToken } = useAuth()
  const [tab, setTab] = useState<'ip' | 'rate' | 'blocked'>('ip')
  const [ipRules, setIpRules] = useState<IpRule[]>([])
  const [rateRules, setRateRules] = useState<RateRule[]>([])
  const [blocked, setBlocked] = useState<BlockedEntry[]>([])
  const [stats, setStats] = useState<WafStats>({ blocked_24h: 0, active_ip_rules: 0, active_rate_rules: 0, top_blocked_ip: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [ipForm, setIpForm] = useState(emptyIpForm)
  const [rateForm, setRateForm] = useState(emptyRateForm)
  const [saving, setSaving] = useState(false)

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadIpRules = async () => {
    try {
      const res = await fetch(`${WAF}/rules/ip`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setIpRules(Array.isArray(data) ? data : data.result || data.rules || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadRateRules = async () => {
    try {
      const res = await fetch(`${WAF}/rules/rate`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setRateRules(Array.isArray(data) ? data : data.result || data.rules || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadBlocked = async () => {
    try {
      const res = await fetch(`${WAF}/blocked?limit=50&offset=0`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setBlocked(Array.isArray(data) ? data : data.result || data.blocked || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch(`${WAF}/stats`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setStats({
        blocked_24h: data.blocked_24h ?? data.blocked_count ?? 0,
        active_ip_rules: data.active_ip_rules ?? 0,
        active_rate_rules: data.active_rate_rules ?? 0,
        top_blocked_ip: data.top_blocked_ip ?? data.top_blocked_ips?.[0] ?? null,
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadIpRules(), loadRateRules(), loadBlocked(), loadStats()])
      setLoading(false)
    })()
  }, [accessToken])

  const handleSaveIp = async () => {
    setSaving(true); setError('')
    try {
      const body = {
        ip_address: ipForm.ip_address,
        action: ipForm.action,
        reason: ipForm.reason,
        expires_at: ipForm.expires_at || null,
      }
      const res = await fetch(`${WAF}/rules/ip`, { method: 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
      setShowForm(false); setIpForm(emptyIpForm); await Promise.all([loadIpRules(), loadStats()])
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleSaveRate = async () => {
    setSaving(true); setError('')
    try {
      const body = {
        path_pattern: rateForm.path_pattern,
        max_requests: Number(rateForm.max_requests),
        window_seconds: Number(rateForm.window_seconds),
        action: rateForm.action,
        enabled: rateForm.enabled,
      }
      const url = editingId ? `${WAF}/rules/rate/${editingId}` : `${WAF}/rules/rate`
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
      setShowForm(false); setEditingId(null); setRateForm(emptyRateForm); await Promise.all([loadRateRules(), loadStats()])
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDeleteIp = async (id: string) => {
    try {
      const res = await fetch(`${WAF}/rules/ip/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setIpRules(prev => prev.filter(r => r.id !== id))
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const handleDeleteRate = async (id: string) => {
    try {
      const res = await fetch(`${WAF}/rules/rate/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setRateRules(prev => prev.filter(r => r.id !== id))
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const handleClearBlocked = async () => {
    try {
      const res = await fetch(`${WAF}/blocked/clear`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Clear failed') }
      setBlocked([])
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const startEditRate = (rule: RateRule) => {
    setEditingId(rule.id)
    setRateForm({
      path_pattern: rule.path_pattern,
      max_requests: rule.max_requests,
      window_seconds: rule.window_seconds,
      action: rule.action,
      enabled: rule.enabled,
    })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING WAF...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Web Application <span style={{ color: 'var(--highlight)' }}>Firewall</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Manage IP rules, rate limits, and blocked requests</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          WAF
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
        <StatCard label="Blocked 24h" value={stats.blocked_24h} sub="requests denied" color="#ef4444" />
        <StatCard label="IP Rules" value={stats.active_ip_rules} sub={`${ipRules.filter(r => r.action === 'block').length} blocking`} color="#4cc9f0" />
        <StatCard label="Rate Rules" value={stats.active_rate_rules} sub={`${rateRules.filter(r => r.enabled).length} enabled`} color="#22c55e" />
        <StatCard label="Top Blocked IP" value={stats.top_blocked_ip || '--'} color="#ffb400" />
      </div>

      {/* Tab bar + Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {([['ip', 'IP Rules'], ['rate', 'Rate Limits'], ['blocked', 'Blocked Log']] as const).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setShowForm(false); setEditingId(null) }} style={{
              padding: '10px 22px', border: 'none', cursor: 'pointer',
              fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s',
              background: tab === t ? 'rgba(255,180,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: tab === t ? 'var(--highlight)' : 'var(--muted)',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {tab === 'ip' && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setIpForm(emptyIpForm) }}
            style={{
              padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
              transition: 'all 0.3s', textTransform: 'uppercase',
            }}
          >
            + New IP Rule
          </button>
        )}
        {tab === 'rate' && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setRateForm(emptyRateForm) }}
            style={{
              padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
              transition: 'all 0.3s', textTransform: 'uppercase',
            }}
          >
            + New Rate Rule
          </button>
        )}
        {tab === 'blocked' && (
          <ClearLogButton onClear={handleClearBlocked} />
        )}
      </div>

      {/* IP Rules Form */}
      {showForm && tab === 'ip' && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            New IP Rule
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>IP Address</label>
              <input value={ipForm.ip_address} onChange={e => setIpForm({ ...ipForm, ip_address: e.target.value })} placeholder="192.168.1.100 or CIDR" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Action</label>
              <select value={ipForm.action} onChange={e => setIpForm({ ...ipForm, action: e.target.value })} style={selectStyle}>
                <option value="block">Block</option>
                <option value="allow">Allow</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input value={ipForm.reason} onChange={e => setIpForm({ ...ipForm, reason: e.target.value })} placeholder="Reason for rule" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expires At</label>
              <input type="date" value={ipForm.expires_at} onChange={e => setIpForm({ ...ipForm, expires_at: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSaveIp} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setIpForm(emptyIpForm) }} style={{
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

      {/* Rate Rules Form */}
      {showForm && tab === 'rate' && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            {editingId ? 'Edit Rate Rule' : 'New Rate Rule'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Path Pattern</label>
              <input value={rateForm.path_pattern} onChange={e => setRateForm({ ...rateForm, path_pattern: e.target.value })} placeholder="/api/* or /login" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Max Requests</label>
              <input type="number" value={rateForm.max_requests} onChange={e => setRateForm({ ...rateForm, max_requests: Number(e.target.value) })} placeholder="100" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Window (seconds)</label>
              <input type="number" value={rateForm.window_seconds} onChange={e => setRateForm({ ...rateForm, window_seconds: Number(e.target.value) })} placeholder="60" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Action</label>
              <select value={rateForm.action} onChange={e => setRateForm({ ...rateForm, action: e.target.value })} style={selectStyle}>
                <option value="block">Block</option>
                <option value="throttle">Throttle</option>
                <option value="log">Log Only</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <button onClick={() => setRateForm({ ...rateForm, enabled: !rateForm.enabled })} style={{
                padding: '10px 18px', borderRadius: '8px',
                border: rateForm.enabled ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                background: rateForm.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                color: rateForm.enabled ? 'var(--success)' : 'var(--muted)',
                fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.3s',
              }}>
                {rateForm.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSaveRate} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setRateForm(emptyRateForm) }} style={{
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

      {/* IP Rules Table */}
      {tab === 'ip' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['IP Address', 'Action', 'Reason', 'Expires', 'Actions'].map(h => (
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
              {ipRules.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No IP rules found
                </td></tr>
              ) : (
                ipRules.map(rule => (
                  <IpRuleRow key={rule.id} rule={rule} onDelete={() => handleDeleteIp(rule.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rate Rules Table */}
      {tab === 'rate' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Path', 'Max Requests', 'Window', 'Action', 'Enabled', 'Actions'].map(h => (
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
              {rateRules.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No rate rules found
                </td></tr>
              ) : (
                rateRules.map(rule => (
                  <RateRuleRow key={rule.id} rule={rule} onEdit={() => startEditRate(rule)} onDelete={() => handleDeleteRate(rule.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Blocked Log Table */}
      {tab === 'blocked' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['IP', 'Path', 'Rule', 'Blocked At'].map(h => (
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
              {blocked.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No blocked requests
                </td></tr>
              ) : (
                blocked.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                      {entry.ip}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.path}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {entry.rule}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {entry.blocked_at ? timeAgo(entry.blocked_at) : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function IpRuleRow({ rule, onDelete }: { rule: IpRule; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isBlock = rule.action === 'block'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
        {rule.ip_address}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: isBlock ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          color: isBlock ? '#ef4444' : '#22c55e',
          border: `1px solid ${isBlock ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
        }}>
          {rule.action.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontSize: '0.9rem', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {rule.reason || '--'}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {rule.expires_at ? new Date(rule.expires_at).toLocaleDateString() : 'Never'}
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
  )
}

function RateRuleRow({ rule, onEdit, onDelete }: { rule: RateRule; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {rule.path_pattern}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
        {rule.max_requests}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
        {rule.window_seconds}s
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: rule.action === 'block' ? 'rgba(239,68,68,0.1)' : rule.action === 'throttle' ? 'rgba(255,180,0,0.1)' : 'rgba(76,201,240,0.1)',
          color: rule.action === 'block' ? '#ef4444' : rule.action === 'throttle' ? '#ffb400' : '#4cc9f0',
          border: `1px solid ${rule.action === 'block' ? 'rgba(239,68,68,0.3)' : rule.action === 'throttle' ? 'rgba(255,180,0,0.3)' : 'rgba(76,201,240,0.3)'}`,
        }}>
          {rule.action.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
          background: rule.enabled ? '#22c55e' : 'var(--muted)',
          boxShadow: rule.enabled ? '0 0 6px rgba(34,197,94,0.4)' : 'none',
        }} />
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} style={actionBtnStyle}>EDIT</button>
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
  )
}

function ClearLogButton({ onClear }: { onClear: () => void }) {
  const [confirmClear, setConfirmClear] = useState(false)

  return confirmClear ? (
    <button
      onClick={() => { onClear(); setConfirmClear(false) }}
      onMouseLeave={() => setConfirmClear(false)}
      style={{
        padding: '10px 22px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)',
        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontWeight: 700,
        fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
        transition: 'all 0.3s', textTransform: 'uppercase',
      }}
    >
      SURE?
    </button>
  ) : (
    <button
      onClick={() => setConfirmClear(true)}
      style={{
        padding: '10px 22px', background: 'rgba(239,68,68,0.08)', color: 'var(--red)',
        border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontWeight: 700,
        fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
        transition: 'all 0.3s', textTransform: 'uppercase',
      }}
    >
      Clear Log
    </button>
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
  width: '100%',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--muted)', fontFamily: "'Courier New', monospace",
  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
  transition: 'all 0.2s', letterSpacing: '0.5px',
}
