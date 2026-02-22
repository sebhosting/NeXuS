'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { label: 'Dashboard',   href: '/dashboard',           icon: '⬡' },
  { label: 'Services',    href: '/dashboard/services',   icon: '⬡' },
  { label: 'DNS',         href: '/dashboard/dns',        icon: '⬡' },
  { label: 'MCP Server',  href: '/dashboard/mcp',        icon: '⬡' },
]

const MANAGE = [
  { label: 'CMS',         href: '/dashboard/cms',        icon: '⬡' },
  { label: 'CDN',         href: '/dashboard/cdn',        icon: '⬡' },
  { label: 'Cache',       href: '/dashboard/cache',      icon: '⬡' },
  { label: 'Auth',        href: '/dashboard/auth',       icon: '⬡' },
  { label: 'WAF',         href: '/dashboard/waf',        icon: '⬡' },
  { label: 'AI Gateway',  href: '/dashboard/ai',         icon: '⬡' },
  { label: 'Backups',     href: '/dashboard/backups',    icon: '⬡' },
  { label: 'Sites',       href: '/dashboard/sites',      icon: '⬡' },
]

const SETTINGS = [
  { label: 'Settings',    href: '/dashboard/settings',   icon: '⬡' },
]

const SITES = [
  { label: 'SEBHosting.com', url: 'https://sebhosting.com',            icon: '🌐' },
]

const TOOLS = [
  { label: 'Grafana',     url: 'https://grafana.sebhosting.com',    icon: '📊' },
  { label: 'Prometheus',  url: 'https://prometheus.sebhosting.com', icon: '🔥' },
  { label: 'Traefik',     url: 'https://traefik.sebhosting.com',    icon: '🔀' },
]

function NavItem({ href, label, icon }: { href: string, label: string, icon: string }) {
  const pathname = usePathname()
  const active = pathname === href
  const [hover, setHover] = useState(false)
  return (
    <Link href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
        background: active ? 'rgba(255,180,0,0.08)' : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: active ? '3px solid var(--highlight)' : '3px solid transparent',
        color: active ? 'var(--highlight)' : hover ? 'var(--text)' : 'var(--muted)',
        fontWeight: active ? 700 : 500, fontSize: '0.95rem',
        textDecoration: 'none', transition: 'all 0.2s',
      }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize: '14px', opacity: 0.6 }}>{icon}</span>
      {label}
    </Link>
  )
}

function ExtItem({ url, label, icon, dot }: { url: string, label: string, icon: string, dot?: string }) {
  const [hover, setHover] = useState(false)
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
        background: hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: '3px solid transparent',
        color: hover ? 'var(--text)' : 'var(--muted)',
        fontWeight: 500, fontSize: '0.95rem',
        textDecoration: 'none', transition: 'all 0.2s',
      }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 5px var(--success)', flexShrink: 0 }} />}
      <span style={{ fontSize: '10px', opacity: 0.3 }}>↗</span>
    </a>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div style={{
      padding: '16px 16px 6px', fontFamily: "'Courier New', monospace",
      fontSize: '0.7rem', letterSpacing: '2px', color: 'var(--muted)',
      userSelect: 'none', opacity: 0.6, textTransform: 'uppercase',
    }}>
      {label}
    </div>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? '56px' : '240px',
      background: '#05081a',
      borderRight: '1px solid var(--border-accent)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        height: '56px', display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 14px' : '0 16px', gap: '12px',
        borderBottom: '1px solid var(--border-accent)', flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: '1.4rem', fontWeight: 900,
          color: 'var(--accent)', flexShrink: 0,
        }}>
          &lt;/&gt;
        </div>
        {!collapsed && (
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '1px' }}>
            NeXuS
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px', padding: '2px', transition: 'color 0.2s' }}>
            ◀
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '14px', fontSize: '14px' }}>
          ▶
        </button>
      )}

      {/* Nav */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <Section label="Navigation" />
          {NAV.map(n => <NavItem key={n.href} {...n} />)}

          <Section label="Manage" />
          {MANAGE.map(n => <NavItem key={n.href} {...n} />)}

          <Section label="Settings" />
          {SETTINGS.map(n => <NavItem key={n.href} {...n} />)}

          <Section label="Sites" />
          {SITES.map(s => <ExtItem key={s.url} {...s} dot="green" />)}

          <Section label="Tools" />
          {TOOLS.map(t => <ExtItem key={t.url} {...t} dot="green" />)}
        </div>
      )}

      {/* Version */}
      {!collapsed && (
        <div style={{
          padding: '14px 16px', borderTop: '1px solid var(--border-accent)',
          fontFamily: "'Courier New', monospace", fontSize: '0.65rem',
          color: 'var(--muted)', letterSpacing: '1px', opacity: 0.5,
        }}>
          NEXUS MGR v3.0
        </div>
      )}
    </aside>
  )
}
