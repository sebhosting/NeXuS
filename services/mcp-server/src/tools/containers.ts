import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execSync } from 'child_process'

function docker(cmd: string): string {
  try {
    return execSync(`docker ${cmd}`, { encoding: 'utf8', timeout: 15000 }).trim()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Docker command failed: ${msg}`)
  }
}

function safeContainerName(name: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Invalid container name: ${name}`)
  return name
}

export function registerContainerTools(server: McpServer): void {

  server.registerTool('nexus_list_containers',
    {
      title: 'List Containers',
      description: `List all NeXuS Docker containers with status, CPU%, memory, and network I/O.
Returns running/stopped counts plus per-container resource usage.
Use this first to get an overview of what's running.`,
      inputSchema: { filter: z.enum(['all','running','stopped']).default('all').describe('Which containers to show') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ filter }) => {
      const flag = filter === 'running' ? '--filter status=running' : filter === 'stopped' ? '--filter status=exited' : ''
      const raw = docker(`ps -a ${flag} --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","state":"{{.State}}","status":"{{.Status}}"}'`)
      const containers = raw.split('\n').filter(Boolean).map(l => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean)

      // Get stats for running containers
      let statsMap: Record<string, { cpu: string; mem: string }> = {}
      try {
        const statsRaw = docker(`stats --no-stream --format '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}"}'`)
        statsRaw.split('\n').filter(Boolean).forEach(l => {
          try { const s = JSON.parse(l); statsMap[s.name] = s } catch {}
        })
      } catch {}

      const enriched = containers.map((c: Record<string, string>) => ({
        name:   c.name.replace('nexus-', ''),
        state:  c.state,
        status: c.status,
        cpu:    statsMap[c.name]?.cpu || '—',
        mem:    statsMap[c.name]?.mem || '—',
      }))

      const running = enriched.filter(c => c.state === 'running').length
      const lines = enriched.map(c =>
        `${c.state === 'running' ? '●' : '○'} ${c.name.padEnd(16)} ${c.state.padEnd(10)} CPU:${c.cpu.padEnd(8)} MEM:${c.mem}`
      )

      const text = [
        `NEXUS CONTAINERS (${running}/${enriched.length} running)`,
        '─'.repeat(60),
        ...lines,
      ].join('\n')

      return {
        content: [{ type: 'text', text }],
        structuredContent: { running, total: enriched.length, containers: enriched },
      }
    }
  )

  server.registerTool('nexus_restart_container',
    {
      title: 'Restart Container',
      description: `Restart a NeXuS container by name (e.g. "auth", "frontend", "api").
The "nexus-" prefix is added automatically.
Use nexus_list_containers first to get the correct name.`,
      inputSchema: {
        name:   z.string().describe('Container short name (e.g. "auth", "api", "frontend")'),
        reason: z.string().optional().describe('Why you are restarting (for the log)'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, reason }) => {
      const safe = safeContainerName(`nexus-${name}`)
      docker(`restart ${safe}`)
      const text = `✓ Restarted ${safe}${reason ? `\nReason: ${reason}` : ''}`
      return { content: [{ type: 'text', text }], structuredContent: { container: safe, restarted: true } }
    }
  )

  server.registerTool('nexus_stop_container',
    {
      title: 'Stop Container',
      description: `Stop a running NeXuS container. Use with caution.
Does NOT remove the container, just stops it. Use nexus_restart_container to bring it back.`,
      inputSchema: {
        name:    z.string().describe('Container short name (e.g. "cms", "waf")'),
        confirm: z.literal('yes').describe('Must be "yes" to confirm stop'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, confirm: _confirm }) => {
      const safe = safeContainerName(`nexus-${name}`)
      docker(`stop ${safe}`)
      return { content: [{ type: 'text', text: `✓ Stopped ${safe}` }], structuredContent: { container: safe, stopped: true } }
    }
  )

  server.registerTool('nexus_container_stats',
    {
      title: 'Container Resource Stats',
      description: `Get detailed CPU, memory, network, and block I/O stats for a specific container.`,
      inputSchema: { name: z.string().describe('Container short name') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const safe = safeContainerName(`nexus-${name}`)
      const raw  = docker(`stats ${safe} --no-stream --format '{"cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}","net":"{{.NetIO}}","block":"{{.BlockIO}}","pids":"{{.PIDs}}"}'`)
      const stats = JSON.parse(raw)
      const text = [
        `STATS: ${safe}`,
        `  CPU:     ${stats.cpu}`,
        `  Memory:  ${stats.mem} (${stats.memPerc})`,
        `  Network: ${stats.net}`,
        `  Block:   ${stats.block}`,
        `  PIDs:    ${stats.pids}`,
      ].join('\n')
      return { content: [{ type: 'text', text }], structuredContent: { container: safe, ...stats } }
    }
  )
}
