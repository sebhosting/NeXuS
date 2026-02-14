'use client'
import { useEffect, useState } from 'react'

type ServiceStatus = {
  name: string
  url: string
  status: 'healthy' | 'error' | 'loading'
  statusCode?: number
  endpoint?: string
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
            return {
              ...service,
              status: res.ok ? 'healthy' : 'error',
              statusCode: res.status,
            } as ServiceStatus
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
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          fontFamily: 'Rajdhani',
          letterSpacing: '2px',
          color: 'var(--cyan)',
          marginBottom: '8px'
        }}>
          SERVICES
        </h1>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '14px',
          fontFamily: 'JetBrains Mono'
        }}>
          Manage and monitor all NeXuS microservices
        </p>
      </div>

      {/* Services Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '20px'
      }}>
        {services.map(service => (
          <div key={service.name} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '20px',
            transition: 'all 0.2s',
          }}>
            {/* Status Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: service.status === 'healthy' ? 'var(--green)' : 
                           service.status === 'error' ? 'var(--red)' : 'var(--yellow)',
                boxShadow: service.status === 'healthy' ? '0 0 8px var(--green)' :
                           service.status === 'error' ? '0 0 8px var(--red)' : 
                           '0 0 8px var(--yellow)',
              }} />
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 700,
                fontFamily: 'Rajdhani',
                letterSpacing: '1px',
                flex: 1
              }}>
                {service.name}
              </h3>
              {service.statusCode && (
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--text-dim)',
                  background: 'var(--bg-primary)',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}>
                  {service.statusCode}
                </span>
              )}
            </div>

            {/* URL */}
            <div style={{ 
              fontSize: '12px',
              fontFamily: 'JetBrains Mono',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
              wordBreak: 'break-all'
            }}>
              {service.url}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <a 
                href={service.url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--cyan)',
                  color: 'var(--bg-primary)',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Rajdhani',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
              >
                OPEN ↗
              </a>
              <a 
                href={`${service.url}${service.endpoint}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Rajdhani',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
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
