'use client'

export default function MCPPage() {
  const tools = [
    { name: 'nexus_list_containers', desc: 'List all Docker containers with stats' },
    { name: 'nexus_restart_container', desc: 'Restart a container by name' },
    { name: 'nexus_stop_container', desc: 'Stop a running container' },
    { name: 'nexus_container_stats', desc: 'Get detailed stats for one container' },
    { name: 'nexus_health_check', desc: 'Ping all public NeXuS endpoints' },
    { name: 'nexus_system_overview', desc: 'Full system summary with load/memory' },
    { name: 'nexus_get_logs', desc: 'Fetch container logs (last N lines)' },
    { name: 'nexus_search_logs', desc: 'Grep through container logs' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          MCP <span style={{ color: 'var(--highlight)' }}>Server</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1rem', marginBottom: '16px' }}>
          Model Context Protocol integration for Claude Code
        </p>

        {/* Status Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '8px 18px', background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--success)', boxShadow: '0 0 8px var(--success)',
          }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
            ACTIVE
          </span>
        </div>
      </div>

      {/* Connection Info */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        borderLeft: '3px solid var(--highlight)',
        borderRadius: 'var(--radius)', padding: '28px', marginBottom: '32px',
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>
          Connection Details
        </h3>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <span style={{ color: 'var(--accent)' }}>endpoint: </span>
            <span style={{ color: 'var(--text)' }}>https://mcp.sebhosting.com/mcp</span>
          </div>
          <div>
            <span style={{ color: 'var(--accent)' }}>transport: </span>
            <span style={{ color: 'var(--text)' }}>StreamableHTTP</span>
          </div>
          <div>
            <span style={{ color: 'var(--accent)' }}>auth: </span>
            <span style={{ color: 'var(--text)' }}>Cloudflare Access (Service Token)</span>
          </div>
        </div>
      </div>

      {/* Available Tools */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '20px' }}>
        Available Tools ({tools.length})
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {tools.map((tool, i) => (
          <div key={i} style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px',
            transition: 'all 0.3s', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 30px rgba(255,180,0,0.1)'; e.currentTarget.style.background = 'rgba(255,180,0,0.03)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--panel)' }}
          >
            <div style={{
              fontFamily: "'Courier New', monospace", fontSize: '0.9rem',
              color: 'var(--accent)', fontWeight: 600, marginBottom: '8px',
            }}>
              {tool.name}
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {tool.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Usage Example */}
      <div style={{
        marginTop: '40px', background: 'var(--panel)',
        border: '1px solid var(--border)', borderLeft: '3px solid var(--highlight)',
        borderRadius: 'var(--radius)', padding: '28px',
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>
          Claude Code Configuration
        </h3>
        <pre style={{
          fontFamily: "'Courier New', monospace", fontSize: '0.85rem',
          color: 'var(--muted)', background: 'rgba(0,0,0,0.3)',
          padding: '20px', borderRadius: 'var(--radius-sm)',
          overflow: 'auto', lineHeight: 1.7,
        }}>
{`~/.config/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "nexus": {
      "type": "http",
      "url": "https://mcp.sebhosting.com/mcp",
      "headers": {
        "CF-Access-Client-Id": "your-token-id",
        "CF-Access-Client-Secret": "your-token-secret"
      }
    }
  }
}`}
        </pre>
      </div>
    </div>
  )
}
