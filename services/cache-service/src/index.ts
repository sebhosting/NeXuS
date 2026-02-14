import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from 'redis'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7002

const redis = createClient({
  socket: { host: 'nexus-redis', port: 6379 },
  password: process.env.REDIS_PASSWORD,
})

redis.on('error', (err) => console.error('Redis error:', err))

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ service: 'cache-service', status: 'healthy' })
})

// Get cache stats
app.get('/stats', async (_req, res) => {
  const info = await redis.info('stats')
  const memory = await redis.info('memory')
  const keyspace = await redis.info('keyspace')
  
  const stats = {
    hits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0'),
    misses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0'),
    memory_used: memory.match(/used_memory_human:([^\r\n]+)/)?.[1],
    keys: parseInt(keyspace.match(/keys=(\d+)/)?.[1] || '0'),
  }
  
  res.json(stats)
})

// List keys (paginated)
app.get('/keys', async (req, res) => {
  const pattern = (req.query.pattern as string) || '*'
  const cursor = parseInt(req.query.cursor as string) || 0
  const count = parseInt(req.query.count as string) || 100

  const result = await redis.scan(cursor, { MATCH: pattern, COUNT: count })
  const keys = result.keys
  
  // Get TTLs for each key
  const keysWithTTL = await Promise.all(
    keys.map(async (key) => ({
      key,
      ttl: await redis.ttl(key),
      type: await redis.type(key),
    }))
  )

  res.json({ cursor: result.cursor, keys: keysWithTTL })
})

// Get a key
app.get('/key/:key', async (req, res) => {
  const { key } = req.params
  const type = await redis.type(key)
  
  let value: any
  if (type === 'string') value = await redis.get(key)
  else if (type === 'hash') value = await redis.hGetAll(key)
  else if (type === 'list') value = await redis.lRange(key, 0, -1)
  else if (type === 'set') value = await redis.sMembers(key)
  else value = null

  res.json({ key, type, value, ttl: await redis.ttl(key) })
})

// Set a key
app.post('/key', async (req, res) => {
  const { key, value, ttl } = req.body
  if (ttl) {
    await redis.set(key, value, { EX: ttl })
  } else {
    await redis.set(key, value)
  }
  res.json({ success: true, key })
})

// Delete a key
app.delete('/key/:key', async (req, res) => {
  const { key } = req.params
  await redis.del(key)
  res.json({ success: true, key })
})

// Flush all
app.post('/flush', async (_req, res) => {
  await redis.flushAll()
  res.json({ success: true, message: 'Cache flushed' })
})

redis.connect().then(() => {
  app.listen(PORT, () => console.log(`✓ Cache service on port ${PORT}`))
})

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-cache',
    version: '1.0.0',
    status: 'healthy',
    backend: 'redis',
    endpoints: {
      stats: 'GET /stats',
      keys: 'GET /keys?pattern=*&cursor=0',
      key: 'GET /key/:key, POST /key {key, value, ttl}, DELETE /key/:key',
      flush: 'POST /flush',
      health: 'GET /health'
    }
  })
})
