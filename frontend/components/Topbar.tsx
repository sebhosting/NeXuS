'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
    document.cookie = 'refresh_token=; Max-Age=0; path=/;'
    document.cookie = 'refresh_token=; Max-Age=0; path=/; domain=.sebhosting.com;'
    window.location.href = '/login'
  }

  return (
    <div style={{
      height: '56px',
      background: '#05081a',
      borderBottom: '1px solid var(--border-accent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--success)',
          boxShadow: '0 0 8px var(--success)',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{
          fontFamily: "'Courier New', monospace",
          fontSize: '0.85rem',
          color: 'var(--muted)',
          letterSpacing: '0.5px',
        }}>
          ALL SYSTEMS OPERATIONAL
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            color: 'var(--text)',
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700,
            color: '#04101d',
          }}>
            S
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>
            SEB
          </span>
          <span style={{ fontSize: '10px', opacity: 0.4 }}>
            {menuOpen ? '▲' : '▼'}
          </span>
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            minWidth: '220px',
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '4px' }}>
                SEB
              </div>
              <div style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '0.8rem', color: 'var(--muted)',
              }}>
                seb@sebhosting.com
              </div>
            </div>

            <div style={{ padding: '8px' }}>
              <a
                href="https://github.com/sebhosting/nexus"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '8px',
                  textDecoration: 'none', color: 'var(--muted)',
                  fontSize: '0.95rem', fontWeight: 500,
                  transition: 'all 0.2s',
                }}
              >
                <span>📦</span>
                <span>GitHub Repo</span>
              </a>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '8px',
                  border: 'none', background: 'transparent',
                  color: 'var(--muted)', fontSize: '0.95rem',
                  fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                <span>🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 999,
          }}
        />
      )}
    </div>
  )
}
