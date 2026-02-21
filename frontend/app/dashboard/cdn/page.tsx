'use client'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'

const CDN = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.sebhosting.com'

type CdnFile = {
  id: string; original_name: string; filename: string; mime_type: string
  size: number; url: string; created_at: string; updated_at: string
}

type CdnStats = {
  total_files: number; total_size: number; most_common_type: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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

const MIME_COLORS: Record<string, string> = {
  'image/png': '#4cc9f0', 'image/jpeg': '#4cc9f0', 'image/gif': '#4cc9f0', 'image/webp': '#4cc9f0', 'image/svg+xml': '#4cc9f0',
  'application/pdf': '#ef4444', 'application/json': '#22c55e', 'text/plain': '#8ea2b5', 'text/html': '#f97316',
  'text/css': '#a78bfa', 'application/javascript': '#ffb400', 'text/javascript': '#ffb400',
  'application/zip': '#f97316', 'video/mp4': '#a78bfa', 'audio/mpeg': '#22c55e',
}

function getMimeColor(mime: string): string {
  return MIME_COLORS[mime] || '#8ea2b5'
}

function getMimeShort(mime: string): string {
  if (!mime) return 'UNKNOWN'
  const parts = mime.split('/')
  return (parts[1] || parts[0]).toUpperCase().replace('+XML', '')
}

export default function CdnPage() {
  const { accessToken } = useAuth()
  const [files, setFiles] = useState<CdnFile[]>([])
  const [stats, setStats] = useState<CdnStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hdrs = () => ({
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const hdrsJson = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadStats = async () => {
    try {
      const res = await fetch(`${CDN}/stats`, { headers: hdrsJson(), credentials: 'include' })
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadFiles = async () => {
    try {
      const res = await fetch(`${CDN}/files`, { headers: hdrsJson(), credentials: 'include' })
      const data = await res.json()
      setFiles(Array.isArray(data) ? data : data.result || data.files || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadStats(), loadFiles()])
      setLoading(false)
    })()
  }, [accessToken])

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${CDN}/upload`, {
        method: 'POST', headers: hdrs(), credentials: 'include', body: formData,
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Upload failed') }
      if (fileInputRef.current) fileInputRef.current.value = ''
      await Promise.all([loadStats(), loadFiles()])
    } catch (err: any) { setError(err.message) }
    finally { setUploading(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${CDN}/files/${id}`, { method: 'DELETE', headers: hdrsJson(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setFiles(prev => prev.filter(f => f.id !== id))
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const handleCopy = async (file: CdnFile) => {
    try {
      const url = file.url || `${CDN}/files/${file.filename || file.id}`
      await navigator.clipboard.writeText(url)
      setCopiedId(file.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setError('Failed to copy URL')
    }
  }

  const filtered = files.filter(f => {
    if (search) {
      const q = search.toLowerCase()
      return (f.original_name || f.filename || '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING CDN...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            CDN <span style={{ color: 'var(--highlight)' }}>Files</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Upload and manage CDN assets</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          CDN
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
        <StatCard label="Total Files" value={stats?.total_files ?? 0} color="#4cc9f0" />
        <StatCard label="Total Size" value={formatBytes(stats?.total_size ?? 0)} color="#22c55e" />
        <StatCard label="Most Common Type" value={stats?.most_common_type ? getMimeShort(stats.most_common_type) : '--'} color="#ffb400" />
      </div>

      {/* Upload Section */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
        borderRadius: 'var(--radius)', padding: '24px', marginBottom: '28px',
      }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Upload File</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={fileInputRef} type="file" style={{
            flex: 1, padding: '10px 14px',
            background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text)',
            fontFamily: "'Courier New', monospace", fontSize: '0.9rem',
          }} />
          <button onClick={handleUpload} disabled={uploading} style={{
            padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
            border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: uploading ? 'wait' : 'pointer',
            opacity: uploading ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
          }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..." style={{ ...inputStyle, flex: 1, maxWidth: '360px' }} />
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
          {filtered.length} file{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Files Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Filename', 'Type', 'Size', 'Uploaded', 'Actions'].map(h => (
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
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                {search ? 'No matching files' : 'No files uploaded'}
              </td></tr>
            ) : (
              filtered.map(file => (
                <FileRow
                  key={file.id}
                  file={file}
                  onCopy={() => handleCopy(file)}
                  onDelete={() => handleDelete(file.id)}
                  copied={copiedId === file.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FileRow({ file, onCopy, onDelete, copied }: { file: CdnFile; onCopy: () => void; onDelete: () => void; copied: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = getMimeColor(file.mime_type)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.original_name || file.filename}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: `${color}15`, color, border: `1px solid ${color}30`,
        }}>
          {getMimeShort(file.mime_type)}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {formatBytes(file.size)}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {file.created_at ? timeAgo(file.created_at) : '--'}
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onCopy() }} style={{
            ...actionBtnStyle,
            ...(copied ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' } : {}),
          }}>
            {copied ? 'COPIED' : 'COPY'}
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
  )
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
