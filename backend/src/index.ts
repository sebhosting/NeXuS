import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { execSync } from 'child_process'
import * as fs from 'fs'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({
  origin: [
    'https://nexus.sebhosting.com',
    'http://localhost:3000'
  ],
  credentials: true,
}))
app.use(express.json())

// ── ROOT ──────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ service: 'nexus-api', status: 'running', endpoints: ['/health', '/stats', '/stats/logs/:name'] })
})

// ── HEALTH ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ service: 'api', status: 'healthy', port: PORT, uptime: process.uptime() })
})

// ── DOCKER STATS ──────────────────────────────────────────────
app.get('/stats', (_req, res) => {
  try {
    // Get all containers
    const psRaw = execSync(
      `docker ps -a --format '{"id":"{{.ID}}","name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","ports":"{{.Ports}}"}'`,
      { encoding: 'utf8' }
    ).trim()

    const containers = psRaw.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)

    // Get resource stats (non-streaming)
    let statsMap: Record<string, any> = {}
    try {
      const statsRaw = execSync(
        `docker stats --no-stream --format '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}","net":"{{.NetIO}}","block":"{{.BlockIO}}"}'`,
        { encoding: 'utf8' }
      ).trim()

      statsRaw.split('\n').filter(Boolean).forEach(line => {
        try {
          const s = JSON.parse(line)
          statsMap[s.name] = s
        } catch {}
      })
    } catch {}

    // System info
    let dockerInfo: any = {}
    try {
      const infoRaw = execSync(
        `docker info --format '{"containers":"{{.Containers}}","running":"{{.ContainersRunning}}","paused":"{{.ContainersPaused}}","stopped":"{{.ContainersStopped}}","images":"{{.Images}}","serverVersion":"{{.ServerVersion}}"}'`,
        { encoding: 'utf8' }
      ).trim()
      dockerInfo = JSON.parse(infoRaw)
    } catch {}

    // Merge containers with their stats
    const enriched = containers.map((c: any) => ({
      ...c,
      cpu:     statsMap[c.name]?.cpu     || '—',
      mem:     statsMap[c.name]?.mem     || '—',
      memPerc: statsMap[c.name]?.memPerc || '—',
      net:     statsMap[c.name]?.net     || '—',
      block:   statsMap[c.name]?.block   || '—',
    }))

    // Host stats
    let hostStats = {}
    try {
      const loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim().split(' ')
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8')
      const memTotal = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || '0') * 1024
      const memFree  = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || '0') * 1024
      const memUsed  = memTotal - memFree

      hostStats = {
        load1:   parseFloat(loadavg[0]),
        load5:   parseFloat(loadavg[1]),
        load15:  parseFloat(loadavg[2]),
        memTotal,
        memUsed,
        memFree,
        memPercent: Math.round((memUsed / memTotal) * 100),
      }
    } catch {}

    res.json({
      timestamp: new Date().toISOString(),
      docker: dockerInfo,
      containers: enriched,
      host: hostStats,
      total:   containers.length,
      running: containers.filter((c: any) => c.state === 'running').length,
      stopped: containers.filter((c: any) => c.state !== 'running').length,
    })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get Docker stats', detail: err.message })
  }
})

// ── CONTAINER LOGS ────────────────────────────────────────────
app.get('/stats/logs/:name', (req, res) => {
  try {
    const { name } = req.params
    const lines = req.query.lines || 50
    // Sanitize container name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid container name' })
    }
    const logs = execSync(`docker logs ${name} --tail ${lines} 2>&1`, { encoding: 'utf8' })
    res.json({ container: name, logs: logs.split('\n') })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get logs', detail: err.message })
  }
})

app.listen(PORT, () => console.log(`✓ API service on port ${PORT}`))
