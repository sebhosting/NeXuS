'use client'
import { useEffect, useState } from 'react'

type ServiceStatus = {
  name: string; url: string; status: 'healthy' | 'error' | 'loading'
  statusCode?: number; endpoint?: string
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'CMS', url: 'https://cms.sebhosting.com', status: 'loading', endpoint: '/pages' },
    { name: 'CDN', url: 'https://cdn.sebhosting.com', status: 'loading', endpoint: '/files' },
    { name: 'Cache', url: 'https://cache.sebhosting.com', status: 'loading', endpoint: '/stats' },
    { name: 'Auth', url: 'https://auth.sebhosting.com', status: 'loading', endpoint: '/health' },
    { name: 'WAF', url: 'https://waf.sebhosting.com', status: 'loading', endpoint: '/health' },
    { name: 'AI Gateway', url: 'https://ai-gateway.sebhosting.com', status: 'loading', endpoint: '/stats' },
  ])

  useEffect(() => {
    const checkServices = async () => {
      const results = await Promise.all(
        services.map(async (service) => {
          try {
            const res = await fetch(`${service.url}${service.endpoint}`)
            return { ...service, status: res.ok ? 'healthy' : 'error', statusCode: res.status } as ServiceStatus
          } catch {
            return { ...service, status: 'error', statusCode: 0 } as ServiceStatus
          }
        })
      )
      setServices(results)
    }

    checkServices()
    const interval = setInterval(checkServices, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Core <span style={{ color: 'var(--highlight)' }}>Services</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
          Monitor and manage all NeXuS microservices
        </p>
      </div>

      {/* Services Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
        {services.map(service => (
          <div key={service.name} style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '28px',
            transition: 'all 0.4s',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 15px 40px rgba(255, 180, 0, 0.15)'
            e.currentTarget.style.background = 'rgba(255, 180, 0, 0.03)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.background = 'var(--panel)'
          }}
          >
            {/* Status Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: service.status === 'healthy' ? 'var(--success)' :
                  service.status === 'error' ? 'var(--red)' : 'var(--highlight)',
                boxShadow: service.status === 'healthy' ? '0 0 8px var(--success)' :
                  service.status === 'error' ? '0 0 8px var(--red)' : '0 0 8px var(--highlight)',
              }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                {service.name}
              </h3>
              {service.statusCode !== undefined && (
                <span style={{
                  fontFamily: "'Courier New', monospace", fontSize: '0.8rem',
                  color: 'var(--muted)', background: 'rgba(76, 201, 240, 0.08)',
                  padding: '3px 8px', borderRadius: '6px',
                }}>
                  {service.statusCode}
                </span>
              )}
            </div>

            {/* URL */}
            <div style={{
              fontFamily: "'Courier New', monospace", fontSize: '0.85rem',
              color: 'var(--muted)', marginBottom: '20px', wordBreak: 'break-all',
            }}>
              {service.url}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href={service.url} target="_blank" rel="noopener noreferrer"
                style={{
                  flex: 1, padding: '10px 16px',
                  background: 'var(--accent-2)', color: '#04101d',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem', fontWeight: 700,
                  textAlign: 'center', textDecoration: 'none',
                  textTransform: 'uppercase', letterSpacing: '1px',
                  transition: 'all 0.3s', cursor: 'pointer',
                }}
              >
                Open ↗
              </a>
              <a href={`${service.url}${service.endpoint}`} target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--muted)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem', fontWeight: 600,
                  textDecoration: 'none', textTransform: 'uppercase',
                  letterSpacing: '1px', transition: 'all 0.3s',
                }}
              >
                API
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
