import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth'
import { db } from './db'

dotenv.config({ quiet: true })

const app = express()
const PORT = process.env.AUTH_PORT || 6000

app.use(cors({
  origin: [
    'https://nexus.sebhosting.com',
    'http://localhost:3000'
  ],
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// Rate limit auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many attempts, try again later' }
})

app.get('/', (_req, res) => {
  res.json({ service: 'nexus-auth', status: 'running', endpoints: ['/health', '/auth/*'] })
})

app.use('/auth', authLimiter, authRouter)

app.get('/health', (_req, res) => {
  res.json({ service: 'auth-service', status: 'healthy', port: PORT })
})

// Init DB then start
db.initSchema().then(() => {
  app.listen(PORT, () => console.log(`✓ Auth service on port ${PORT}`))
}).catch(err => {
  console.error('DB init failed:', err)
  process.exit(1)
})

// Root route  
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-auth',
    version: '1.0.0',
    status: 'healthy',
    auth: 'jwt',
    endpoints: {
      login: 'POST /auth/login {email, password}',
      register: 'POST /auth/register {email, password}',
      refresh: 'POST /auth/refresh {refreshToken}',
      logout: 'POST /auth/logout',
      health: 'GET /health'
    }
  })
})
