'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { label: 'Dashboard',   href: '/dashboard',          icon: '⬡' },
  { label: 'Services',    href: '/dashboard/services',  icon: '⬡' },
  { label: 'MCP Server',  href: '/dashboard/mcp',       icon: '⬡' },
]

const SERVICES = [
  { label: 'CMS',         url: 'https://cms.sebhosting.com',        icon: '⬡' },
  { label: 'CDN',         url: 'https://cdn.sebhosting.com',        icon: '⬡' },
  { label: 'Cache',       url: 'https://cache.sebhosting.com',      icon: '⬡' },
  { label: 'Auth',        url: 'https://auth.sebhosting.com',       icon: '⬡' },
  { label: 'WAF',         url: 'https://waf.sebhosting.com',        icon: '⬡' },
  { label: 'AI Gateway',  url: 'https://ai-gateway.sebhosting.com', icon: '⬡' },
]

const SITES = [
  { label: 'SEBHosting.com', url: 'https://sebhosting.com',            icon: '🌐' },
]

const TOOLS = [
  { label: 'Grafana',     url: 'https://grafana.sebhosting.com',    icon: '📊' },
  { label: 'Prometheus',  url: 'https://prometheus.sebhosting.com', icon: '🔥' },
  { label: 'Traefik',     url: 'https://traefik.sebhosting.com',    icon: '🔀' },
]

const itemStyle = (active: boolean, hover: boolean) => ({
  display: 'flex', alignItems: 'center', gap: '10px',
  padding: '8px 16px', borderRadius: '4px', cursor: 'pointer',
  background: active ? 'rgba(0,212,255,0.1)' : hover ? 'var(--bg-hover)' : 'transparent',
  borderLeft: active ? '2px solid var(--cyan)' : '2px solid transparent',
  color: active ? 'var(--cyan)' : 'var(--text-secondary)',
  fontFamily: 'Rajdhani', fontWeight: 600, fontSize: '13px',
  letterSpacing: '1px', textDecoration: 'none',
  transition: 'all 0.15s',
})

function NavItem({ href, label, icon }: { href: string, label: string, icon: string }) {
  const pathname = usePathname()
  const active = pathname === href
  const [hover, setHover] = useState(false)
  return (
    <Link href={href} style={itemStyle(active, hover) as React.CSSProperties}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize: '16px', opacity: 0.7 }}>{icon}</span>
      {label}
    </Link>
  )
}

function ExtItem({ url, label, icon, dot }: { url: string, label: string, icon: string, dot?: string }) {
  const [hover, setHover] = useState(false)
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={itemStyle(false, hover) as React.CSSProperties}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize: '15px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 5px var(--green)', flexShrink: 0 }} />}
      <span style={{ fontSize: '9px', opacity: 0.4 }}>↗</span>
    </a>
  )
}

function Section({ label }: { label: string }) {
  return (
    <div style={{ padding: '12px 16px 4px', fontFamily: 'JetBrains Mono', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', userSelect: 'none' }}>
      {label}
    </div>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? '52px' : '220px',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        height: '52px', display: 'flex', alignItems: 'center',
        padding: collapsed ? '0 14px' : '0 16px', gap: '12px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{
          width: '24px', height: '24px', flexShrink: 0,
          background: 'var(--cyan)',
          clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
          boxShadow: '0 0 12px var(--cyan-dim)',
        }} />
        {!collapsed && (
          <div>
            <div style={{ fontFamily: 'Rajdhani', fontSize: '15px', fontWeight: 700, letterSpacing: '3px', color: 'var(--cyan)', lineHeight: 1 }}>NEXUS</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '2px' }}>MGR v3.0</div>
          </div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>
            ◀
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '12px', fontSize: '14px' }}>
          ▶
        </button>
      )}

      {/* Nav */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <Section label="NAVIGATION" />
          {NAV.map(n => <NavItem key={n.href} {...n} />)}

          <Section label="SERVICES" />
          {SERVICES.map(s => <ExtItem key={s.url} {...s} dot="green" />)}

          <Section label="SITES" />
          {SITES.map(s => <ExtItem key={s.url} {...s} dot="green" />)}

          <Section label="TOOLS" />
          {TOOLS.map(t => <ExtItem key={t.url} {...t} dot="green" />)}
        </div>
      )}

      {/* Version */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontFamily: 'JetBrains Mono', fontSize: '8px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
          NODE: {process.env.NODE_ENV || 'production'}
        </div>
      )}
    </aside>
  )
}
