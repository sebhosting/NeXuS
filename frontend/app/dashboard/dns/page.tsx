'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.sebhosting.com'

type Zone = { id: string; name: string; status: string; plan?: { name: string } }
type DnsRecord = {
  id: string; type: string; name: string; content: string
  ttl: number; proxied: boolean; priority?: number
}

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV']
const TTL_OPTIONS = [
  { label: 'Auto', value: 1 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '30 min', value: 1800 },
  { label: '1 hr', value: 3600 },
  { label: '12 hr', value: 43200 },
  { label: '1 day', value: 86400 },
]
const PROXIABLE_TYPES = ['A', 'AAAA', 'CNAME']

const TYPE_COLORS: Record<string, string> = {
  A: '#4cc9f0', AAAA: '#a78bfa', CNAME: '#22c55e', MX: '#ffb400',
  TXT: '#ef4444', NS: '#8ea2b5', SRV: '#f97316', CAA: '#ef4444',
}

const emptyForm = { type: 'A', name: '', content: '', ttl: 1, proxied: false, priority: 10 }

export default function DnsPage() {
  const { accessToken } = useAuth()
  const [zones, setZones] = useState<Zone[]>([])
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingProxy, setTogglingProxy] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/dns/zones`, { headers: hdrs(), credentials: 'include' })
        const data = await res.json()
        if (data.result) {
          setZones(data.result)
          if (data.result.length > 0) setSelectedZone(data.result[0].id)
        } else {
          setError(data.errors?.[0]?.message || 'Failed to load zones')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken])

  useEffect(() => {
    if (!selectedZone) return
    loadRecords()
  }, [selectedZone])

  const loadRecords = async () => {
    setRecordsLoading(true)
    try {
      const res = await fetch(`${API}/dns/zones/${selectedZone}/records`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      if (data.result) setRecords(data.result)
      else setError(data.errors?.[0]?.message || 'Failed to load records')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRecordsLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    const body: any = { type: form.type, name: form.name, content: form.content, ttl: form.ttl }
    if (PROXIABLE_TYPES.includes(form.type)) body.proxied = form.proxied
    if (form.type === 'MX' || form.type === 'SRV') body.priority = form.priority
    try {
      const url = editingId
        ? `${API}/dns/zones/${selectedZone}/records/${editingId}`
        : `${API}/dns/zones/${selectedZone}/records`
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) { setShowForm(false); setEditingId(null); setForm(emptyForm); await loadRecords() }
      else setError(data.errors?.[0]?.message || 'Save failed')
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (recordId: string) => {
    setDeletingId(recordId)
    try {
      const res = await fetch(`${API}/dns/zones/${selectedZone}/records/${recordId}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      if (data.result?.id) setRecords(prev => prev.filter(r => r.id !== recordId))
      else setError(data.errors?.[0]?.message || 'Delete failed')
    } catch (err: any) { setError(err.message) }
    finally { setDeletingId(null) }
  }

  const handleToggleProxy = async (record: DnsRecord) => {
    setTogglingProxy(record.id)
    try {
      const res = await fetch(`${API}/dns/zones/${selectedZone}/records/${record.id}`, {
        method: 'PUT', headers: hdrs(), credentials: 'include',
        body: JSON.stringify({ type: record.type, name: record.name, content: record.content, ttl: record.ttl, proxied: !record.proxied }),
      })
      const data = await res.json()
      if (data.success) setRecords(prev => prev.map(r => r.id === record.id ? { ...r, proxied: !r.proxied } : r))
      else setError(data.errors?.[0]?.message || 'Toggle failed')
    } catch (err: any) { setError(err.message) }
    finally { setTogglingProxy(null) }
  }

  const startEdit = (record: DnsRecord) => {
    setForm({ type: record.type, name: record.name, content: record.content, ttl: record.ttl, proxied: record.proxied, priority: record.priority || 10 })
    setEditingId(record.id); setShowForm(true)
  }

  const filteredRecords = records.filter(r => {
    if (filterType && r.type !== filterType) return false
    if (search) { const q = search.toLowerCase(); return r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) }
    return true
  })

  const activeZone = zones.find(z => z.id === selectedZone)

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING ZONES...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            DNS <span style={{ color: 'var(--highlight)' }}>Management</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Cloudflare DNS records</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          CLOUDFLARE
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

      {/* Zone Selector + Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)} style={selectStyle}>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>

        {activeZone && (
          <span style={{
            padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
            fontFamily: "'Courier New', monospace", letterSpacing: '1px',
            background: activeZone.status === 'active' ? 'rgba(34,197,94,0.08)' : 'rgba(255,180,0,0.08)',
            color: activeZone.status === 'active' ? 'var(--success)' : 'var(--highlight)',
            border: `1px solid ${activeZone.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(255,180,0,0.2)'}`,
          }}>
            {activeZone.status?.toUpperCase()}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm) }}
          style={{
            padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
            border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
            transition: 'all 0.3s', textTransform: 'uppercase',
          }}
        >
          + Add Record
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            {editingId ? 'Edit Record' : 'New Record'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="@ or subdomain" style={inputStyle} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>Content</label>
              <input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder={form.type === 'A' ? '192.168.1.1' : form.type === 'CNAME' ? 'target.example.com' : 'value'} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>TTL</label>
              <select value={form.ttl} onChange={e => setForm({ ...form, ttl: Number(e.target.value) })} style={inputStyle}>
                {TTL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {(form.type === 'MX' || form.type === 'SRV') && (
              <div>
                <label style={labelStyle}>Priority</label>
                <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} style={inputStyle} />
              </div>
            )}
            {PROXIABLE_TYPES.includes(form.type) && (
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button onClick={() => setForm({ ...form, proxied: !form.proxied })} style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: form.proxied ? '1px solid rgba(255,180,0,0.3)' : '1px solid var(--border)',
                  background: form.proxied ? 'rgba(255,180,0,0.1)' : 'rgba(255,255,255,0.03)',
                  color: form.proxied ? 'var(--highlight)' : 'var(--muted)',
                  fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.3s',
                }}>
                  {form.proxied ? 'PROXIED' : 'DNS ONLY'}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm) }} style={{
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

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..." style={{ ...inputStyle, flex: 1, maxWidth: '360px' }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...selectStyle, minWidth: '130px' }}>
          <option value="">All types</option>
          {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Records Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Type', 'Name', 'Content', 'TTL', 'Proxy', 'Actions'].map(h => (
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
            {recordsLoading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>Loading records...</td></tr>
            ) : filteredRecords.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>{search || filterType ? 'No matching records' : 'No DNS records found'}</td></tr>
            ) : (
              filteredRecords.map(record => (
                <RecordRow
                  key={record.id} record={record}
                  onEdit={() => startEdit(record)}
                  onDelete={() => handleDelete(record.id)}
                  onToggleProxy={() => handleToggleProxy(record)}
                  deleting={deletingId === record.id}
                  togglingProxy={togglingProxy === record.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecordRow({ record, onEdit, onDelete, onToggleProxy, deleting, togglingProxy }: {
  record: DnsRecord; onEdit: () => void; onDelete: () => void; onToggleProxy: () => void
  deleting: boolean; togglingProxy: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const color = TYPE_COLORS[record.type] || '#8ea2b5'
  const ttlLabel = record.ttl === 1 ? 'Auto' : record.ttl >= 3600 ? `${record.ttl / 3600}h` : record.ttl >= 60 ? `${record.ttl / 60}m` : `${record.ttl}s`

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: `${color}15`, color, border: `1px solid ${color}30`,
        }}>
          {record.type}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--text)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.name}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {record.content}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.8rem', color: 'var(--muted)' }}>
        {ttlLabel}
      </td>
      <td style={{ padding: '12px 20px' }}>
        {PROXIABLE_TYPES.includes(record.type) ? (
          <button onClick={onToggleProxy} disabled={togglingProxy} style={{
            padding: '4px 12px', borderRadius: '6px',
            border: record.proxied ? '1px solid rgba(255,180,0,0.3)' : '1px solid var(--border)',
            background: record.proxied ? 'rgba(255,180,0,0.1)' : 'transparent',
            color: record.proxied ? 'var(--highlight)' : 'var(--muted)',
            fontFamily: "'Courier New', monospace", fontSize: '0.75rem', fontWeight: 600,
            cursor: togglingProxy ? 'wait' : 'pointer', transition: 'all 0.3s',
            opacity: togglingProxy ? 0.5 : 1,
          }}>
            {togglingProxy ? '...' : record.proxied ? 'PROXIED' : 'DNS ONLY'}
          </button>
        ) : (
          <span style={{ color: 'var(--muted)', opacity: 0.4 }}>—</span>
        )}
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={actionBtnStyle}>EDIT</button>
          {confirmDelete ? (
            <button onClick={onDelete} disabled={deleting} style={{
              ...actionBtnStyle, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)',
            }}>
              {deleting ? '...' : 'SURE?'}
            </button>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={actionBtnStyle}>DEL</button>
          )}
        </div>
      </td>
    </tr>
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
