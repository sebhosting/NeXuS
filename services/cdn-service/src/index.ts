import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      domain VARCHAR(255),
      deploy_path VARCHAR(500) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deployments (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      version VARCHAR(50),
      status VARCHAR(20) DEFAULT 'pending',
      file_count INTEGER,
      total_size BIGINT,
      deployed_by VARCHAR(100),
      deploy_log TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
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

// ── STATS ─────────────────────────────────────────────────

app.get('/stats', async (_req, res) => {
  try {
    const total = await pool.query(
      'SELECT COUNT(*) as total_files, COALESCE(SUM(size_bytes), 0) as total_size FROM cdn_files'
    )
    const byType = await pool.query(
      `SELECT mime_type, COUNT(*)::integer as count, COALESCE(SUM(size_bytes), 0)::bigint as size_bytes
       FROM cdn_files GROUP BY mime_type ORDER BY count DESC`
    )
    res.json({
      total_files: parseInt(total.rows[0].total_files),
      total_size_bytes: parseInt(total.rows[0].total_size),
      by_mime_type: byType.rows,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── SITES ──────────────────────────────────────────────────

app.get('/sites', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.version as latest_version, d.status as deploy_status, d.created_at as last_deployed
      FROM sites s
      LEFT JOIN LATERAL (
        SELECT version, status, created_at FROM deployments WHERE site_id = s.id ORDER BY created_at DESC LIMIT 1
      ) d ON true
      ORDER BY s.created_at DESC
    `)
    res.json(result.rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/sites', async (req, res) => {
  try {
    const { name, slug, domain } = req.body
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' })
    const deployPath = path.join(UPLOAD_DIR, 'sites', slug)
    fs.mkdirSync(deployPath, { recursive: true })
    const result = await pool.query(
      'INSERT INTO sites (name, slug, domain, deploy_path) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, slug, domain || null, deployPath]
    )
    res.json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: err.message })
  }
})

app.get('/sites/:id', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })
    const deployments = await pool.query(
      'SELECT * FROM deployments WHERE site_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    )
    res.json({ ...site.rows[0], deployments: deployments.rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/sites/:id', async (req, res) => {
  try {
    const { name, domain, status } = req.body
    await pool.query(
      'UPDATE sites SET name=COALESCE($2,name), domain=COALESCE($3,domain), status=COALESCE($4,status), updated_at=NOW() WHERE id=$1',
      [req.params.id, name || null, domain || null, status || null]
    )
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/sites/:id', async (req, res) => {
  try {
    const site = await pool.query('DELETE FROM sites WHERE id = $1 RETURNING slug', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })
    const sitePath = path.join(UPLOAD_DIR, 'sites', site.rows[0].slug)
    if (fs.existsSync(sitePath)) fs.rmSync(sitePath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/sites/:id/deploy', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No zip file uploaded' })
    const site = await pool.query('SELECT * FROM sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const s = site.rows[0]
    const version = req.body.version || new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')

    // Create deployment record
    const dep = await pool.query(
      `INSERT INTO deployments (site_id, version, status, deployed_by) VALUES ($1, $2, 'deploying', $3) RETURNING id`,
      [req.params.id, version, req.body.deployed_by || 'admin']
    )
    const depId = dep.rows[0].id

    try {
      // Extract zip to site directory
      const sitePath = path.join(UPLOAD_DIR, 'sites', s.slug)
      if (fs.existsSync(sitePath)) fs.rmSync(sitePath, { recursive: true, force: true })
      fs.mkdirSync(sitePath, { recursive: true })

      const zip = new AdmZip(req.file.path)
      zip.extractAllTo(sitePath, true)

      // If zip contained a single root folder, move contents up
      const entries = fs.readdirSync(sitePath)
      if (entries.length === 1 && fs.statSync(path.join(sitePath, entries[0])).isDirectory()) {
        const innerDir = path.join(sitePath, entries[0])
        const innerEntries = fs.readdirSync(innerDir)
        for (const entry of innerEntries) {
          fs.renameSync(path.join(innerDir, entry), path.join(sitePath, entry))
        }
        fs.rmSync(innerDir, { recursive: true, force: true })
      }

      // Count files and size
      let fileCount = 0, totalSize = 0
      const countFiles = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isFile()) {
            fileCount++
            totalSize += fs.statSync(path.join(dir, entry.name)).size
          } else if (entry.isDirectory()) {
            countFiles(path.join(dir, entry.name))
          }
        }
      }
      countFiles(sitePath)

      // Update deployment as live
      await pool.query(
        `UPDATE deployments SET status='live', file_count=$2, total_size=$3, completed_at=NOW() WHERE id=$1`,
        [depId, fileCount, totalSize]
      )
      // Mark old deployments as not live
      await pool.query(
        `UPDATE deployments SET status='completed' WHERE site_id=$1 AND id != $2 AND status='live'`,
        [req.params.id, depId]
      )
      await pool.query(`UPDATE sites SET status='active', updated_at=NOW() WHERE id=$1`, [req.params.id])

      // Clean up uploaded zip
      fs.unlinkSync(req.file.path)

      res.json({ success: true, deployment_id: depId, file_count: fileCount, total_size: totalSize })
    } catch (deployErr: any) {
      await pool.query(
        `UPDATE deployments SET status='failed', deploy_log=$2, completed_at=NOW() WHERE id=$1`,
        [depId, deployErr.message]
      )
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      res.status(500).json({ error: 'Deploy failed: ' + deployErr.message })
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/sites/:id/deployments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deployments WHERE site_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/sites/:id/rollback/:deploymentId', async (req, res) => {
  try {
    const dep = await pool.query(
      'SELECT d.*, s.slug FROM deployments d JOIN sites s ON s.id = d.site_id WHERE d.id = $1 AND d.site_id = $2',
      [req.params.deploymentId, req.params.id]
    )
    if (dep.rows.length === 0) return res.status(404).json({ error: 'Deployment not found' })
    // Mark this deployment as live, others as completed
    await pool.query(`UPDATE deployments SET status='completed' WHERE site_id=$1 AND status='live'`, [req.params.id])
    await pool.query(`UPDATE deployments SET status='live' WHERE id=$1`, [req.params.deploymentId])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Serve static site files
app.use('/sites/:slug', (req, res, next) => {
  const sitePath = path.join(UPLOAD_DIR, 'sites', req.params.slug)
  if (!fs.existsSync(sitePath)) return res.status(404).json({ error: 'Site not found' })
  const filePath = path.join(sitePath, req.path || 'index.html')
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath)
  }
  // SPA fallback
  const indexPath = path.join(sitePath, 'index.html')
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath)
  res.status(404).json({ error: 'File not found' })
})

initDB().then(() => {
  app.listen(PORT, () => console.log(`✓ CDN service on port ${PORT}`))
})

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-cdn',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      upload: 'POST /upload (multipart/form-data)',
      files: 'GET /files (list), GET /files/:filename (download), DELETE /files/:id',
      stats: 'GET /stats',
      sites: 'GET /sites, POST /sites, GET /sites/:id, PUT /sites/:id, DELETE /sites/:id',
      deploy: 'POST /sites/:id/deploy (multipart/form-data zip)',
      deployments: 'GET /sites/:id/deployments',
      rollback: 'POST /sites/:id/rollback/:deploymentId',
      static: 'GET /sites/:slug/* (serve site files)',
      health: 'GET /health'
    }
  })
})
