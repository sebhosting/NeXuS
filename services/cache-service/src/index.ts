import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const app = express()
const PORT = process.env.PORT || 7002
const SERVICE_NAME = 'cache-service'

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    status: 'healthy',
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

// Status endpoint
app.get('/status', (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    version: '1.0.0',
    description: 'Cache Management Service',
    status: 'operational',
    timestamp: new Date().toISOString()
  })
})

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'NeXuS cache-service',
    version: '1.0.0',
    description: 'Cache Management Service',
    endpoints: ['/health', '/status']
  })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', service: SERVICE_NAME })
})

app.listen(PORT, () => {
  console.log(`\u2713 cache-service running on port ${PORT}`)
})

export default app
