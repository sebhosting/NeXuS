'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.sebhosting.com'

interface Container {
  id: string; name: string; image: string; status: string
  state: string; ports: string; cpu: string; mem: string
  memPerc: string; net: string
}

interface Stats {
  timestamp: string; total: number; running: number; stopped: number
  docker: { serverVersion?: string; images?: string }
  host: { load1?: number; load5?: number; memTotal?: number; memUsed?: number; memPercent?: number }
  containers: Container[]
}

function StatCard({ label, value, sub, color = 'var(--accent)' }: any) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '24px 28px',
      position: 'relative', overflow: 'hidden', transition: 'all 0.3s',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '10px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '2.8rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

function MiniBar({ value, color = 'var(--accent)' }: { value: number, color?: string }) {
  return (
    <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, transition: 'width 0.5s ease', borderRadius: '2px' }} />
    </div>
  )
}

export default function DashboardPage() {
  const { accessToken } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setStats(data)
      setLastUpdate(new Date().toLocaleTimeString('en-US', { hour12: false }))
      setError('')
    } catch (err: any) {
      setError(`Failed to fetch stats: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => clearInterval(id)
  }, [fetchStats])

  const stateColor = (state: string) => state === 'running' ? 'var(--success)' : 'var(--red)'
  const cpuNum = (cpu: string) => parseFloat(cpu?.replace('%', '') || '0')
  const cpuColor = (cpu: string) => {
    const n = cpuNum(cpu)
    if (n > 80) return 'var(--red)'
    if (n > 50) return 'var(--highlight)'
    return 'var(--success)'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px' }}>
            System <span style={{ color: 'var(--highlight)' }}>Overview</span>
          </h1>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px' }}>
            Live Docker metrics · auto-refresh every 5s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdate && (
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
              Updated {lastUpdate}
            </span>
          )}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: error ? 'var(--red)' : 'var(--success)', boxShadow: `0 0 6px ${error ? 'var(--red)' : 'var(--success)'}`, animation: 'pulse 2s infinite' }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', marginBottom: '24px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
          LOADING METRICS...
        </div>
      ) : stats ? (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
            <StatCard label="Containers Running" value={stats.running} sub={`${stats.total} total`} color="var(--success)" />
            <StatCard label="Containers Stopped" value={stats.stopped} sub="unhealthy" color={stats.stopped > 0 ? 'var(--red)' : 'var(--muted)'} />
            <StatCard label="Host Memory" value={`${stats.host.memPercent ?? '—'}%`}
              sub={stats.host.memUsed ? `${Math.round(stats.host.memUsed / 1024 / 1024 / 1024 * 10) / 10}GB / ${Math.round((stats.host.memTotal || 0) / 1024 / 1024 / 1024 * 10) / 10}GB` : ''}
              color="var(--accent)" />
            <StatCard label="Load Avg (1m)" value={stats.host.load1?.toFixed(2) ?? '—'}
              sub={`5m: ${stats.host.load5?.toFixed(2) ?? '—'}`}
              color="var(--accent)" />
          </div>

          {/* Container Table */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                Containers
              </h2>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)' }}>
                Docker {stats.docker.serverVersion} · {stats.docker.images} images
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Status', 'Name', 'Image', 'CPU', 'Memory', 'Network'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px', textAlign: 'left',
                        fontFamily: "'Courier New', monospace", fontSize: '0.75rem',
                        letterSpacing: '1px', color: 'var(--muted)', fontWeight: 600,
                        background: 'rgba(76, 201, 240, 0.05)',
                        borderBottom: '1px solid var(--border)',
                        textTransform: 'uppercase',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.containers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stateColor(c.state), boxShadow: `0 0 5px ${stateColor(c.state)}`, animation: c.state === 'running' ? 'pulse 3s infinite' : 'none', flexShrink: 0 }} />
                          <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: stateColor(c.state), letterSpacing: '0.5px' }}>
                            {c.state.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                          {c.name.replace('nexus-', '')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {c.image.replace('docker-', '').split(':')[0]}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: cpuColor(c.cpu), minWidth: '48px' }}>{c.cpu}</span>
                          <MiniBar value={cpuNum(c.cpu)} color={cpuColor(c.cpu)} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>{c.mem}</span>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '6px', opacity: 0.6 }}>({c.memPerc})</span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>{c.net}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
