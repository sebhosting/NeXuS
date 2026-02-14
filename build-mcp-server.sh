#!/bin/bash
# NeXuS MCP Server - Full Build
# Cloudflare Access (Zero Trust) + StreamableHTTP transport
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
NEXUS="$HOME/NeXuS"
MCP="$NEXUS/services/mcp-server"
DOCKER="$NEXUS/infrastructure/docker"

echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   NeXuS MCP Server - Claude Desktop Bridge   ║${NC}"
echo -e "${CYAN}║   StreamableHTTP + Cloudflare Zero Trust      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

mkdir -p $MCP/src/tools

# ─── 1. PACKAGE.JSON ─────────────────────────────────────────
echo -e "${BOLD}[1/6] Writing package.json...${NC}"
cat > $MCP/package.json << 'EOF'
{
  "name": "nexus-mcp-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "express": "^5.2.1",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "zod": "^3.25.0",
    "@types/express": "^5.0.6",
    "@types/cors": "^2.8.17",
    "@types/node": "^25.2.3",
    "typescript": "^5.9.3",
    "tsx": "^4.21.0"
  }
}
EOF
echo -e "${GREEN}✓ package.json${NC}"

# ─── 2. TSCONFIG ─────────────────────────────────────────────
cat > $MCP/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
EOF

# ─── 3. MAIN SERVER ──────────────────────────────────────────
echo -e "${BOLD}[2/6] Writing main server...${NC}"
cat > $MCP/src/index.ts << 'EOF'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { registerContainerTools } from './tools/containers'
import { registerServiceTools } from './tools/services'
import { registerLogTools } from './tools/logs'

dotenv.config({ quiet: true } as any)

const PORT = process.env.MCP_PORT || 5001
const CF_SERVICE_TOKEN_ID     = process.env.CF_SERVICE_TOKEN_ID     || ''
const CF_SERVICE_TOKEN_SECRET = process.env.CF_SERVICE_TOKEN_SECRET || ''

// ── Build MCP server ─────────────────────────────────────────
const server = new McpServer({
  name: 'nexus-mcp-server',
  version: '1.0.0',
})

registerContainerTools(server)
registerServiceTools(server)
registerLogTools(server)

// ── Express app ──────────────────────────────────────────────
const app = express()

app.use(cors({
  origin: ['https://claude.ai', 'https://mcp.sebhosting.com'],
  credentials: true,
}))
app.use(express.json())

// ── Cloudflare Service Token auth middleware ─────────────────
function validateCFToken(req: Request, res: Response, next: Function) {
  // If tokens configured, enforce them
  if (CF_SERVICE_TOKEN_ID && CF_SERVICE_TOKEN_SECRET) {
    const id     = req.headers['cf-access-client-id']     as string
    const secret = req.headers['cf-access-client-secret'] as string
    if (id !== CF_SERVICE_TOKEN_ID || secret !== CF_SERVICE_TOKEN_SECRET) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }
  next()
}

// ── Health (no auth) ─────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    service: 'nexus-mcp-server',
    status:  'healthy',
    port:    PORT,
    tools:   ['containers', 'services', 'logs'],
  })
})

// ── MCP endpoint (Cloudflare Access protected) ───────────────
app.post('/mcp', validateCFToken, async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  res.on('close', () => transport.close())
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.listen(PORT, () => {
  console.log(`✓ NeXuS MCP Server on port ${PORT}`)
  console.log(`  POST https://mcp.sebhosting.com/mcp`)
})
EOF
echo -e "${GREEN}✓ src/index.ts${NC}"

# ─── 4. TOOLS ────────────────────────────────────────────────
echo -e "${BOLD}[3/6] Writing tools...${NC}"

# Shared API client
cat > $MCP/src/api.ts << 'EOF'
const API_BASE = process.env.NEXUS_API_URL || 'http://nexus-api:4000'

export async function nexusApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`)
  return res.json() as Promise<T>
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes}B`
  if (bytes < 1024**2)    return `${(bytes/1024).toFixed(1)}KB`
  if (bytes < 1024**3)    return `${(bytes/1024**2).toFixed(1)}MB`
  return `${(bytes/1024**3).toFixed(2)}GB`
}
EOF

# Container tools
cat > $MCP/src/tools/containers.ts << 'EOF'
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
EOF

