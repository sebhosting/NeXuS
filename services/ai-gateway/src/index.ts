import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const app = express()
const PORT = process.env.PORT || 5000
const SERVICE_NAME = 'ai-gateway'

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
    description: 'AI Gateway Service',
    status: 'operational',
    timestamp: new Date().toISOString()
  })
})

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'NeXuS ai-gateway',
    version: '1.0.0',
    description: 'AI Gateway Service',
    endpoints: ['/health', '/status']
  })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', service: SERVICE_NAME })
})

app.listen(PORT, () => {
  console.log(`\u2713 ai-gateway running on port ${PORT}`)
})

export default app
