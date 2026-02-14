import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const SERVICES: Record<string, string> = {
  frontend:    'https://nexus.sebhosting.com',
  api:         'https://api.sebhosting.com/health',
  auth:        'https://auth.sebhosting.com/health',
  cms:         'https://cms.sebhosting.com/health',
  cdn:         'https://cdn.sebhosting.com/health',
  cache:       'https://cache.sebhosting.com/health',
  waf:         'https://waf.sebhosting.com/health',
  'ai-gateway':'https://ai-gateway.sebhosting.com/health',
  grafana:     'https://grafana.sebhosting.com',
  mcp:         'https://mcp.sebhosting.com/health',
}

export function registerServiceTools(server: McpServer): void {

  server.registerTool('nexus_health_check',
    {
      title: 'Health Check All Services',
      description: `Ping all NeXuS public endpoints and return HTTP status codes.
Useful for a quick "are all services alive?" check.
Returns 200=ok, 302=redirect (normal for grafana), 502=container down.`,
      inputSchema: {
        service: z.string().optional().describe('Check one specific service, or omit for all'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ service }) => {
      const targets = service
        ? { [service]: SERVICES[service] || `https://${service}.sebhosting.com` }
        : SERVICES

      const results = await Promise.all(
        Object.entries(targets).map(async ([name, url]) => {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
            return { name, url, status: res.status, ok: res.status < 400 }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            return { name, url, status: 0, ok: false, error: msg }
          }
        })
      )

      const allOk  = results.every(r => r.ok)
      const upCount = results.filter(r => r.ok).length
      const lines   = results.map(r =>
        `${r.ok ? '✓' : '✗'} ${r.name.padEnd(14)} ${String(r.status || 'ERR').padEnd(4)} ${r.url}`
      )

      const text = [
        `HEALTH CHECK (${upCount}/${results.length} up)`,
        '─'.repeat(55),
        ...lines,
      ].join('\n')

      return {
        content: [{ type: 'text', text }],
        structuredContent: { allOk, upCount, total: results.length, services: results },
      }
    }
  )

  server.registerTool('nexus_system_overview',
    {
      title: 'System Overview',
      description: `Get a full NeXuS system overview: container counts, host memory, load average, Docker version.
Use this for a quick "how is the system doing?" summary.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const res  = await fetch('http://nexus-api:4000/stats', { signal: AbortSignal.timeout(5000) })
        const data = await res.json() as {
          running: number; stopped: number; total: number;
          docker: { serverVersion?: string; images?: string };
          host: { load1?: number; load5?: number; memPercent?: number; memUsed?: number; memTotal?: number }
        }

        const text = [
          'NEXUS SYSTEM OVERVIEW',
          '─'.repeat(40),
          `Containers:  ${data.running} running, ${data.stopped} stopped (${data.total} total)`,
          `Docker:      v${data.docker.serverVersion} · ${data.docker.images} images`,
          `Load avg:    ${data.host.load1?.toFixed(2)} (1m) / ${data.host.load5?.toFixed(2)} (5m)`,
          `Memory:      ${data.host.memPercent}% used`,
          `             ${Math.round((data.host.memUsed||0)/1024/1024/1024*10)/10}GB / ${Math.round((data.host.memTotal||0)/1024/1024/1024*10)/10}GB`,
        ].join('\n')

        return { content: [{ type: 'text', text }], structuredContent: data }
      } catch {
        return { content: [{ type: 'text', text: 'Could not reach nexus-api. Is it running?' }] }
      }
    }
  )
}