# Service tools
cat > $MCP/src/tools/services.ts << 'EOF'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const SERVICES: Record<string, string> = {
  frontend:    'https://nexus.sebhosting.com',
  api:         'https://api.sebhosting.com',
  auth:        'https://auth.sebhosting.com',
  cms:         'https://cms.sebhosting.com',
  cdn:         'https://cdn.sebhosting.com',
  cache:       'https://cache.sebhosting.com',
  waf:         'https://waf.sebhosting.com',
  'ai-gateway':'https://ai-gateway.sebhosting.com',
  grafana:     'https://grafana.sebhosting.com',
  mcp:         'https://mcp.sebhosting.com',
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
EOF

# Log tools
cat > $MCP/src/tools/logs.ts << 'EOF'
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
EOF

echo -e "${GREEN}✓ All tools written${NC}"

# ─── 5. DOCKERFILE ───────────────────────────────────────────
echo -e "${BOLD}[4/6] Writing Dockerfile...${NC}"
cat > $MCP/Dockerfile << 'EOF'
FROM node:25-alpine
RUN npm install -g npm@11.10.0
# Need docker CLI inside the container to talk to the socket
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
EXPOSE 5001
CMD ["npm", "start"]
EOF
echo -e "${GREEN}✓ Dockerfile (includes docker-cli for socket access)${NC}"

# ─── 6. PATCH DOCKER-COMPOSE ─────────────────────────────────
echo -e "${BOLD}[5/6] Patching docker-compose.yml...${NC}"

python3 << 'PYEOF'
import os
compose_path = f"{os.environ['HOME']}/NeXuS/infrastructure/docker/docker-compose.yml"
with open(compose_path, 'r') as f:
    content = f.read()

if 'mcp.sebhosting.com' not in content:
    # Find the mcp-server stub and replace
    old = '''  mcp-server:
    build: ../../services/mcp-server
    container_name: nexus-mcp
    restart: unless-stopped
    env_file: .env
    networks:
      - traefik-public
      - nexus-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nexus-mcp.rule=Host(`mcp.sebhosting.com`)"
      - "traefik.http.routers.nexus-mcp.entrypoints=websecure"
      - "traefik.http.routers.nexus-mcp.tls.certresolver=letsencrypt"
      - "traefik.http.services.nexus-mcp.loadbalancer.server.port=5001"
      - "traefik.docker.network=traefik-public"'''

    new = '''  mcp-server:
    build: ../../services/mcp-server
    container_name: nexus-mcp
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - traefik-public
      - nexus-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nexus-mcp.rule=Host(`mcp.sebhosting.com`)"
      - "traefik.http.routers.nexus-mcp.entrypoints=websecure"
      - "traefik.http.routers.nexus-mcp.tls.certresolver=letsencrypt"
      - "traefik.http.services.nexus-mcp.loadbalancer.server.port=5001"
      - "traefik.docker.network=traefik-public"'''

    if old in content:
        content = content.replace(old, new)
        with open(compose_path, 'w') as f:
            f.write(content)
        print("✓ docker-compose.yml patched with Docker socket + correct labels")
    else:
        print("⚠ Could not find mcp-server block to patch - check compose file manually")
        print("  Add this to the mcp-server service:")
        print("    volumes:")
        print("      - /var/run/docker.sock:/var/run/docker.sock:ro")
else:
    print("~ mcp-server already configured")
PYEOF

# Add env vars
ENV_FILE="$DOCKER/.env"
grep -q "CF_SERVICE_TOKEN_ID"     $ENV_FILE || echo "CF_SERVICE_TOKEN_ID="     >> $ENV_FILE
grep -q "CF_SERVICE_TOKEN_SECRET" $ENV_FILE || echo "CF_SERVICE_TOKEN_SECRET=" >> $ENV_FILE
grep -q "NEXUS_API_URL"           $ENV_FILE || echo "NEXUS_API_URL=http://nexus-api:4000" >> $ENV_FILE
grep -q "MCP_PORT"                $ENV_FILE || echo "MCP_PORT=5001"            >> $ENV_FILE

echo -e "${GREEN}✓ .env updated with CF token vars${NC}"

# ─── 7. CLAUDE DESKTOP CONFIG ────────────────────────────────
echo -e "${BOLD}[6/6] Writing Claude Desktop config...${NC}"

mkdir -p ~/mcp-client
cat > ~/mcp-client/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "nexus": {
      "type": "http",
      "url": "https://mcp.sebhosting.com/mcp",
      "headers": {
        "CF-Access-Client-Id": "PASTE_YOUR_CF_CLIENT_ID_HERE",
        "CF-Access-Client-Secret": "PASTE_YOUR_CF_CLIENT_SECRET_HERE"
      }
    }
  }
}
EOF

echo -e "${GREEN}✓ Claude Desktop config written to ~/mcp-client/claude_desktop_config.json${NC}"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                  BUILD COMPLETE                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}STEP 1 - Build + deploy:${NC}"
echo "  cd $DOCKER"
echo "  docker compose build --no-cache mcp-server"
echo "  docker compose up -d mcp-server"
echo "  docker compose logs -f mcp-server"
echo ""
echo -e "${BOLD}STEP 2 - Cloudflare Zero Trust (do this in the dashboard):${NC}"
echo "  1. Go to: https://one.dash.cloudflare.com"
echo "  2. Access → Applications → Add application → Self-hosted"
echo "     Name:           NeXuS MCP Server"
echo "     Domain:         mcp.sebhosting.com"
echo "  3. Policy:"
echo "     Action: Allow"
echo "     Include: Emails → seb@sebhosting.com"
echo "     Auth method: One-time PIN"
echo "  4. Access → Service Auth → Create Service Token"
echo "     Name: claude-desktop"
echo "     Copy the Client ID and Client Secret"
echo "  5. Paste them into your .env:"
echo "     CF_SERVICE_TOKEN_ID=<client_id>"
echo "     CF_SERVICE_TOKEN_SECRET=<client_secret>"
echo "  6. Also add them to ~/mcp-client/claude_desktop_config.json"
echo "     on your Ubuntu Desktop machine"
echo ""
echo -e "${BOLD}STEP 3 - Claude Desktop (on your Ubuntu Desktop):${NC}"
echo "  Config location: ~/.config/Claude/claude_desktop_config.json"
echo "  Copy the content from ~/mcp-client/claude_desktop_config.json"
echo "  and paste the real CF token values"
echo ""
echo -e "${BOLD}STEP 4 - Test:${NC}"
echo '  curl -s https://mcp.sebhosting.com/health'
echo "  Then in Claude Desktop: 'list my nexus containers'"
echo ""
echo -e "${YELLOW}Available MCP tools:${NC}"
echo "  nexus_list_containers    - see all containers + CPU/mem"
echo "  nexus_restart_container  - restart any service"
echo "  nexus_stop_container     - stop a container (requires confirm: yes)"
echo "  nexus_container_stats    - detailed stats for one container"
echo "  nexus_health_check       - ping all public endpoints"
echo "  nexus_system_overview    - full system summary"
echo "  nexus_get_logs           - fetch container logs"
echo "  nexus_search_logs        - grep through logs"
