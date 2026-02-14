import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7001
const UPLOAD_DIR = '/data/cdn'

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'nexus-postgres',
  port: 5432,
  user: 'seb',
  password: process.env.POSTGRES_PASSWORD,
  database: 'nexus',
})

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB max

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cdn_files (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100),
      size_bytes BIGINT,
      uploaded_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('✓ CDN schema ready')
}

app.get('/health', (_req, res) => {
  res.json({ service: 'cdn-service', status: 'healthy' })
})

// Upload file
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const result = await pool.query(
    `INSERT INTO cdn_files (filename, original_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
  )

  res.json({
    id: result.rows[0].id,
    filename: req.file.filename,
    url: `https://cdn.sebhosting.com/files/${req.file.filename}`,
  })
})

// List files
app.get('/files', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, filename, original_name, mime_type, size_bytes, uploaded_at 
     FROM cdn_files ORDER BY uploaded_at DESC LIMIT 100`
  )
  res.json(result.rows)
})

// Serve file
app.get('/files/:filename', (req, res) => {
  const filepath = path.join(UPLOAD_DIR, req.params.filename)
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' })
  res.sendFile(filepath)
})

// Delete file
app.delete('/files/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM cdn_files WHERE id = $1 RETURNING filename`,
    [req.params.id]
  )
  if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' })

  const filepath = path.join(UPLOAD_DIR, result.rows[0].filename)
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)

  res.json({ success: true })
})

initDB().then(() => {
  app.listen(PORT, () => console.log(`✓ CDN service on port ${PORT}`))
})
