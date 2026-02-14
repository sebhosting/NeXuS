'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/AuthContext'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.sebhosting.com'

interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
  ports: string
  cpu: string
  mem: string
  memPerc: string
  net: string
}

interface Stats {
  timestamp: string
  total: number
  running: number
  stopped: number
  docker: { serverVersion?: string; images?: string }
  host: {
    load1?: number
    load5?: number
    memTotal?: number
    memUsed?: number
    memPercent?: number
  }
  containers: Container[]
}

function StatCard({ label, value, sub, color = 'var(--cyan)' }: any) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: '6px', padding: '20px 24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color, boxShadow: `0 0 8px ${color}` }} />
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '2px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: 'Rajdhani', fontSize: '36px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function MiniBar({ value, color = 'var(--cyan)' }: { value: number, color?: string }) {
  return (
    <div style={{ width: '60px', height: '4px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, transition: 'width 0.5s ease', borderRadius: '2px' }} />
    </div>
  )
}

export default function DashboardPage() {
  const { accessToken } = useAuth()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')
  const [tick, setTick]       = useState(0)

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

  // Poll every 5 seconds
  useEffect(() => {
    fetchStats()
    const id = setInterval(() => {
      fetchStats()
      setTick(t => t + 1)
    }, 5000)
    return () => clearInterval(id)
  }, [fetchStats])

  const stateColor = (state: string) => state === 'running' ? 'var(--green)' : 'var(--red)'
  const cpuNum = (cpu: string) => parseFloat(cpu?.replace('%','') || '0')
  const cpuColor = (cpu: string) => {
    const n = cpuNum(cpu)
    if (n > 80) return 'var(--red)'
    if (n > 50) return 'var(--yellow, #ffcc00)'
    return 'var(--green)'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'Rajdhani', fontSize: '22px', fontWeight: 700, letterSpacing: '3px', color: 'var(--text-primary)' }}>
            SYSTEM OVERVIEW
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
            Live Docker metrics · auto-refresh every 5s
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastUpdate && (
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-muted)' }}>
              Updated {lastUpdate}
            </span>
          )}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: error ? 'var(--red)' : 'var(--green)', boxShadow: `0 0 6px ${error ? 'var(--red)' : 'var(--green)'}`, animation: 'pulse 2s infinite' }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '20px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: '4px', fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--red)' }}>
          ⚠ {error}
        </div>
      )}

      {loading && !stats ? (
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'var(--cyan)', letterSpacing: '2px', padding: '40px 0' }}>
          LOADING METRICS...
        </div>
      ) : stats ? (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <StatCard label="CONTAINERS RUNNING" value={stats.running} sub={`${stats.total} total`} color="var(--green)" />
            <StatCard label="CONTAINERS STOPPED" value={stats.stopped} sub="unhealthy" color={stats.stopped > 0 ? 'var(--red)' : 'var(--text-dim)'} />
            <StatCard label="HOST MEMORY" value={`${stats.host.memPercent ?? '—'}%`}
              sub={stats.host.memUsed ? `${Math.round(stats.host.memUsed/1024/1024/1024*10)/10}GB / ${Math.round((stats.host.memTotal||0)/1024/1024/1024*10)/10}GB` : ''}
              color="var(--cyan)" />
            <StatCard label="LOAD AVG (1m)" value={stats.host.load1?.toFixed(2) ?? '—'}
              sub={`5m: ${stats.host.load5?.toFixed(2) ?? '—'}`}
              color="var(--cyan)" />
          </div>

          {/* Container Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Rajdhani', fontSize: '14px', fontWeight: 700, letterSpacing: '2px', color: 'var(--text-primary)' }}>
                CONTAINERS
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
                Docker {stats.docker.serverVersion} · {stats.docker.images} images
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['STATUS','NAME','IMAGE','CPU','MEMORY','NETWORK'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'JetBrains Mono', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.containers.map((c, i) => (
                    <tr key={c.id} style={{
                      borderBottom: i < stats.containers.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stateColor(c.state), boxShadow: `0 0 5px ${stateColor(c.state)}`, animation: c.state === 'running' ? 'pulse 3s infinite' : 'none', flexShrink: 0 }} />
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: stateColor(c.state), letterSpacing: '1px' }}>
                            {c.state.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {c.name.replace('nexus-', '')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {c.image.replace('docker-', '').split(':')[0]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: cpuColor(c.cpu), minWidth: '44px' }}>{c.cpu}</span>
                          <MiniBar value={cpuNum(c.cpu)} color={cpuColor(c.cpu)} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-secondary)' }}>{c.mem}</span>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: 'var(--text-dim)', marginLeft: '4px' }}>({c.memPerc})</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: 'var(--text-muted)' }}>{c.net}</span>
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
