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
          MCP SERVER
        </h1>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '14px',
          fontFamily: 'JetBrains Mono',
          marginBottom: '16px'
        }}>
          Model Context Protocol integration for Claude Code
        </p>
        
        {/* Status Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(0,255,135,0.1)',
          border: '1px solid rgba(0,255,135,0.3)',
          borderRadius: '20px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 8px var(--green)',
          }} />
          <span style={{
            fontSize: '12px',
            fontFamily: 'JetBrains Mono',
            color: 'var(--green)',
            fontWeight: 600
          }}>
            ACTIVE
          </span>
        </div>
      </div>

      {/* Connection Info */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'Rajdhani',
          letterSpacing: '1px',
          marginBottom: '16px'
        }}>
          Connection Details
        </h3>
        <div style={{ 
          fontFamily: 'JetBrains Mono', 
          fontSize: '13px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Endpoint: </span>
            <span style={{ color: 'var(--cyan)' }}>https://mcp.sebhosting.com/mcp</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Transport: </span>
            <span style={{ color: 'var(--text-secondary)' }}>StreamableHTTP</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Auth: </span>
            <span style={{ color: 'var(--text-secondary)' }}>Cloudflare Access (Service Token)</span>
          </div>
        </div>
      </div>

      {/* Available Tools */}
      <h3 style={{
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: 'Rajdhani',
        letterSpacing: '1px',
        marginBottom: '16px'
      }}>
        Available Tools ({tools.length})
      </h3>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '12px'
      }}>
        {tools.map((tool, i) => (
          <div key={i} style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px',
          }}>
            <div style={{
              fontSize: '13px',
              fontFamily: 'JetBrains Mono',
              color: 'var(--cyan)',
              fontWeight: 600,
              marginBottom: '6px'
            }}>
              {tool.name}
            </div>
            <div style={{
              fontSize: '12px',
              fontFamily: 'JetBrains Mono',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              {tool.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Usage Example */}
      <div style={{
        marginTop: '32px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: 'Rajdhani',
          letterSpacing: '1px',
          marginBottom: '16px'
        }}>
          Claude Code Configuration
        </h3>
        <pre style={{
          fontFamily: 'JetBrains Mono',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          background: 'var(--bg-primary)',
          padding: '16px',
          borderRadius: '4px',
          overflow: 'auto',
          lineHeight: 1.6
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
