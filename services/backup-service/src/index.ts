import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { Pool } from 'pg'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import cron from 'node-cron'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7004
const BACKUP_DIR = '/data/backups'

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

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
    CREATE TABLE IF NOT EXISTS backups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      size_bytes BIGINT,
      file_path VARCHAR(500),
      trigger VARCHAR(20) NOT NULL DEFAULT 'manual',
      schedule_id INTEGER,
      error TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS backup_schedules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      cron_expression VARCHAR(100) NOT NULL,
      retention_days INTEGER DEFAULT 30,
      enabled BOOLEAN DEFAULT true,
      last_run TIMESTAMP,
      next_run TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `)
  console.log('✓ Backup schema ready')
}

// ── Backup execution ───────────────────────────────────────

function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 600000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size
  } catch { return 0 }
}

async function runBackup(type: string, backupId: number) {
  const timestamp = new Date().toISOString().replace(/[T:]/g, '-').slice(0, 19)
  let filePath = ''

  await pool.query(`UPDATE backups SET status='running', started_at=NOW() WHERE id=$1`, [backupId])

  try {
    switch (type) {
      case 'postgres': {
        filePath = path.join(BACKUP_DIR, `pg_${timestamp}.dump`)
        const pgPass = process.env.POSTGRES_PASSWORD || ''
        await execAsync(`PGPASSWORD='${pgPass}' pg_dump -h nexus-postgres -U seb -d nexus -Fc -f ${filePath}`)
        break
      }
      case 'mongodb': {
        filePath = path.join(BACKUP_DIR, `mongo_${timestamp}.archive`)
        const mongoPass = process.env.MONGODB_PASSWORD || ''
        await execAsync(
          `mongodump --host=nexus-mongodb --port=27017 --username=seb --password='${mongoPass}' --authenticationDatabase=admin --db=nexus --archive=${filePath}`
        )
        break
      }
      case 'redis': {
        filePath = path.join(BACKUP_DIR, `redis_${timestamp}.rdb`)
        const redisPass = process.env.REDIS_PASSWORD || ''
        await execAsync(`redis-cli -h nexus-redis -a '${redisPass}' --no-auth-warning BGSAVE`)
        // Wait for save to complete
        await new Promise(r => setTimeout(r, 3000))
        await execAsync(`cp /data/redis/dump.rdb ${filePath}`)
        break
      }
      case 'cdn': {
        filePath = path.join(BACKUP_DIR, `cdn_${timestamp}.tar.gz`)
        await execAsync(`tar -czf ${filePath} -C /data/cdn .`)
        break
      }
      case 'full': {
        filePath = path.join(BACKUP_DIR, `full_${timestamp}`)
        fs.mkdirSync(filePath, { recursive: true })

        const pgPass = process.env.POSTGRES_PASSWORD || ''
        const mongoPass = process.env.MONGODB_PASSWORD || ''
        const redisPass = process.env.REDIS_PASSWORD || ''

        // PostgreSQL
        await execAsync(`PGPASSWORD='${pgPass}' pg_dump -h nexus-postgres -U seb -d nexus -Fc -f ${filePath}/postgres.dump`)
        // MongoDB
        await execAsync(
          `mongodump --host=nexus-mongodb --port=27017 --username=seb --password='${mongoPass}' --authenticationDatabase=admin --db=nexus --archive=${filePath}/mongodb.archive`
        )
        // Redis
        await execAsync(`redis-cli -h nexus-redis -a '${redisPass}' --no-auth-warning BGSAVE`)
        await new Promise(r => setTimeout(r, 3000))
        await execAsync(`cp /data/redis/dump.rdb ${filePath}/redis.rdb`)
        // CDN
        await execAsync(`tar -czf ${filePath}/cdn.tar.gz -C /data/cdn .`)

        // Archive everything
        const archivePath = `${filePath}.tar.gz`
        await execAsync(`tar -czf ${archivePath} -C ${BACKUP_DIR} ${path.basename(filePath)}`)
        fs.rmSync(filePath, { recursive: true, force: true })
        filePath = archivePath
        break
      }
      default:
        throw new Error(`Unknown backup type: ${type}`)
    }

    const size = getFileSize(filePath)
    await pool.query(
      `UPDATE backups SET status='completed', file_path=$2, size_bytes=$3, completed_at=NOW() WHERE id=$1`,
      [backupId, filePath, size]
    )
  } catch (err: any) {
    await pool.query(
      `UPDATE backups SET status='failed', error=$2, completed_at=NOW() WHERE id=$1`,
      [backupId, err.message]
    )
  }
}

// ── Scheduled jobs ─────────────────────────────────────────

const cronJobs = new Map<number, cron.ScheduledTask>()

async function loadSchedules() {
  const result = await pool.query('SELECT * FROM backup_schedules WHERE enabled = true')
  for (const schedule of result.rows) {
    registerCronJob(schedule)
  }
  console.log(`✓ Loaded ${result.rows.length} backup schedules`)
}

function registerCronJob(schedule: any) {
  if (cronJobs.has(schedule.id)) {
    cronJobs.get(schedule.id)!.stop()
  }
  if (!cron.validate(schedule.cron_expression)) {
    console.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cron_expression}`)
    return
  }
  const task = cron.schedule(schedule.cron_expression, async () => {
    const name = `${schedule.name} (scheduled)`
    const result = await pool.query(
      `INSERT INTO backups (name, type, trigger, schedule_id) VALUES ($1, $2, 'scheduled', $3) RETURNING id`,
      [name, schedule.type, schedule.id]
    )
    await pool.query(`UPDATE backup_schedules SET last_run=NOW() WHERE id=$1`, [schedule.id])
    runBackup(schedule.type, result.rows[0].id)
  })
  cronJobs.set(schedule.id, task)
}

