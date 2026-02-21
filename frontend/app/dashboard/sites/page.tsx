'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'

const SITES = process.env.NEXT_PUBLIC_SITES_URL || 'https://sites-api.sebhosting.com'

type SiteType = 'wordpress' | 'drupal' | 'node' | 'vite'

type Site = {
  id: number; name: string; slug: string; type: SiteType
  domain: string | null; status: string; config: Record<string, any>
  created_at: string; updated_at: string
  containers?: SiteContainer[]
  latest_version?: string; last_deployed?: string
}

type SiteContainer = {
  id: number; container_id: string; container_name: string
  role: 'app' | 'db'; image: string; status: string; port: number
}

type Deployment = {
  id: number; version: string; source: string; status: string
  deploy_log: string; created_at: string; completed_at: string
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

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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

const TYPE_META: Record<SiteType, { label: string; icon: string; color: string; desc: string }> = {
  wordpress: { label: 'WordPress', icon: 'W', color: '#21759b', desc: 'Full CMS with MySQL database' },
  drupal:    { label: 'Drupal',    icon: 'D', color: '#0678be', desc: 'Enterprise CMS with PostgreSQL' },
  node:      { label: 'Node.js',   icon: 'N', color: '#68a063', desc: 'Server-side JavaScript runtime' },
  vite:      { label: 'Vite/Static', icon: 'V', color: '#646cff', desc: 'Fast static site bundler' },
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  creating: { bg: 'rgba(255,180,0,0.1)',  fg: '#ffb400', border: 'rgba(255,180,0,0.3)' },
  running:  { bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  stopped:  { bg: 'rgba(140,140,140,0.1)', fg: '#8c8c8c', border: 'rgba(140,140,140,0.3)' },
  error:    { bg: 'rgba(239,68,68,0.1)',  fg: '#ef4444', border: 'rgba(239,68,68,0.3)' },
}

const TYPE_BADGE: Record<SiteType, { bg: string; fg: string; border: string }> = {
  wordpress: { bg: 'rgba(33,117,155,0.1)',  fg: '#21759b', border: 'rgba(33,117,155,0.3)' },
  drupal:    { bg: 'rgba(6,120,190,0.1)',   fg: '#0678be', border: 'rgba(6,120,190,0.3)' },
  node:      { bg: 'rgba(104,160,99,0.1)',  fg: '#68a063', border: 'rgba(104,160,99,0.3)' },
  vite:      { bg: 'rgba(100,108,255,0.1)', fg: '#646cff', border: 'rgba(100,108,255,0.3)' },
}

const emptySiteForm = { name: '', slug: '', domain: '' }

export default function SitesPage() {
  const { accessToken } = useAuth()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* create flow */
  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<SiteType | null>(null)
  const [siteForm, setSiteForm] = useState(emptySiteForm)
  const [createSource, setCreateSource] = useState<'zip' | 'git'>('zip')
  const [createFile, setCreateFile] = useState<File | null>(null)
  const [createGitUrl, setCreateGitUrl] = useState('')
  const [saving, setSaving] = useState(false)

  /* deploy panel */
  const [deployingSiteId, setDeployingSiteId] = useState<number | null>(null)
  const [deploySource, setDeploySource] = useState<'zip' | 'git'>('zip')
  const [deployFile, setDeployFile] = useState<File | null>(null)
  const [deployGitUrl, setDeployGitUrl] = useState('')
  const [deployVersion, setDeployVersion] = useState('')
  const [deploying, setDeploying] = useState(false)

  /* log viewer */
  const [logSiteId, setLogSiteId] = useState<number | null>(null)
  const [logText, setLogText] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  const logInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  /* deployment history */
  const [expandedSiteId, setExpandedSiteId] = useState<number | null>(null)
  const [deployments, setDeployments] = useState<Record<number, Deployment[]>>({})

  /* polling */
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const authHdr = () => ({
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  /* ---- API calls ---- */

  const loadSites = async () => {
    try {
      const res = await fetch(`${SITES}/sites`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setSites(Array.isArray(data) ? data : data.result || data.sites || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadDeployments = async (siteId: number) => {
    try {
      const res = await fetch(`${SITES}/sites/${siteId}/deployments`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.result || data.deployments || []
      setDeployments(prev => ({ ...prev, [siteId]: list }))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadLogs = async (siteId: number) => {
    try {
      setLogLoading(true)
      const res = await fetch(`${SITES}/sites/${siteId}/logs`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setLogText(typeof data === 'string' ? data : data.logs || data.output || JSON.stringify(data, null, 2))
    } catch (err: any) {
      setLogText(`Error loading logs: ${err.message}`)
    } finally {
      setLogLoading(false)
    }
  }

  const createSite = async () => {
    if (!createType) return
    setSaving(true); setError('')
    try {
      const body: Record<string, any> = {
        name: siteForm.name,
        slug: siteForm.slug,
        type: createType,
      }
      if (siteForm.domain) body.domain = siteForm.domain

      if ((createType === 'node' || createType === 'vite') && createSource === 'git' && createGitUrl) {
        body.source = 'git'
        body.git_url = createGitUrl
      }

      /* For zip uploads on node/vite, use multipart */
      if ((createType === 'node' || createType === 'vite') && createSource === 'zip' && createFile) {
        const formData = new FormData()
        formData.append('file', createFile)
        formData.append('name', siteForm.name)
        formData.append('slug', siteForm.slug)
        formData.append('type', createType)
        if (siteForm.domain) formData.append('domain', siteForm.domain)

        const res = await fetch(`${SITES}/sites`, {
          method: 'POST', headers: authHdr(), credentials: 'include', body: formData,
        })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Create failed') }
      } else {
        const res = await fetch(`${SITES}/sites`, {
          method: 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Create failed') }
      }

      resetCreateFlow()
      await loadSites()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const deleteSite = async (id: number) => {
    try {
      const res = await fetch(`${SITES}/sites/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setSites(prev => prev.filter(s => s.id !== id))
    } catch (err: any) { setError(err.message) }
  }

  const deploySite = async (siteId: number) => {
    setDeploying(true); setError('')
    try {
      if (deploySource === 'zip' && deployFile) {
        const formData = new FormData()
        formData.append('file', deployFile)
        if (deployVersion) formData.append('version', deployVersion)
        const res = await fetch(`${SITES}/sites/${siteId}/deploy`, {
          method: 'POST', headers: authHdr(), credentials: 'include', body: formData,
        })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Deploy failed') }
      } else if (deploySource === 'git' && deployGitUrl) {
        const body: Record<string, any> = { source: 'git', git_url: deployGitUrl }
        if (deployVersion) body.version = deployVersion
        const res = await fetch(`${SITES}/sites/${siteId}/deploy`, {
          method: 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Deploy failed') }
      }
      resetDeployFlow()
      await loadSites()
      if (expandedSiteId === siteId) await loadDeployments(siteId)
    } catch (err: any) { setError(err.message) }
    finally { setDeploying(false) }
  }

  const startSite = async (id: number) => {
    try {
      const res = await fetch(`${SITES}/sites/${id}/start`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Start failed') }
      await loadSites()
    } catch (err: any) { setError(err.message) }
  }

  const stopSite = async (id: number) => {
    try {
      const res = await fetch(`${SITES}/sites/${id}/stop`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Stop failed') }
      await loadSites()
    } catch (err: any) { setError(err.message) }
  }

  const restartSite = async (id: number) => {
    try {
      const res = await fetch(`${SITES}/sites/${id}/restart`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Restart failed') }
      await loadSites()
    } catch (err: any) { setError(err.message) }
  }

  /* ---- helpers ---- */

  const resetCreateFlow = () => {
    setShowCreate(false); setCreateType(null); setSiteForm(emptySiteForm)
    setCreateSource('zip'); setCreateFile(null); setCreateGitUrl('')
  }

  const resetDeployFlow = () => {
    setDeployingSiteId(null); setDeploySource('zip')
    setDeployFile(null); setDeployGitUrl(''); setDeployVersion('')
  }

  const openLogs = (siteId: number) => {
    setLogSiteId(siteId)
    loadLogs(siteId)
    if (logInterval.current) clearInterval(logInterval.current)
    logInterval.current = setInterval(() => loadLogs(siteId), 5000)
  }

  const closeLogs = () => {
    setLogSiteId(null); setLogText('')
    if (logInterval.current) { clearInterval(logInterval.current); logInterval.current = null }
  }

  const toggleDeployments = async (siteId: number) => {
    if (expandedSiteId === siteId) {
      setExpandedSiteId(null)
    } else {
      setExpandedSiteId(siteId)
      if (!deployments[siteId]) await loadDeployments(siteId)
    }
  }

  /* ---- effects ---- */

  useEffect(() => {
    (async () => {
      setLoading(true)
      await loadSites()
      setLoading(false)
    })()
  }, [accessToken])

  /* polling every 10s */
  useEffect(() => {
    pollRef.current = setInterval(() => { loadSites() }, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [accessToken])

  /* cleanup log polling on unmount */
  useEffect(() => {
    return () => { if (logInterval.current) clearInterval(logInterval.current) }
  }, [])

  /* ---- computed ---- */
  const runningCount = sites.filter(s => s.status === 'running').length
  const stoppedCount = sites.filter(s => s.status === 'stopped').length
  const distinctTypes = new Set(sites.map(s => s.type)).size

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING SITES...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Sites <span style={{ color: 'var(--highlight)' }}>Deployer</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Deploy and manage Docker-based sites</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          SITES
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
        <StatCard label="Total Sites" value={sites.length} sub={`${sites.length} registered`} color="#4cc9f0" />
        <StatCard label="Running" value={runningCount} sub={`${runningCount} active`} color="#22c55e" />
        <StatCard label="Stopped" value={stoppedCount} sub={`${stoppedCount} offline`} color="#ef4444" />
        <StatCard label="Types" value={distinctTypes} sub="distinct types" color="#646cff" />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => loadSites()}
          style={{
            padding: '10px 22px', background: 'rgba(255,255,255,0.03)',
            color: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
            transition: 'all 0.3s', textTransform: 'uppercase',
          }}
        >
          Refresh
        </button>
        <button
          onClick={() => { setShowCreate(true); setCreateType(null); setSiteForm(emptySiteForm) }}
          style={{
            padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
            border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
            transition: 'all 0.3s', textTransform: 'uppercase',
          }}
        >
          + New Site
        </button>
      </div>

      {/* Create Site Flow */}
      {showCreate && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            New Site
          </div>

          {/* Step 1: Type Selection */}
          <div style={{
            fontFamily: "'Courier New', monospace", fontSize: '0.8rem', letterSpacing: '1px',
            color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px',
          }}>
            Step 1 — Choose Type
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            {(Object.keys(TYPE_META) as SiteType[]).map(t => {
              const meta = TYPE_META[t]
              const selected = createType === t
              return (
                <button
                  key={t}
                  onClick={() => setCreateType(t)}
                  style={{
                    background: selected ? `${meta.color}12` : 'rgba(255,255,255,0.02)',
                    border: selected ? `2px solid ${meta.color}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '20px 16px',
                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
                  }}
                >
                  <div style={{
                    fontSize: '1.8rem', fontWeight: 900, color: meta.color, marginBottom: '8px',
                    fontFamily: "'Courier New', monospace",
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: '1.3' }}>
                    {meta.desc}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Step 2: Configuration */}
          {createType && (
            <>
              <div style={{
                fontFamily: "'Courier New', monospace", fontSize: '0.8rem', letterSpacing: '1px',
                color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px',
              }}>
                Step 2 — Configuration
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={siteForm.name}
                    onChange={e => setSiteForm({ ...siteForm, name: e.target.value, slug: siteForm.slug || slugify(e.target.value) })}
                    placeholder="My Website"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Slug</label>
                  <input
                    value={siteForm.slug}
                    onChange={e => setSiteForm({ ...siteForm, slug: e.target.value })}
                    placeholder="auto-generated-slug"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Domain (optional)</label>
                  <input
                    value={siteForm.domain}
                    onChange={e => setSiteForm({ ...siteForm, domain: e.target.value })}
                    placeholder="e.g. mysite.com"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Node.js / Vite source toggle */}
              {(createType === 'node' || createType === 'vite') && (
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Source</label>
                  <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content', marginBottom: '12px' }}>
                    {(['zip', 'git'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => { setCreateSource(s); setCreateFile(null); setCreateGitUrl('') }}
                        style={{
                          padding: '8px 20px', border: 'none', cursor: 'pointer',
                          fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 700,
                          letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s',
                          background: createSource === s ? 'rgba(255,180,0,0.12)' : 'rgba(255,255,255,0.03)',
                          color: createSource === s ? 'var(--highlight)' : 'var(--muted)',
                        }}
                      >
                        {s === 'zip' ? 'Upload ZIP' : 'Git Clone'}
                      </button>
                    ))}
                  </div>
                  {createSource === 'zip' ? (
                    <input
                      type="file"
                      accept=".zip"
                      onChange={e => setCreateFile(e.target.files?.[0] || null)}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                        borderRadius: '8px', color: 'var(--text)',
                        fontFamily: "'Courier New', monospace", fontSize: '0.9rem',
                      }}
                    />
                  ) : (
                    <input
                      value={createGitUrl}
                      onChange={e => setCreateGitUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                      style={inputStyle}
                    />
                  )}
                </div>
              )}

              {/* WordPress/Drupal provisioning note */}
              {(createType === 'wordpress' || createType === 'drupal') && (
                <div style={{
                  marginTop: '16px', padding: '12px 16px', borderRadius: '8px',
                  background: `${TYPE_META[createType].color}08`,
                  border: `1px solid ${TYPE_META[createType].color}30`,
                  fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)',
                }}>
                  Containers will be provisioned automatically after creation. This may take a moment.
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={createSite} disabled={saving || !siteForm.name || !siteForm.slug} style={{
                  padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
                  border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
                  fontSize: '0.9rem', letterSpacing: '1px',
                  cursor: saving || !siteForm.name || !siteForm.slug ? 'wait' : 'pointer',
                  opacity: saving || !siteForm.name || !siteForm.slug ? 0.6 : 1,
                  transition: 'all 0.3s', textTransform: 'uppercase',
                }}>
                  {saving ? 'Provisioning...' : 'Create'}
                </button>
                <button onClick={resetCreateFlow} style={{
                  padding: '10px 28px', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--muted)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.9rem',
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Deploy Panel */}
      {deployingSiteId !== null && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid #4cc9f0',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            Deploy to {sites.find(s => s.id === deployingSiteId)?.name || 'Site'}
          </div>

          {/* Source toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Source</label>
            <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
              {(['zip', 'git'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setDeploySource(s); setDeployFile(null); setDeployGitUrl('') }}
                  style={{
                    padding: '8px 20px', border: 'none', cursor: 'pointer',
                    fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 700,
                    letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s',
                    background: deploySource === s ? 'rgba(255,180,0,0.12)' : 'rgba(255,255,255,0.03)',
                    color: deploySource === s ? 'var(--highlight)' : 'var(--muted)',
                  }}
                >
                  {s === 'zip' ? 'Upload ZIP' : 'Git Clone'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              {deploySource === 'zip' ? (
                <>
                  <label style={labelStyle}>ZIP File</label>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={e => setDeployFile(e.target.files?.[0] || null)}
                    style={{
                      width: '100%', padding: '10px 14px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                      borderRadius: '8px', color: 'var(--text)',
                      fontFamily: "'Courier New', monospace", fontSize: '0.9rem',
                    }}
                  />
                </>
              ) : (
                <>
                  <label style={labelStyle}>Git Repository URL</label>
                  <input
                    value={deployGitUrl}
                    onChange={e => setDeployGitUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    style={inputStyle}
                  />
                </>
              )}
            </div>
            <div>
              <label style={labelStyle}>Version Label</label>
              <input value={deployVersion} onChange={e => setDeployVersion(e.target.value)} placeholder="v1.0.0" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={() => deploySite(deployingSiteId)}
              disabled={deploying || (deploySource === 'zip' ? !deployFile : !deployGitUrl)}
              style={{
                padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
                border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
                fontSize: '0.9rem', letterSpacing: '1px',
                cursor: deploying || (deploySource === 'zip' ? !deployFile : !deployGitUrl) ? 'wait' : 'pointer',
                opacity: deploying || (deploySource === 'zip' ? !deployFile : !deployGitUrl) ? 0.6 : 1,
                transition: 'all 0.3s', textTransform: 'uppercase',
              }}
            >
              {deploying ? 'Deploying...' : 'Deploy'}
            </button>
            <button onClick={resetDeployFlow} style={{
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

      {/* Sites Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Type', 'Status', 'URL', 'Last Deployed', 'Actions'].map(h => (
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
            {sites.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                No sites found
              </td></tr>
            ) : (
              sites.map(site => (
                <SiteRow
                  key={site.id}
                  site={site}
                  onDeploy={() => { setDeployingSiteId(site.id); setDeploySource('zip'); setDeployFile(null); setDeployGitUrl(''); setDeployVersion('') }}
                  onStart={() => startSite(site.id)}
                  onStop={() => stopSite(site.id)}
                  onRestart={() => restartSite(site.id)}
                  onLogs={() => openLogs(site.id)}
                  onDelete={() => deleteSite(site.id)}
                  onToggleDeployments={() => toggleDeployments(site.id)}
                  expanded={expandedSiteId === site.id}
                  deployments={deployments[site.id] || []}
                  logOpen={logSiteId === site.id}
                  logText={logSiteId === site.id ? logText : ''}
                  logLoading={logSiteId === site.id ? logLoading : false}
                  onCloseLogs={closeLogs}
                  onRefreshLogs={() => loadLogs(site.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============================================================
   SiteRow
   ============================================================ */

function SiteRow({ site, onDeploy, onStart, onStop, onRestart, onLogs, onDelete, onToggleDeployments, expanded, deployments, logOpen, logText, logLoading, onCloseLogs, onRefreshLogs }: {
  site: Site
  onDeploy: () => void; onStart: () => void; onStop: () => void; onRestart: () => void
  onLogs: () => void; onDelete: () => void
  onToggleDeployments: () => void; expanded: boolean; deployments: Deployment[]
  logOpen: boolean; logText: string; logLoading: boolean
  onCloseLogs: () => void; onRefreshLogs: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isNodeOrVite = site.type === 'node' || site.type === 'vite'
  const isRunning = site.status === 'running'
  const isStopped = site.status === 'stopped'
  const statusColors = STATUS_COLORS[site.status] || STATUS_COLORS.stopped
  const typeBadge = TYPE_BADGE[site.type] || TYPE_BADGE.vite
  const siteUrl = `${site.slug}.sebhosting.com`

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
      >
        {/* Name */}
        <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {site.name}
        </td>

        {/* Type badge */}
        <td style={{ padding: '12px 20px' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
            fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
            background: typeBadge.bg, color: typeBadge.fg, border: `1px solid ${typeBadge.border}`,
          }}>
            {site.type.toUpperCase()}
          </span>
        </td>

        {/* Status badge */}
        <td style={{ padding: '12px 20px' }}>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
            fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
            background: statusColors.bg, color: statusColors.fg, border: `1px solid ${statusColors.border}`,
            animation: site.status === 'creating' ? 'pulse 2s ease-in-out infinite' : 'none',
          }}>
            {site.status.toUpperCase()}
          </span>
        </td>

        {/* URL */}
        <td style={{ padding: '12px 20px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <a
            href={`https://${siteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: '#4cc9f0', textDecoration: 'none' }}
          >
            {siteUrl}
          </a>
          {site.domain && (
            <div>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: "'Courier New', monospace", fontSize: '0.75rem', color: 'var(--muted)', textDecoration: 'none' }}
              >
                {site.domain}
              </a>
            </div>
          )}
        </td>

        {/* Last Deployed */}
        <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
          {site.last_deployed ? timeAgo(site.last_deployed) : '--'}
        </td>

        {/* Actions */}
        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isNodeOrVite && (
              <button onClick={(e) => { e.stopPropagation(); onDeploy() }} style={{
                ...actionBtnStyle, background: 'rgba(76,201,240,0.1)',
                border: '1px solid rgba(76,201,240,0.3)', color: '#4cc9f0',
              }}>
                DEPLOY
              </button>
            )}
            {isStopped && (
              <button onClick={(e) => { e.stopPropagation(); onStart() }} style={{
                ...actionBtnStyle, background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e',
              }}>
                START
              </button>
            )}
            {isRunning && (
              <button onClick={(e) => { e.stopPropagation(); onStop() }} style={{
                ...actionBtnStyle, background: 'rgba(140,140,140,0.1)',
                border: '1px solid rgba(140,140,140,0.3)', color: '#8c8c8c',
              }}>
                STOP
              </button>
            )}
            {isRunning && (
              <button onClick={(e) => { e.stopPropagation(); onRestart() }} style={{
                ...actionBtnStyle, background: 'rgba(255,180,0,0.1)',
                border: '1px solid rgba(255,180,0,0.3)', color: '#ffb400',
              }}>
                RESTART
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onLogs() }} style={actionBtnStyle}>
              LOGS
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleDeployments() }} style={{
              ...actionBtnStyle,
              background: expanded ? 'rgba(255,180,0,0.1)' : actionBtnStyle.background,
              border: expanded ? '1px solid rgba(255,180,0,0.3)' : actionBtnStyle.border,
              color: expanded ? '#ffb400' : actionBtnStyle.color,
            }}>
              {expanded ? 'HIDE' : 'HISTORY'}
            </button>
            {confirmDelete ? (
              <button onClick={(e) => { e.stopPropagation(); onDelete() }} style={{
                ...actionBtnStyle, background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)',
              }}>
                SURE?
              </button>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }} style={actionBtnStyle}>DEL</button>
            )}
          </div>
        </td>
      </tr>

      {/* Log Viewer */}
      {logOpen && (
        <tr>
          <td colSpan={6} style={{ padding: '0', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Container Logs — {site.name}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={onRefreshLogs} style={{
                    ...actionBtnStyle, background: 'rgba(76,201,240,0.1)',
                    border: '1px solid rgba(76,201,240,0.3)', color: '#4cc9f0',
                  }}>
                    {logLoading ? 'LOADING...' : 'REFRESH'}
                  </button>
                  <button onClick={onCloseLogs} style={actionBtnStyle}>
                    CLOSE
                  </button>
                </div>
              </div>
              <pre style={{
                background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '16px', margin: 0,
                fontFamily: "'Courier New', monospace", fontSize: '0.8rem',
                color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: '400px', overflowY: 'auto', lineHeight: '1.5',
              }}>
                {logText || 'No logs available'}
              </pre>
            </div>
          </td>
        </tr>
      )}

      {/* Deployment History */}
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: '0', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.8rem', letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Deployment History
              </div>
              {deployments.length === 0 ? (
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)', padding: '16px 0' }}>
                  No deployments yet
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Version', 'Source', 'Status', 'Time', 'Completed'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left',
                          fontFamily: "'Courier New', monospace", fontSize: '0.7rem',
                          letterSpacing: '1px', color: 'var(--muted)', fontWeight: 600,
                          borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map(dep => (
                      <DeploymentRow key={dep.id} deployment={dep} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ============================================================
   DeploymentRow
   ============================================================ */

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const statusColor = deployment.status === 'success' || deployment.status === 'active'
    ? { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e', border: 'rgba(34,197,94,0.3)' }
    : deployment.status === 'failed' || deployment.status === 'error'
    ? { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444', border: 'rgba(239,68,68,0.3)' }
    : deployment.status === 'running' || deployment.status === 'deploying'
    ? { bg: 'rgba(255,180,0,0.1)', fg: '#ffb400', border: 'rgba(255,180,0,0.3)' }
    : { bg: 'rgba(140,140,140,0.1)', fg: '#8c8c8c', border: 'rgba(140,140,140,0.3)' }

  const sourceColor = deployment.source === 'zip'
    ? { bg: 'rgba(76,201,240,0.1)', fg: '#4cc9f0', border: 'rgba(76,201,240,0.3)' }
    : deployment.source === 'git'
    ? { bg: 'rgba(104,160,99,0.1)', fg: '#68a063', border: 'rgba(104,160,99,0.3)' }
    : { bg: 'rgba(100,108,255,0.1)', fg: '#646cff', border: 'rgba(100,108,255,0.3)' }

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 12px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--text)' }}>
        {deployment.version || '--'}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.75rem', fontWeight: 700,
          background: sourceColor.bg, color: sourceColor.fg, border: `1px solid ${sourceColor.border}`,
        }}>
          {(deployment.source || 'unknown').toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.75rem', fontWeight: 700,
          background: statusColor.bg, color: statusColor.fg, border: `1px solid ${statusColor.border}`,
        }}>
          {(deployment.status || 'unknown').toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '8px 12px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {deployment.created_at ? timeAgo(deployment.created_at) : '--'}
      </td>
      <td style={{ padding: '8px 12px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {deployment.completed_at ? timeAgo(deployment.completed_at) : '--'}
      </td>
    </tr>
  )
}

/* ============================================================
   Shared styles
   ============================================================ */

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
