'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const BACKUP = process.env.NEXT_PUBLIC_BACKUP_URL || 'https://backup.sebhosting.com'

type Backup = {
  id: string; name: string; type: string; status: string
  size: number; trigger: string; created_at: string; updated_at: string
}

type Schedule = {
  id: string; name: string; type: string; cron_expression: string
  retention_days: number; enabled: boolean; created_at: string; updated_at: string
}

type Stats = {
  total_backups: number; total_size: number
  last_backup: Record<string, string>
  next_scheduled: string
}

function timeAgo(date: string): string {
  if (!date) return '--'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 0) return 'soon'
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

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function timeUntil(date: string): string {
  if (!date) return '--'
  const seconds = Math.floor((new Date(date).getTime() - Date.now()) / 1000)
  if (seconds < 0) return 'overdue'
  if (seconds < 60) return `in ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours}h`
  const days = Math.floor(hours / 24)
  return `in ${days}d`
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

const BACKUP_TYPES = ['postgres', 'mongodb', 'redis', 'cdn', 'full'] as const
type BackupType = typeof BACKUP_TYPES[number]

const emptyScheduleForm = { name: '', type: 'postgres' as string, cron_expression: '', retention_days: 30 }

export default function BackupsPage() {
  const { accessToken } = useAuth()
  const [tab, setTab] = useState<'backups' | 'schedules'>('backups')
  const [backups, setBackups] = useState<Backup[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [triggerType, setTriggerType] = useState<BackupType>('postgres')
  const [triggering, setTriggering] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm)
  const [saving, setSaving] = useState(false)

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadBackups = async () => {
    try {
      const res = await fetch(`${BACKUP}/backups?limit=50`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setBackups(Array.isArray(data) ? data : data.result || data.backups || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadSchedules = async () => {
    try {
      const res = await fetch(`${BACKUP}/schedules`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setSchedules(Array.isArray(data) ? data : data.result || data.schedules || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch(`${BACKUP}/stats`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadBackups(), loadSchedules(), loadStats()])
      setLoading(false)
    })()
  }, [accessToken])

  const handleTrigger = async () => {
    setTriggering(true); setError('')
    try {
      const res = await fetch(`${BACKUP}/backups`, {
        method: 'POST', headers: hdrs(), credentials: 'include',
        body: JSON.stringify({ type: triggerType }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Trigger failed') }
      await Promise.all([loadBackups(), loadStats()])
    } catch (err: any) { setError(err.message) }
    finally { setTriggering(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKUP}/backups/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setBackups(prev => prev.filter(b => b.id !== id))
      await loadStats()
    } catch (err: any) { setError(err.message) }
  }

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`${BACKUP}/backups/${id}/restore`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Restore failed') }
      await loadBackups()
    } catch (err: any) { setError(err.message) }
  }

  const handleSaveSchedule = async () => {
    setSaving(true); setError('')
    try {
      const body = {
        name: scheduleForm.name, type: scheduleForm.type,
        cron_expression: scheduleForm.cron_expression,
        retention_days: Number(scheduleForm.retention_days),
      }
      const url = editingId ? `${BACKUP}/schedules/${editingId}` : `${BACKUP}/schedules`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST', headers: hdrs(), credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
      setShowForm(false); setEditingId(null); setScheduleForm(emptyScheduleForm)
      await loadSchedules()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDeleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`${BACKUP}/schedules/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      setSchedules(prev => prev.filter(s => s.id !== id))
    } catch (err: any) { setError(err.message) }
  }

  const handleToggleSchedule = async (id: string) => {
    try {
      const res = await fetch(`${BACKUP}/schedules/${id}/toggle`, { method: 'POST', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Toggle failed') }
      await loadSchedules()
    } catch (err: any) { setError(err.message) }
  }

  const startEditSchedule = (s: Schedule) => {
    setEditingId(s.id)
    setScheduleForm({ name: s.name, type: s.type, cron_expression: s.cron_expression, retention_days: s.retention_days })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING BACKUPS...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Backup <span style={{ color: 'var(--highlight)' }}>Manager</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Manage backups and schedules</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          BACKUPS
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
        <StatCard label="Total Backups" value={stats?.total_backups ?? 0} sub={`${backups.filter(b => b.status === 'completed').length} completed`} color="#4cc9f0" />
        <StatCard label="Total Size" value={formatBytes(stats?.total_size ?? 0)} sub="all backups" color="#22c55e" />
        <StatCard label="Last PG Backup" value={stats?.last_backup?.postgres ? timeAgo(stats.last_backup.postgres) : '--'} sub="postgres" color="#ffb400" />
        <StatCard label="Next Scheduled" value={stats?.next_scheduled ? timeUntil(stats.next_scheduled) : '--'} sub={stats?.next_scheduled ? new Date(stats.next_scheduled).toLocaleString() : 'none'} color="#a855f7" />
      </div>

      {/* Tab bar + Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['backups', 'schedules'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setShowForm(false); setEditingId(null) }} style={{
              padding: '10px 22px', border: 'none', cursor: 'pointer',
              fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 700,
              letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.2s',
              background: tab === t ? 'rgba(255,180,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: tab === t ? 'var(--highlight)' : 'var(--muted)',
            }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {tab === 'backups' ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value as BackupType)} style={{ ...selectStyle, minWidth: '130px' }}>
              {BACKUP_TYPES.map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              style={{
                padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
                border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
                fontSize: '0.9rem', letterSpacing: '1px', cursor: triggering ? 'wait' : 'pointer',
                opacity: triggering ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
              }}
            >
              {triggering ? 'Running...' : 'Trigger Backup'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setScheduleForm(emptyScheduleForm) }}
            style={{
              padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
              transition: 'all 0.3s', textTransform: 'uppercase',
            }}
          >
            + New Schedule
          </button>
        )}
      </div>

      {/* Schedule Form */}
      {tab === 'schedules' && showForm && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            {editingId ? 'Edit Schedule' : 'New Schedule'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={scheduleForm.name} onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="Schedule name" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={scheduleForm.type} onChange={e => setScheduleForm({ ...scheduleForm, type: e.target.value })} style={{ ...selectStyle, width: '100%' }}>
                {BACKUP_TYPES.map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cron Expression</label>
              <input value={scheduleForm.cron_expression} onChange={e => setScheduleForm({ ...scheduleForm, cron_expression: e.target.value })} placeholder="0 2 * * *" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Retention (days)</label>
              <input type="number" value={scheduleForm.retention_days} onChange={e => setScheduleForm({ ...scheduleForm, retention_days: Number(e.target.value) })} placeholder="30" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSaveSchedule} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setScheduleForm(emptyScheduleForm) }} style={{
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

      {/* Backups Table */}
      {tab === 'backups' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Type', 'Status', 'Size', 'Trigger', 'Time', 'Actions'].map(h => (
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
              {backups.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No backups found
                </td></tr>
              ) : (
                backups.map(backup => (
                  <BackupRow
                    key={backup.id}
                    backup={backup}
                    onRestore={() => handleRestore(backup.id)}
                    onDelete={() => handleDelete(backup.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedules Table */}
      {tab === 'schedules' && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Type', 'Cron', 'Retention', 'Enabled', 'Actions'].map(h => (
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
              {schedules.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)' }}>
                  No schedules found
                </td></tr>
              ) : (
                schedules.map(schedule => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    onEdit={() => startEditSchedule(schedule)}
                    onDelete={() => handleDeleteSchedule(schedule.id)}
                    onToggle={() => handleToggleSchedule(schedule.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const statusColors: Record<string, { bg: string; border: string; color: string }> = {
  completed: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: '#22c55e' },
  running: { bg: 'rgba(76,201,240,0.1)', border: 'rgba(76,201,240,0.3)', color: '#4cc9f0' },
  pending: { bg: 'rgba(255,180,0,0.1)', border: 'rgba(255,180,0,0.3)', color: '#ffb400' },
  failed: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#ef4444' },
}

const typeColors: Record<string, string> = {
  postgres: '#4cc9f0',
  mongodb: '#22c55e',
  redis: '#ef4444',
  cdn: '#a855f7',
  full: '#ffb400',
}

function BackupRow({ backup, onRestore, onDelete }: { backup: Backup; onRestore: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sc = statusColors[backup.status] || statusColors.pending
  const tc = typeColors[backup.type] || 'var(--muted)'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {backup.name || '--'}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: `${tc}18`, color: tc, border: `1px solid ${tc}4D`,
        }}>
          {backup.type.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
        }}>
          {backup.status.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {formatBytes(backup.size)}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: backup.trigger === 'manual' ? 'rgba(255,180,0,0.1)' : 'rgba(76,201,240,0.1)',
          color: backup.trigger === 'manual' ? '#ffb400' : '#4cc9f0',
          border: `1px solid ${backup.trigger === 'manual' ? 'rgba(255,180,0,0.3)' : 'rgba(76,201,240,0.3)'}`,
        }}>
          {(backup.trigger || 'manual').toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {backup.created_at ? timeAgo(backup.created_at) : '--'}
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onRestore() }} style={{
            ...actionBtnStyle, background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e',
          }}>
            RESTORE
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
  )
}

function ScheduleRow({ schedule, onEdit, onDelete, onToggle }: { schedule: Schedule; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tc = typeColors[schedule.type] || 'var(--muted)'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {schedule.name}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: `${tc}18`, color: tc, border: `1px solid ${tc}4D`,
        }}>
          {schedule.type.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {schedule.cron_expression}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {schedule.retention_days}d
      </td>
      <td style={{ padding: '12px 20px' }}>
        <button onClick={(e) => { e.stopPropagation(); onToggle() }} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: schedule.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
          color: schedule.enabled ? '#22c55e' : 'var(--muted)',
          border: `1px solid ${schedule.enabled ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
          transition: 'all 0.2s',
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: schedule.enabled ? '#22c55e' : 'var(--muted)',
          }} />
          {schedule.enabled ? 'ON' : 'OFF'}
        </button>
      </td>
      <td style={{ padding: '12px 20px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit() }} style={actionBtnStyle}>EDIT</button>
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
