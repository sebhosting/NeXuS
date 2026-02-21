import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7003

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'nexus-postgres',
  port: 5432,
  user: 'seb',
  password: process.env.POSTGRES_PASSWORD,
  database: 'nexus',
})

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waf_ip_rules (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      action VARCHAR(10) NOT NULL DEFAULT 'block',
      reason TEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waf_rate_rules (
      id SERIAL PRIMARY KEY,
      path_pattern VARCHAR(255) NOT NULL,
      max_requests INTEGER NOT NULL DEFAULT 100,
      window_seconds INTEGER NOT NULL DEFAULT 60,
      action VARCHAR(10) NOT NULL DEFAULT 'block',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waf_blocked_requests (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45),
      path VARCHAR(500),
      rule_type VARCHAR(20),
      rule_id INTEGER,
      blocked_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('✓ WAF schema ready')
}

// Root — service info
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-waf',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      health: 'GET /health',
      ipRules: 'GET /rules/ip | POST /rules/ip | DELETE /rules/ip/:id',
      rateRules: 'GET /rules/rate | POST /rules/rate | PUT /rules/rate/:id | DELETE /rules/rate/:id',
      blocked: 'GET /blocked?limit=50&offset=0 | POST /blocked/clear',
      stats: 'GET /stats',
    },
  })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ service: 'waf-service', status: 'healthy', port: PORT })
})

// --- IP Rules ---

// List all IP rules
app.get('/rules/ip', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, ip_address, action, reason, expires_at, created_at
     FROM waf_ip_rules ORDER BY created_at DESC`
  )
  res.json(result.rows)
})

// Create IP rule
app.post('/rules/ip', async (req, res) => {
  const { ip_address, action, reason, expires_at } = req.body
  if (!ip_address) return res.status(400).json({ error: 'ip_address is required' })

  const result = await pool.query(
    `INSERT INTO waf_ip_rules (ip_address, action, reason, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ip_address, action || 'block', reason || null, expires_at || null]
  )
  res.json(result.rows[0])
})

// Delete IP rule
app.delete('/rules/ip/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM waf_ip_rules WHERE id = $1 RETURNING id`,
    [req.params.id]
  )
  if (result.rows.length === 0) return res.status(404).json({ error: 'IP rule not found' })
  res.json({ success: true })
})

// --- Rate Rules ---

// List all rate rules
app.get('/rules/rate', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, path_pattern, max_requests, window_seconds, action, enabled, created_at
     FROM waf_rate_rules ORDER BY created_at DESC`
  )
  res.json(result.rows)
})

// Create rate rule
app.post('/rules/rate', async (req, res) => {
  const { path_pattern, max_requests, window_seconds, action } = req.body
  if (!path_pattern) return res.status(400).json({ error: 'path_pattern is required' })
  if (!max_requests) return res.status(400).json({ error: 'max_requests is required' })
  if (!window_seconds) return res.status(400).json({ error: 'window_seconds is required' })

  const result = await pool.query(
    `INSERT INTO waf_rate_rules (path_pattern, max_requests, window_seconds, action)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [path_pattern, max_requests, window_seconds, action || 'block']
  )
  res.json(result.rows[0])
})

// Update rate rule
app.put('/rules/rate/:id', async (req, res) => {
  const { path_pattern, max_requests, window_seconds, action, enabled } = req.body
  const result = await pool.query(
    `UPDATE waf_rate_rules
     SET path_pattern = COALESCE($1, path_pattern),
         max_requests = COALESCE($2, max_requests),
         window_seconds = COALESCE($3, window_seconds),
         action = COALESCE($4, action),
         enabled = COALESCE($5, enabled)
     WHERE id = $6 RETURNING *`,
    [path_pattern, max_requests, window_seconds, action, enabled, req.params.id]
  )
  if (result.rows.length === 0) return res.status(404).json({ error: 'Rate rule not found' })
  res.json(result.rows[0])
})

// Delete rate rule
app.delete('/rules/rate/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM waf_rate_rules WHERE id = $1 RETURNING id`,
    [req.params.id]
  )
  if (result.rows.length === 0) return res.status(404).json({ error: 'Rate rule not found' })
  res.json({ success: true })
})

// --- Blocked Requests ---

// List blocked requests
app.get('/blocked', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0

  const result = await pool.query(
    `SELECT id, ip_address, path, rule_type, rule_id, blocked_at
     FROM waf_blocked_requests ORDER BY blocked_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  )
  res.json(result.rows)
})

// Clear blocked requests
app.post('/blocked/clear', async (_req, res) => {
  await pool.query(`DELETE FROM waf_blocked_requests`)
  res.json({ success: true })
})

// --- Stats ---

app.get('/stats', async (_req, res) => {
  const blocked24h = await pool.query(
    `SELECT COUNT(*) as total FROM waf_blocked_requests
     WHERE blocked_at > NOW() - INTERVAL '24 hours'`
  )

  const activeIpRules = await pool.query(
    `SELECT COUNT(*) as total FROM waf_ip_rules`
  )

  const activeRateRules = await pool.query(
    `SELECT COUNT(*) as total FROM waf_rate_rules`
  )

  const topBlocked = await pool.query(
    `SELECT ip_address, COUNT(*) as count
     FROM waf_blocked_requests
     WHERE blocked_at > NOW() - INTERVAL '24 hours'
     GROUP BY ip_address ORDER BY count DESC LIMIT 5`
  )

  res.json({
    blocked_24h: parseInt(blocked24h.rows[0].total),
    active_ip_rules: parseInt(activeIpRules.rows[0].total),
    active_rate_rules: parseInt(activeRateRules.rows[0].total),
    top_blocked_ips: topBlocked.rows,
  })
})

initDB().then(() => {
  app.listen(PORT, () => console.log(`✓ WAF service on port ${PORT}`))
}).catch(err => {
  console.error('DB init failed:', err)
  process.exit(1)
})