// ── Routes ─────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ service: 'backup-service', status: 'healthy', port: PORT })
})

// List backups
app.get('/backups', async (req, res) => {
  try {
    const type = req.query.type as string
    const status = req.query.status as string
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    let where = 'WHERE 1=1'
    const params: any[] = []
    if (type) { params.push(type); where += ` AND type=$${params.length}` }
    if (status) { params.push(status); where += ` AND status=$${params.length}` }
    params.push(limit); const limitIdx = params.length
    params.push(offset); const offsetIdx = params.length

    const result = await pool.query(
      `SELECT * FROM backups ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )
    res.json(result.rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Trigger manual backup
app.post('/backups', async (req, res) => {
  try {
    const { type, name } = req.body
    if (!type || !['postgres', 'mongodb', 'redis', 'cdn', 'full'].includes(type)) {
      return res.status(400).json({ error: 'type must be postgres, mongodb, redis, cdn, or full' })
    }
    const backupName = name || `Manual ${type} backup`
    const result = await pool.query(
      `INSERT INTO backups (name, type, trigger) VALUES ($1, $2, 'manual') RETURNING *`,
      [backupName, type]
    )
    const backup = result.rows[0]

    // Run backup in background (don't await)
    runBackup(type, backup.id)

    res.json(backup)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get backup details
app.get('/backups/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backups WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Backup not found' })
    res.json(result.rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Delete backup
app.delete('/backups/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM backups WHERE id = $1 RETURNING file_path', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Backup not found' })
    const filePath = result.rows[0].file_path
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Restore from backup
app.post('/backups/:id/restore', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backups WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Backup not found' })
    const backup = result.rows[0]
    if (backup.status !== 'completed') return res.status(400).json({ error: 'Can only restore completed backups' })
    if (!backup.file_path || !fs.existsSync(backup.file_path)) {
      return res.status(400).json({ error: 'Backup file not found' })
    }

    const pgPass = process.env.POSTGRES_PASSWORD || ''
    const mongoPass = process.env.MONGODB_PASSWORD || ''

    switch (backup.type) {
      case 'postgres':
        await execAsync(`PGPASSWORD='${pgPass}' pg_restore -h nexus-postgres -U seb -d nexus --clean --if-exists ${backup.file_path}`)
        break
      case 'mongodb':
        await execAsync(
          `mongorestore --host=nexus-mongodb --port=27017 --username=seb --password='${mongoPass}' --authenticationDatabase=admin --db=nexus --archive=${backup.file_path} --drop`
        )
        break
      case 'redis': {
        const redisPass = process.env.REDIS_PASSWORD || ''
        await execAsync(`redis-cli -h nexus-redis -a '${redisPass}' --no-auth-warning SHUTDOWN NOSAVE || true`)
        await execAsync(`cp ${backup.file_path} /data/redis/dump.rdb`)
        // Redis will restart via Docker's restart policy
        break
      }
      case 'cdn':
        await execAsync(`tar -xzf ${backup.file_path} -C /data/cdn`)
        break
      default:
        return res.status(400).json({ error: 'Restore not supported for this backup type. For full backups, restore individual components.' })
    }

    res.json({ success: true, message: `Restored ${backup.type} from backup #${backup.id}` })
  } catch (err: any) {
    res.status(500).json({ error: 'Restore failed: ' + err.message })
  }
})

// ── Schedules ──────────────────────────────────────────────

app.get('/schedules', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM backup_schedules ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/schedules', async (req, res) => {
  try {
    const { name, type, cron_expression, retention_days = 30 } = req.body
    if (!name || !type || !cron_expression) {
      return res.status(400).json({ error: 'name, type, and cron_expression required' })
    }
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({ error: 'Invalid cron expression' })
    }
    const result = await pool.query(
      `INSERT INTO backup_schedules (name, type, cron_expression, retention_days) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, type, cron_expression, retention_days]
    )
    registerCronJob(result.rows[0])
    res.json(result.rows[0])
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/schedules/:id', async (req, res) => {
  try {
    const { name, type, cron_expression, retention_days } = req.body
    if (cron_expression && !cron.validate(cron_expression)) {
      return res.status(400).json({ error: 'Invalid cron expression' })
    }
    await pool.query(
      `UPDATE backup_schedules SET
        name=COALESCE($2,name), type=COALESCE($3,type),
        cron_expression=COALESCE($4,cron_expression), retention_days=COALESCE($5,retention_days)
       WHERE id=$1`,
      [req.params.id, name || null, type || null, cron_expression || null, retention_days || null]
    )
    // Reload cron job
    const result = await pool.query('SELECT * FROM backup_schedules WHERE id=$1', [req.params.id])
    if (result.rows.length > 0 && result.rows[0].enabled) {
      registerCronJob(result.rows[0])
    }
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/schedules/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (cronJobs.has(id)) {
      cronJobs.get(id)!.stop()
      cronJobs.delete(id)
    }
    await pool.query('DELETE FROM backup_schedules WHERE id=$1', [req.params.id])
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/schedules/:id/toggle', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE backup_schedules SET enabled = NOT enabled WHERE id=$1 RETURNING *',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Schedule not found' })
    const schedule = result.rows[0]
    const id = parseInt(req.params.id)
    if (schedule.enabled) {
      registerCronJob(schedule)
    } else if (cronJobs.has(id)) {
      cronJobs.get(id)!.stop()
      cronJobs.delete(id)
    }
    res.json(schedule)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Stats ──────────────────────────────────────────────────

app.get('/stats', async (_req, res) => {
  try {
    const total = await pool.query('SELECT COUNT(*)::integer as count, COALESCE(SUM(size_bytes),0)::bigint as total_size FROM backups')
    const byType = await pool.query(
      `SELECT type, MAX(completed_at) as last_backup
       FROM backups WHERE status='completed' GROUP BY type`
    )
    const nextScheduled = await pool.query(
      `SELECT name, type, cron_expression FROM backup_schedules WHERE enabled=true ORDER BY created_at LIMIT 1`
    )
    res.json({
      total_backups: total.rows[0].count,
      total_size_bytes: parseInt(total.rows[0].total_size),
      last_by_type: byType.rows,
      next_scheduled: nextScheduled.rows[0] || null,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── Cleanup old backups ────────────────────────────────────

async function cleanupOldBackups() {
  try {
    const schedules = await pool.query('SELECT id, retention_days FROM backup_schedules WHERE retention_days > 0')
    for (const s of schedules.rows) {
      const old = await pool.query(
        `DELETE FROM backups WHERE schedule_id=$1 AND created_at < NOW() - ($2 || ' days')::interval RETURNING file_path`,
        [s.id, s.retention_days]
      )
      for (const row of old.rows) {
        if (row.file_path && fs.existsSync(row.file_path)) {
          fs.unlinkSync(row.file_path)
        }
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err)
  }
}

// Run cleanup daily at 3 AM
cron.schedule('0 3 * * *', cleanupOldBackups)

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-backup',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      backups: 'GET /backups, POST /backups, GET /backups/:id, DELETE /backups/:id',
      restore: 'POST /backups/:id/restore',
      schedules: 'GET /schedules, POST /schedules, PUT /schedules/:id, DELETE /schedules/:id',
      toggle: 'POST /schedules/:id/toggle',
      stats: 'GET /stats',
      health: 'GET /health',
    },
  })
})

initDB().then(async () => {
  await loadSchedules()
  app.listen(PORT, () => console.log(`✓ Backup service on port ${PORT}`))
}).catch(err => {
  console.error('Backup service init failed:', err)
  process.exit(1)
})
