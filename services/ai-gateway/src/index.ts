import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 5000

// Database for request logging
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'nexus-postgres',
  port: 5432,
  user: 'seb',
  password: process.env.POSTGRES_PASSWORD,
  database: 'nexus',
})

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Initialize DB schema
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_requests (
      id SERIAL PRIMARY KEY,
      model VARCHAR(100) NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      latency_ms INTEGER,
      status INTEGER,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_config (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO ai_config (key, value) VALUES ('default_model', 'claude-sonnet-4-5-20250514') ON CONFLICT DO NOTHING;
    INSERT INTO ai_config (key, value) VALUES ('max_tokens', '4096') ON CONFLICT DO NOTHING;
  `)
  console.log('✓ AI Gateway schema ready')
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ service: 'ai-gateway', status: 'healthy', providers: ['anthropic', 'openai'] })
})

// Proxy to Anthropic
app.post('/v1/messages', async (req: Request, res: Response) => {
  const startTime = Date.now()
  const { model = 'claude-sonnet-4-5-20250514', max_tokens = 4096, messages, stream = false } = req.body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, messages, stream }),
    })

    const data = await response.json()
    const latency = Date.now() - startTime

    // Log to database
    await pool.query(
      `INSERT INTO ai_requests (model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        model,
        data.usage?.input_tokens || 0,
        data.usage?.output_tokens || 0,
        (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        latency,
        response.status,
      ]
    )

    res.status(response.status).json(data)
  } catch (err: any) {
    const latency = Date.now() - startTime
    await pool.query(
      `INSERT INTO ai_requests (model, latency_ms, status, error) VALUES ($1, $2, $3, $4)`,
      [model, latency, 500, err.message]
    )
    res.status(500).json({ error: err.message })
  }
})

// Usage stats
app.get('/stats', async (_req, res) => {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_requests,
      SUM(prompt_tokens) as total_input_tokens,
      SUM(completion_tokens) as total_output_tokens,
      SUM(total_tokens) as total_tokens,
      AVG(latency_ms)::integer as avg_latency_ms,
      model
    FROM ai_requests
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY model
    ORDER BY total_requests DESC
  `)
  res.json({ period: '24h', models: result.rows })
})

// Daily token usage history (30 days)
app.get('/stats/history', async (_req, res) => {
  const result = await pool.query(`
    SELECT DATE(created_at) as date, COUNT(*) as requests,
      COALESCE(SUM(prompt_tokens),0) as input_tokens,
      COALESCE(SUM(completion_tokens),0) as output_tokens,
      COALESCE(SUM(total_tokens),0) as total_tokens,
      COALESCE(AVG(latency_ms),0)::integer as avg_latency
    FROM ai_requests WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at) ORDER BY date DESC
  `)
  res.json({ history: result.rows })
})

// Paginated recent requests
app.get('/stats/requests', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0
  const result = await pool.query(`
    SELECT id, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error, created_at
    FROM ai_requests ORDER BY created_at DESC LIMIT $1 OFFSET $2
  `, [limit, offset])
  res.json({ requests: result.rows })
})

// Get model configuration
app.get('/config', async (_req, res) => {
  const result = await pool.query(`SELECT key, value FROM ai_config`)
  const config: Record<string, string> = {}
  result.rows.forEach((row: { key: string; value: string }) => {
    config[row.key] = row.value
  })
  res.json(config)
})

// Update model configuration
app.put('/config', async (req: Request, res: Response) => {
  const { default_model, max_tokens } = req.body
  if (default_model) {
    await pool.query(`UPDATE ai_config SET value=$2, updated_at=NOW() WHERE key=$1`, ['default_model', default_model])
  }
  if (max_tokens) {
    await pool.query(`UPDATE ai_config SET value=$2, updated_at=NOW() WHERE key=$1`, ['max_tokens', String(max_tokens)])
  }
  res.json({ success: true })
})

initDB().then(() => {
  app.listen(PORT, () => console.log(`✓ AI Gateway on port ${PORT}`))
})

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-ai-gateway',
    version: '1.0.0',
    status: 'healthy',
    providers: ['anthropic', 'openai'],
    endpoints: {
      messages: 'POST /v1/messages (Anthropic proxy)',
      stats: 'GET /stats (24h usage)',
      statsHistory: 'GET /stats/history (30-day daily breakdown)',
      statsRequests: 'GET /stats/requests (paginated request log)',
      config: 'GET /config (model configuration)',
      configUpdate: 'PUT /config (update model configuration)',
      health: 'GET /health'
    }
  })
})
