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
