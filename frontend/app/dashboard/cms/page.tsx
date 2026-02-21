'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'

const CMS = process.env.NEXT_PUBLIC_CMS_URL || 'https://cms.sebhosting.com'

type Page = {
  id: string; title: string; slug: string; content: string
  published: boolean; created_at: string; updated_at: string
}
type Post = {
  id: string; title: string; slug: string; content: string; tags: string[]
  published: boolean; created_at: string; updated_at: string
}

type CmsItem = Page | Post

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

const emptyPageForm = { title: '', slug: '', content: '', published: false }
const emptyPostForm = { title: '', slug: '', content: '', published: false, tags: '' }

export default function CmsPage() {
  const { accessToken } = useAuth()
  const [tab, setTab] = useState<'pages' | 'posts'>('pages')
  const [pages, setPages] = useState<Page[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pageForm, setPageForm] = useState(emptyPageForm)
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'published' | 'draft'>('')

  const hdrs = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  })

  const loadPages = async () => {
    try {
      const res = await fetch(`${CMS}/pages`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setPages(Array.isArray(data) ? data : data.result || data.pages || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadPosts = async () => {
    try {
      const res = await fetch(`${CMS}/posts`, { headers: hdrs(), credentials: 'include' })
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : data.result || data.posts || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([loadPages(), loadPosts()])
      setLoading(false)
    })()
  }, [accessToken])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      if (tab === 'pages') {
        const body = { title: pageForm.title, slug: pageForm.slug, content: pageForm.content, published: pageForm.published }
        const url = editingId ? `${CMS}/pages/${editingId}` : `${CMS}/pages`
        const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
        setShowForm(false); setEditingId(null); setPageForm(emptyPageForm); await loadPages()
      } else {
        const tags = postForm.tags.split(',').map(t => t.trim()).filter(Boolean)
        const body = { title: postForm.title, slug: postForm.slug, content: postForm.content, published: postForm.published, tags }
        const url = editingId ? `${CMS}/posts/${editingId}` : `${CMS}/posts`
        const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: hdrs(), credentials: 'include', body: JSON.stringify(body) })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Save failed') }
        setShowForm(false); setEditingId(null); setPostForm(emptyPostForm); await loadPosts()
      }
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const endpoint = tab === 'pages' ? 'pages' : 'posts'
      const res = await fetch(`${CMS}/${endpoint}/${id}`, { method: 'DELETE', headers: hdrs(), credentials: 'include' })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.message || 'Delete failed') }
      if (tab === 'pages') setPages(prev => prev.filter(p => p.id !== id))
      else setPosts(prev => prev.filter(p => p.id !== id))
    } catch (err: any) { setError(err.message) }
  }

  const startEdit = (item: CmsItem) => {
    setEditingId(item.id)
    if (tab === 'pages') {
      const p = item as Page
      setPageForm({ title: p.title, slug: p.slug, content: p.content, published: p.published })
    } else {
      const p = item as Post
      setPostForm({ title: p.title, slug: p.slug, content: p.content, published: p.published, tags: (p.tags || []).join(', ') })
    }
    setShowForm(true)
  }

  const items: CmsItem[] = tab === 'pages' ? pages : posts
  const filtered = items.filter(item => {
    if (statusFilter === 'published' && !item.published) return false
    if (statusFilter === 'draft' && item.published) return false
    if (search) {
      const q = search.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q)
    }
    return true
  })

  if (loading) {
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.95rem', color: 'var(--accent)', letterSpacing: '2px', padding: '40px 0' }}>
        LOADING CMS...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Content <span style={{ color: 'var(--highlight)' }}>Management</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>Manage pages and posts</p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
          fontFamily: "'Courier New', monospace", letterSpacing: '1px',
          background: 'rgba(255,180,0,0.08)', color: 'var(--highlight)', border: '1px solid rgba(255,180,0,0.2)',
        }}>
          CMS
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
        <StatCard label="Total Pages" value={pages.length} sub={`${pages.filter(p => p.published).length} published`} color="#4cc9f0" />
        <StatCard label="Total Posts" value={posts.length} sub={`${posts.filter(p => p.published).length} published`} color="#22c55e" />
        <StatCard label="Drafts" value={pages.filter(p => !p.published).length + posts.filter(p => !p.published).length} color="#ffb400" />
      </div>

      {/* Tab bar + Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['pages', 'posts'] as const).map(t => (
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

        <button
          onClick={() => { setShowForm(true); setEditingId(null); tab === 'pages' ? setPageForm(emptyPageForm) : setPostForm(emptyPostForm) }}
          style={{
            padding: '10px 22px', background: 'var(--accent-2)', color: '#04101d',
            border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '1px', cursor: 'pointer',
            transition: 'all 0.3s', textTransform: 'uppercase',
          }}
        >
          + New {tab === 'pages' ? 'Page' : 'Post'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
          borderRadius: 'var(--radius)', padding: '28px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
            {editingId ? `Edit ${tab === 'pages' ? 'Page' : 'Post'}` : `New ${tab === 'pages' ? 'Page' : 'Post'}`}
          </div>

          {tab === 'pages' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={pageForm.title} onChange={e => setPageForm({ ...pageForm, title: e.target.value, slug: pageForm.slug || slugify(e.target.value) })} placeholder="Page title" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input value={pageForm.slug} onChange={e => setPageForm({ ...pageForm, slug: e.target.value })} placeholder="auto-generated-slug" style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Content</label>
                <textarea value={pageForm.content} onChange={e => setPageForm({ ...pageForm, content: e.target.value })} placeholder="Page content..." style={{ ...inputStyle, minHeight: '200px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button onClick={() => setPageForm({ ...pageForm, published: !pageForm.published })} style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: pageForm.published ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                  background: pageForm.published ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  color: pageForm.published ? 'var(--success)' : 'var(--muted)',
                  fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.3s',
                }}>
                  {pageForm.published ? 'PUBLISHED' : 'DRAFT'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input value={postForm.title} onChange={e => setPostForm({ ...postForm, title: e.target.value, slug: postForm.slug || slugify(e.target.value) })} placeholder="Post title" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input value={postForm.slug} onChange={e => setPostForm({ ...postForm, slug: e.target.value })} placeholder="auto-generated-slug" style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Content</label>
                <textarea value={postForm.content} onChange={e => setPostForm({ ...postForm, content: e.target.value })} placeholder="Post content..." style={{ ...inputStyle, minHeight: '200px', resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Tags</label>
                <input value={postForm.tags} onChange={e => setPostForm({ ...postForm, tags: e.target.value })} placeholder="tag1, tag2, tag3" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button onClick={() => setPostForm({ ...postForm, published: !postForm.published })} style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: postForm.published ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)',
                  background: postForm.published ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                  color: postForm.published ? 'var(--success)' : 'var(--muted)',
                  fontFamily: "'Courier New', monospace", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.3s',
                }}>
                  {postForm.published ? 'PUBLISHED' : 'DRAFT'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '10px 28px', background: 'var(--accent-2)', color: '#04101d',
              border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
              fontSize: '0.9rem', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1, transition: 'all 0.3s', textTransform: 'uppercase',
            }}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); tab === 'pages' ? setPageForm(emptyPageForm) : setPostForm(emptyPostForm) }} style={{
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or slug..." style={{ ...inputStyle, flex: 1, maxWidth: '360px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | 'published' | 'draft')} style={{ ...selectStyle, minWidth: '130px' }}>
          <option value="">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
          {filtered.length} {tab === 'pages' ? 'page' : 'post'}{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Title', 'Slug', 'Status', 'Updated', 'Actions'].map(h => (
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
                {search || statusFilter ? 'No matching items' : `No ${tab} found`}
              </td></tr>
            ) : (
              filtered.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => startEdit(item)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ItemRow({ item, onEdit, onDelete }: { item: CmsItem; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setConfirmDelete(false) }}
    >
      <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title}
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.9rem', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.slug}
      </td>
      <td style={{ padding: '12px 20px' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
          fontFamily: "'Courier New', monospace", fontSize: '0.8rem', fontWeight: 700,
          background: item.published ? 'rgba(34,197,94,0.1)' : 'rgba(255,180,0,0.1)',
          color: item.published ? '#22c55e' : '#ffb400',
          border: `1px solid ${item.published ? 'rgba(34,197,94,0.3)' : 'rgba(255,180,0,0.3)'}`,
        }}>
          {item.published ? 'PUBLISHED' : 'DRAFT'}
        </span>
      </td>
      <td style={{ padding: '12px 20px', fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--muted)' }}>
        {item.updated_at ? timeAgo(item.updated_at) : '--'}
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
