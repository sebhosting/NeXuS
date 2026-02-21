'use client'

export default function GrafanaPage() {
  return (
    <div style={{
      margin: '-32px',
      width: 'calc(100% + 64px)',
      height: 'calc(100vh - 56px)',
      overflow: 'hidden',
    }}>
      <iframe
        src="/grafana"
        style={{
          width: '100%', height: '100%', border: 'none',
        }}
        title="Grafana"
      />
    </div>
  )
}
