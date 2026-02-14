import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execSync } from 'child_process'

function safeContainerName(name: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Invalid container name: ${name}`)
  return name
}

export function registerLogTools(server: McpServer): void {

  server.registerTool('nexus_get_logs',
    {
      title: 'Get Container Logs',
      description: `Fetch the last N log lines from a NeXuS container.
Use this to debug issues, check startup errors, or monitor activity.
Container name examples: "auth", "api", "frontend", "postgres", "redis"`,
      inputSchema: {
        name:  z.string().describe('Container short name (e.g. "auth", "api")'),
        lines: z.number().int().min(5).max(200).default(50).describe('Number of log lines to return (5-200)'),
        since: z.string().optional().describe('Only logs since this time, e.g. "10m", "1h", "2024-01-01T00:00:00"'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, lines, since }) => {
      const safe  = safeContainerName(`nexus-${name}`)
      const since_flag = since ? `--since ${since}` : ''
      let logs: string
      try {
        logs = execSync(`docker logs ${safe} --tail ${lines} ${since_flag} 2>&1`, { encoding: 'utf8', timeout: 10000 })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Failed to get logs for ${safe}: ${msg}`)
      }

      const logLines  = logs.trim().split('\n')
      const truncated = logLines.length >= lines

      const text = [
        `LOGS: ${safe} (last ${logLines.length} lines${truncated ? ', truncated' : ''})`,
        '─'.repeat(50),
        logs.trim(),
      ].join('\n')

      return {
        content: [{ type: 'text', text }],
        structuredContent: { container: safe, lineCount: logLines.length, logs: logLines },
      }
    }
  )

  server.registerTool('nexus_search_logs',
    {
      title: 'Search Container Logs',
      description: `Search container logs for a specific string or error pattern.
Useful for finding when an error first appeared or tracking a specific event.`,
      inputSchema: {
        name:    z.string().describe('Container short name'),
        pattern: z.string().min(2).max(100).describe('Text to search for (case-insensitive)'),
        lines:   z.number().int().min(50).max(1000).default(200).describe('How many recent lines to search through'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ name, pattern, lines }) => {
      const safe = safeContainerName(`nexus-${name}`)
      const logs = execSync(`docker logs ${safe} --tail ${lines} 2>&1`, { encoding: 'utf8', timeout: 10000 })
      const matches = logs.split('\n').filter(l => l.toLowerCase().includes(pattern.toLowerCase()))

      if (!matches.length) {
        return {
          content: [{ type: 'text', text: `No matches for "${pattern}" in last ${lines} lines of ${safe}` }],
          structuredContent: { matches: 0, lines: [] },
        }
      }

      const text = [
        `SEARCH: "${pattern}" in ${safe} — ${matches.length} matches`,
        '─'.repeat(50),
        matches.join('\n'),
      ].join('\n')

      return {
        content: [{ type: 'text', text }],
        structuredContent: { container: safe, pattern, matches: matches.length, lines: matches },
      }
    }
  )
}
