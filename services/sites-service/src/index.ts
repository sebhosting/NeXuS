import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { Pool } from 'pg'
import Docker from 'dockerode'
import AdmZip from 'adm-zip'
import * as tar from 'tar-fs'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { execSync } from 'child_process'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7005
const UPLOAD_DIR = '/data/sites'
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

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

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }) // 100MB max

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

// ── TEMPLATES ─────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; description: string; hasDb: boolean; appImage: string | null; dbImage: string | null; appPort: number }> = {
  wordpress: { label: 'WordPress', description: 'Full WordPress CMS with dedicated MariaDB', hasDb: true, appImage: 'wordpress:latest', dbImage: 'mariadb:11', appPort: 80 },
  drupal: { label: 'Drupal', description: 'Drupal CMS with dedicated MariaDB', hasDb: true, appImage: 'drupal:latest', dbImage: 'mariadb:11', appPort: 80 },
  node: { label: 'Node.js', description: 'Node.js application from ZIP or Git', hasDb: false, appImage: null, dbImage: null, appPort: 3000 },
  vite: { label: 'Vite / Static', description: 'Static site served by Nginx', hasDb: false, appImage: 'nginx:alpine', dbImage: null, appPort: 80 },
}

// ── HELPER FUNCTIONS ──────────────────────────────────────

function traefikLabels(slug: string, port: number, domain?: string): Record<string, string> {
  const labels: Record<string, string> = {
    'traefik.enable': 'true',
    [`traefik.http.routers.site-${slug}.rule`]: `Host(\`${slug}.sebhosting.com\`)`,
    [`traefik.http.routers.site-${slug}.entrypoints`]: 'websecure',
    [`traefik.http.routers.site-${slug}.tls.certresolver`]: 'letsencrypt',
    [`traefik.http.services.site-${slug}.loadbalancer.server.port`]: String(port),
    'traefik.docker.network': 'traefik-public',
  }

  if (domain) {
    labels[`traefik.http.routers.site-${slug}-custom.rule`] = `Host(\`${domain}\`)`
    labels[`traefik.http.routers.site-${slug}-custom.entrypoints`] = 'websecure'
    labels[`traefik.http.routers.site-${slug}-custom.tls.certresolver`] = 'letsencrypt'
    labels[`traefik.http.routers.site-${slug}-custom.service`] = `site-${slug}`
  }

  return labels
}

async function pullImage(image: string): Promise<void> {
  const stream = await docker.pull(image)
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(stream, (err: any, _res: any) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function randomPassword(len: number = 24): string {
  return crypto.randomBytes(len).toString('base64url').slice(0, len)
}

async function ensureSiteNetwork(slug: string): Promise<string> {
  const networkName = `nexus-site-${slug}-net`
  try {
    const network = docker.getNetwork(networkName)
    await network.inspect()
    return networkName
  } catch {
    await docker.createNetwork({ Name: networkName, Driver: 'bridge' })
    return networkName
  }
}

// ── DATABASE INIT ─────────────────────────────────────────

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deployed_sites (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      type VARCHAR(50) NOT NULL,
      domain VARCHAR(255),
      status VARCHAR(50) DEFAULT 'creating',
      config JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_containers (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES deployed_sites(id) ON DELETE CASCADE,
      container_id VARCHAR(100),
      container_name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      image VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'created',
      port INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_deployments (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES deployed_sites(id) ON DELETE CASCADE,
      version VARCHAR(100),
      source VARCHAR(50),
      status VARCHAR(50) DEFAULT 'deploying',
      deploy_log TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `)
  console.log('Sites service schema ready')
}

// ── PROVISIONING (ASYNC) ─────────────────────────────────

async function provisionSite(site: any): Promise<void> {
  const { id, slug, type, domain, config } = site
  const template = TEMPLATES[type]
  if (!template) throw new Error(`Unknown template: ${type}`)

  if (type === 'wordpress' || type === 'drupal') {
    const dbUser = `site_${slug.replace(/-/g, '_')}`
    const dbPass = randomPassword()
    const dbName = `site_${slug.replace(/-/g, '_')}`
    const rootPass = randomPassword()

    // Store credentials in config
    const siteConfig = {
      ...config,
      dbUser,
      dbPass,
      dbName,
      dbRootPass: rootPass,
    }
    await pool.query(
      `UPDATE deployed_sites SET config = $2 WHERE id = $1`,
      [id, JSON.stringify(siteConfig)]
    )

    // Pull images
    await pullImage(template.appImage!)
    await pullImage(template.dbImage!)

    // Create site network
    const networkName = await ensureSiteNetwork(slug)

    // Create DB container
    const dbContainerName = `nexus-site-${slug}-db`
    const dbContainer = await docker.createContainer({
      Image: template.dbImage!,
      name: dbContainerName,
      Env: [
        `MARIADB_ROOT_PASSWORD=${rootPass}`,
        `MARIADB_DATABASE=${dbName}`,
        `MARIADB_USER=${dbUser}`,
        `MARIADB_PASSWORD=${dbPass}`,
      ],
      HostConfig: {
        Binds: [`nexus-site-${slug}-db:/var/lib/mysql`],
        RestartPolicy: { Name: 'unless-stopped' },
        NetworkMode: networkName,
      },
    })

    // Create app container
    const appContainerName = `nexus-site-${slug}`
    const appEnv: string[] = []

    if (type === 'wordpress') {
      appEnv.push(
        `WORDPRESS_DB_HOST=${dbContainerName}`,
        `WORDPRESS_DB_USER=${dbUser}`,
        `WORDPRESS_DB_PASSWORD=${dbPass}`,
        `WORDPRESS_DB_NAME=${dbName}`,
      )
    } else {
      // Drupal
      appEnv.push(
        `DRUPAL_DB_HOST=${dbContainerName}`,
        `DRUPAL_DB_USER=${dbUser}`,
        `DRUPAL_DB_PASSWORD=${dbPass}`,
        `DRUPAL_DB_NAME=${dbName}`,
      )
    }

    const appContainer = await docker.createContainer({
      Image: template.appImage!,
      name: appContainerName,
      Env: appEnv,
      Labels: traefikLabels(slug, template.appPort, domain),
      HostConfig: {
        Binds: [`nexus-site-${slug}-data:/var/www/html`],
        RestartPolicy: { Name: 'unless-stopped' },
        NetworkMode: networkName,
      },
    })

    // Connect app container to traefik-public network
    const traefikNetwork = docker.getNetwork('traefik-public')
    await traefikNetwork.connect({ Container: appContainer.id })

    // Start containers (DB first, then app)
    await dbContainer.start()
    await appContainer.start()

    // Insert container records
    await pool.query(
      `INSERT INTO site_containers (site_id, container_id, container_name, role, image, status, port) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, dbContainer.id, dbContainerName, 'db', template.dbImage, 'running', 3306]
    )
    await pool.query(
      `INSERT INTO site_containers (site_id, container_id, container_name, role, image, status, port) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, appContainer.id, appContainerName, 'app', template.appImage, 'running', template.appPort]
    )

    // Create deployment record
    await pool.query(
      `INSERT INTO site_deployments (site_id, version, source, status, completed_at) VALUES ($1, $2, $3, $4, NOW())`,
      [id, '1.0.0', 'template', 'deployed']
    )

    // Update site status
    await pool.query(
      `UPDATE deployed_sites SET status = 'running', updated_at = NOW() WHERE id = $1`,
      [id]
    )
  }
}

// ── ROUTES ────────────────────────────────────────────────

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-sites',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      health: 'GET /health',
      templates: 'GET /templates',
      sites: 'GET /sites, POST /sites',
      site: 'GET /sites/:id, PUT /sites/:id, DELETE /sites/:id',
      deploy: 'POST /sites/:id/deploy (multipart/form-data zip or JSON with git_url)',
      start: 'POST /sites/:id/start',
      stop: 'POST /sites/:id/stop',
      restart: 'POST /sites/:id/restart',
      logs: 'GET /sites/:id/logs?tail=200',
      status: 'GET /sites/:id/status',
    },
  })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ service: 'sites-service', status: 'healthy' })
})

// List available templates
app.get('/templates', (_req, res) => {
  res.json(TEMPLATES)
})

// ── CREATE SITE ───────────────────────────────────────────

app.post('/sites', async (req, res) => {
  try {
    const { name, slug, type, domain, config } = req.body

    if (!name || !slug || !type) {
      return res.status(400).json({ error: 'name, slug, and type are required' })
    }

    // Validate slug
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      return res.status(400).json({ error: 'Slug must be alphanumeric with hyphens, max 63 chars, must start and end with alphanumeric' })
    }

    if (!TEMPLATES[type]) {
      return res.status(400).json({ error: `Unknown type: ${type}. Valid types: ${Object.keys(TEMPLATES).join(', ')}` })
    }

    // Insert site record
    const result = await pool.query(
      `INSERT INTO deployed_sites (name, slug, type, domain, status, config) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        name,
        slug,
        type,
        domain || null,
        (type === 'wordpress' || type === 'drupal') ? 'creating' : 'stopped',
        JSON.stringify(config || {}),
      ]
    )
    const site = result.rows[0]

    if (type === 'wordpress' || type === 'drupal') {
      // Return immediately, provision in background
      res.status(201).json(site)

      provisionSite(site).catch(async (err) => {
        console.error(`Provisioning failed for site ${site.id}:`, err.message)
        await pool.query(
          `UPDATE deployed_sites SET status = 'error', config = config || $2, updated_at = NOW() WHERE id = $1`,
          [site.id, JSON.stringify({ error: err.message })]
        )
      })
    } else {
      // Node/Vite: no containers yet, deploy happens later
      res.status(201).json(site)
    }
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── LIST SITES ────────────────────────────────────────────

app.get('/sites', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        d.version AS latest_version,
        d.source AS latest_source,
        d.status AS deploy_status,
        d.created_at AS last_deployed
      FROM deployed_sites s
      LEFT JOIN LATERAL (
        SELECT version, source, status, created_at
        FROM site_deployments
        WHERE site_id = s.id
        ORDER BY created_at DESC LIMIT 1
      ) d ON true
      ORDER BY s.created_at DESC
    `)

    // Enrich with live Docker state
    const sites = await Promise.all(result.rows.map(async (site) => {
      const appContainerName = `nexus-site-${site.slug}`
      try {
        const container = docker.getContainer(appContainerName)
        const info = await container.inspect()
        return { ...site, docker_state: info.State.Status }
      } catch {
        return { ...site, docker_state: 'stopped' }
      }
    }))

    res.json(sites)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET SINGLE SITE ───────────────────────────────────────

app.get('/sites/:id', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const containers = await pool.query(
      'SELECT * FROM site_containers WHERE site_id = $1 ORDER BY role',
      [req.params.id]
    )
    const deployments = await pool.query(
      'SELECT * FROM site_deployments WHERE site_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.params.id]
    )

    res.json({
      ...site.rows[0],
      containers: containers.rows,
      deployments: deployments.rows,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── UPDATE SITE ───────────────────────────────────────────

app.put('/sites/:id', async (req, res) => {
  try {
    const { name, domain } = req.body
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const domainChanged = domain !== undefined && domain !== site.rows[0].domain

    await pool.query(
      `UPDATE deployed_sites SET
        name = COALESCE($2, name),
        domain = COALESCE($3, domain),
        updated_at = NOW()
      WHERE id = $1`,
      [req.params.id, name || null, domain !== undefined ? domain : null]
    )

    const updated = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])

    let notice: string | undefined
    if (domainChanged && site.rows[0].status === 'running') {
      notice = 'Domain updated in database. A restart is needed to apply the new domain to the running container (container labels cannot be changed after creation).'
    }

    res.json({ ...updated.rows[0], notice })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE SITE ───────────────────────────────────────────

app.delete('/sites/:id', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const s = site.rows[0]

    // Get all containers for this site
    const containers = await pool.query(
      'SELECT * FROM site_containers WHERE site_id = $1',
      [req.params.id]
    )

    // Stop and remove each container
    for (const c of containers.rows) {
      try {
        const container = docker.getContainer(c.container_id || c.container_name)
        try {
          await container.stop()
        } catch {
          // Already stopped or missing
        }
        try {
          await container.remove({ force: true })
        } catch {
          // Already removed
        }
      } catch {
        // Container not found, skip
      }
    }

    // Remove Docker volumes
    const volumeNames = [`nexus-site-${s.slug}-data`, `nexus-site-${s.slug}-db`]
    for (const volName of volumeNames) {
      try {
        const vol = docker.getVolume(volName)
        await vol.remove()
      } catch {
        // Volume doesn't exist or in use
      }
    }

    // Remove site network
    try {
      const network = docker.getNetwork(`nexus-site-${s.slug}-net`)
      await network.remove()
    } catch {
      // Network doesn't exist
    }

    // For Node.js/Vite sites, remove the built image
    if (s.type === 'node' || s.type === 'vite') {
      try {
        const image = docker.getImage(`nexus-site-${s.slug}:latest`)
        await image.remove({ force: true })
      } catch {
        // Image doesn't exist
      }
    }

    // Delete from database (cascades to site_containers and site_deployments)
    await pool.query('DELETE FROM deployed_sites WHERE id = $1', [req.params.id])

    // Clean up build directory
    const buildDir = path.join(UPLOAD_DIR, s.slug)
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true })
    }

    res.json({ success: true, message: `Site "${s.name}" and all associated resources deleted` })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── DEPLOY ────────────────────────────────────────────────

app.post('/sites/:id/deploy', upload.single('file'), async (req, res) => {
  try {
    const siteResult = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (siteResult.rows.length === 0) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Site not found' })
    }

    const site = siteResult.rows[0]
    const { type, slug, domain } = site
    const template = TEMPLATES[type]
    if (!template) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: `Unknown site type: ${type}` })
    }

    const version = req.body.version || new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const gitUrl = req.body.git_url

    // Create deployment record
    const dep = await pool.query(
      `INSERT INTO site_deployments (site_id, version, source, status) VALUES ($1, $2, $3, 'deploying') RETURNING id`,
      [req.params.id, version, req.file ? 'upload' : (gitUrl ? 'git' : 'redeploy')]
    )
    const depId = dep.rows[0].id

    try {
      // ── NODE.JS DEPLOY ──────────────────────────────────
      if (type === 'node') {
        const buildDir = path.join(UPLOAD_DIR, slug)

        if (req.file) {
          // Extract ZIP
          if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true })
          fs.mkdirSync(buildDir, { recursive: true })

          const zip = new AdmZip(req.file.path)
          zip.extractAllTo(buildDir, true)

          // If zip contained a single root folder, move contents up
          const entries = fs.readdirSync(buildDir)
          if (entries.length === 1 && fs.statSync(path.join(buildDir, entries[0])).isDirectory()) {
            const innerDir = path.join(buildDir, entries[0])
            const innerEntries = fs.readdirSync(innerDir)
            for (const entry of innerEntries) {
              fs.renameSync(path.join(innerDir, entry), path.join(buildDir, entry))
            }
            fs.rmSync(innerDir, { recursive: true, force: true })
          }

          // Clean up uploaded zip
          fs.unlinkSync(req.file.path)
        } else if (gitUrl) {
          // Git clone
          if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true })
          execSync(`git clone ${gitUrl} ${buildDir}`, { timeout: 120000 })
        } else {
          return res.status(400).json({ error: 'Node.js deploy requires a file upload or git_url' })
        }

        // Check if Dockerfile exists, generate one if not
        const dockerfilePath = path.join(buildDir, 'Dockerfile')
        if (!fs.existsSync(dockerfilePath)) {
          fs.writeFileSync(dockerfilePath, [
            'FROM node:20-alpine',
            'WORKDIR /app',
            'COPY package*.json ./',
            'RUN npm ci --production',
            'COPY . .',
            'EXPOSE 3000',
            'CMD ["npm", "start"]',
          ].join('\n') + '\n')
        }

        // Build Docker image
        const imageName = `nexus-site-${slug}:latest`
        const tarStream = tar.pack(buildDir)
        const buildStream = await docker.buildImage(tarStream, { t: imageName })
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(buildStream, (err: any, _res: any) => {
            if (err) reject(err)
            else resolve()
          })
        })

        // Stop and remove old app container if exists
        const appContainerName = `nexus-site-${slug}`
        try {
          const oldContainer = docker.getContainer(appContainerName)
          try { await oldContainer.stop() } catch { /* already stopped */ }
          try { await oldContainer.remove({ force: true }) } catch { /* already removed */ }
        } catch {
          // Container doesn't exist, fine
        }

        // Create new container
        const appContainer = await docker.createContainer({
          Image: imageName,
          name: appContainerName,
          Labels: traefikLabels(slug, template.appPort, domain),
          ExposedPorts: { [`${template.appPort}/tcp`]: {} },
          HostConfig: {
            RestartPolicy: { Name: 'unless-stopped' },
            NetworkMode: 'traefik-public',
          },
        })

        // Start container
        await appContainer.start()

        // Update/insert container record
        await pool.query('DELETE FROM site_containers WHERE site_id = $1 AND role = $2', [site.id, 'app'])
        await pool.query(
          `INSERT INTO site_containers (site_id, container_id, container_name, role, image, status, port) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [site.id, appContainer.id, appContainerName, 'app', imageName, 'running', template.appPort]
        )

        // Update deployment
        await pool.query(
          `UPDATE site_deployments SET status = 'deployed', completed_at = NOW() WHERE id = $1`,
          [depId]
        )

        // Update site status
        await pool.query(
          `UPDATE deployed_sites SET status = 'running', updated_at = NOW() WHERE id = $1`,
          [site.id]
        )

        res.json({ success: true, deployment_id: depId, version, image: imageName })

      // ── VITE/STATIC DEPLOY ──────────────────────────────
      } else if (type === 'vite') {
        if (!req.file) {
          return res.status(400).json({ error: 'Vite/static deploy requires a file upload (ZIP)' })
        }

        const buildDir = path.join(UPLOAD_DIR, slug)

        // Extract ZIP
        if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true })
        fs.mkdirSync(buildDir, { recursive: true })

        const zip = new AdmZip(req.file.path)
        zip.extractAllTo(buildDir, true)

        // If zip contained a single root folder, move contents up
        const entries = fs.readdirSync(buildDir)
        if (entries.length === 1 && fs.statSync(path.join(buildDir, entries[0])).isDirectory()) {
          const innerDir = path.join(buildDir, entries[0])
          const innerEntries = fs.readdirSync(innerDir)
          for (const entry of innerEntries) {
            fs.renameSync(path.join(innerDir, entry), path.join(buildDir, entry))
          }
          fs.rmSync(innerDir, { recursive: true, force: true })
        }

        // Clean up uploaded zip
        fs.unlinkSync(req.file.path)

        // Build a Docker image with the static files baked in
        const dockerfilePath = path.join(buildDir, 'Dockerfile')
        fs.writeFileSync(dockerfilePath, 'FROM nginx:alpine\nCOPY . /usr/share/nginx/html\n')

        const imageName = `nexus-site-${slug}:latest`
        const tarStream = tar.pack(buildDir)
        const buildStream = await docker.buildImage(tarStream, { t: imageName })
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(buildStream, (err: any, _res: any) => {
            if (err) reject(err)
            else resolve()
          })
        })

        // Stop and remove old container if exists
        const appContainerName = `nexus-site-${slug}`
        try {
          const oldContainer = docker.getContainer(appContainerName)
          try { await oldContainer.stop() } catch { /* already stopped */ }
          try { await oldContainer.remove({ force: true }) } catch { /* already removed */ }
        } catch {
          // Container doesn't exist
        }

        // Create nginx container from built image
        const appContainer = await docker.createContainer({
          Image: imageName,
          name: appContainerName,
          Labels: traefikLabels(slug, 80, domain),
          ExposedPorts: { '80/tcp': {} },
          HostConfig: {
            RestartPolicy: { Name: 'unless-stopped' },
            NetworkMode: 'traefik-public',
          },
        })

        // Start container
        await appContainer.start()

        // Update/insert container record
        await pool.query('DELETE FROM site_containers WHERE site_id = $1 AND role = $2', [site.id, 'app'])
        await pool.query(
          `INSERT INTO site_containers (site_id, container_id, container_name, role, image, status, port) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [site.id, appContainer.id, appContainerName, 'app', imageName, 'running', 80]
        )

        // Update deployment
        await pool.query(
          `UPDATE site_deployments SET status = 'deployed', completed_at = NOW() WHERE id = $1`,
          [depId]
        )

        // Update site status
        await pool.query(
          `UPDATE deployed_sites SET status = 'running', updated_at = NOW() WHERE id = $1`,
          [site.id]
        )

        res.json({ success: true, deployment_id: depId, version, image: imageName })

      // ── WORDPRESS/DRUPAL REDEPLOY ───────────────────────
      } else if (type === 'wordpress' || type === 'drupal') {
        // Pull latest image
        await pullImage(template.appImage!)

        // Get config (DB credentials)
        const siteConfig = site.config || {}
        const { dbUser, dbPass, dbName } = siteConfig

        if (!dbUser || !dbPass || !dbName) {
          return res.status(400).json({ error: 'Site config missing database credentials. Was the site provisioned correctly?' })
        }

        // Stop and remove old app container (keep DB running!)
        const appContainerName = `nexus-site-${slug}`
        const dbContainerName = `nexus-site-${slug}-db`
        try {
          const oldContainer = docker.getContainer(appContainerName)
          try { await oldContainer.stop() } catch { /* already stopped */ }
          try { await oldContainer.remove({ force: true }) } catch { /* already removed */ }
        } catch {
          // Container doesn't exist
        }

        // Ensure the site network exists
        const networkName = await ensureSiteNetwork(slug)

        // Recreate app container with same env/labels
        const appEnv: string[] = []
        if (type === 'wordpress') {
          appEnv.push(
            `WORDPRESS_DB_HOST=${dbContainerName}`,
            `WORDPRESS_DB_USER=${dbUser}`,
            `WORDPRESS_DB_PASSWORD=${dbPass}`,
            `WORDPRESS_DB_NAME=${dbName}`,
          )
        } else {
          appEnv.push(
            `DRUPAL_DB_HOST=${dbContainerName}`,
            `DRUPAL_DB_USER=${dbUser}`,
            `DRUPAL_DB_PASSWORD=${dbPass}`,
            `DRUPAL_DB_NAME=${dbName}`,
          )
        }

        const appContainer = await docker.createContainer({
          Image: template.appImage!,
          name: appContainerName,
          Env: appEnv,
          Labels: traefikLabels(slug, template.appPort, domain),
          HostConfig: {
            Binds: [`nexus-site-${slug}-data:/var/www/html`],
            RestartPolicy: { Name: 'unless-stopped' },
            NetworkMode: networkName,
          },
        })

        // Connect to traefik-public network
        const traefikNetwork = docker.getNetwork('traefik-public')
        await traefikNetwork.connect({ Container: appContainer.id })

        // Start container
        await appContainer.start()

        // Update container record
        await pool.query('DELETE FROM site_containers WHERE site_id = $1 AND role = $2', [site.id, 'app'])
        await pool.query(
          `INSERT INTO site_containers (site_id, container_id, container_name, role, image, status, port) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [site.id, appContainer.id, appContainerName, 'app', template.appImage, 'running', template.appPort]
        )

        // Update deployment
        await pool.query(
          `UPDATE site_deployments SET status = 'deployed', completed_at = NOW() WHERE id = $1`,
          [depId]
        )

        // Update site status
        await pool.query(
          `UPDATE deployed_sites SET status = 'running', updated_at = NOW() WHERE id = $1`,
          [site.id]
        )

        res.json({ success: true, deployment_id: depId, version, image: template.appImage })

      } else {
        res.status(400).json({ error: `Deploy not supported for type: ${type}` })
      }

    } catch (deployErr: any) {
      // Mark deployment as failed
      await pool.query(
        `UPDATE site_deployments SET status = 'failed', deploy_log = $2, completed_at = NOW() WHERE id = $1`,
        [depId, deployErr.message]
      )
      await pool.query(
        `UPDATE deployed_sites SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [site.id]
      )
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      res.status(500).json({ error: 'Deploy failed: ' + deployErr.message, deployment_id: depId })
    }
  } catch (err: any) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    res.status(500).json({ error: err.message })
  }
})

// ── START SITE ────────────────────────────────────────────

app.post('/sites/:id/start', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const containers = await pool.query(
      'SELECT * FROM site_containers WHERE site_id = $1 ORDER BY role',
      [req.params.id]
    )

    if (containers.rows.length === 0) {
      return res.status(400).json({ error: 'No containers found for this site. Deploy first.' })
    }

    // Start DB container first if it exists
    const dbContainer = containers.rows.find((c: any) => c.role === 'db')
    if (dbContainer) {
      try {
        const container = docker.getContainer(dbContainer.container_id || dbContainer.container_name)
        await container.start()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [dbContainer.id, 'running'])
      } catch (err: any) {
        if (!err.message?.includes('already started')) {
          throw err
        }
      }
    }

    // Then start app container
    const appContainer = containers.rows.find((c: any) => c.role === 'app')
    if (appContainer) {
      try {
        const container = docker.getContainer(appContainer.container_id || appContainer.container_name)
        await container.start()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [appContainer.id, 'running'])
      } catch (err: any) {
        if (!err.message?.includes('already started')) {
          throw err
        }
      }
    }

    await pool.query('UPDATE deployed_sites SET status = $2, updated_at = NOW() WHERE id = $1', [req.params.id, 'running'])
    res.json({ success: true, message: 'Site started' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── STOP SITE ─────────────────────────────────────────────

app.post('/sites/:id/stop', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const containers = await pool.query(
      'SELECT * FROM site_containers WHERE site_id = $1 ORDER BY role DESC',
      [req.params.id]
    )

    // Stop app container first, then DB
    const appContainer = containers.rows.find((c: any) => c.role === 'app')
    if (appContainer) {
      try {
        const container = docker.getContainer(appContainer.container_id || appContainer.container_name)
        await container.stop()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [appContainer.id, 'stopped'])
      } catch (err: any) {
        if (!err.message?.includes('already stopped') && !err.message?.includes('is not running')) {
          throw err
        }
      }
    }

    const dbContainer = containers.rows.find((c: any) => c.role === 'db')
    if (dbContainer) {
      try {
        const container = docker.getContainer(dbContainer.container_id || dbContainer.container_name)
        await container.stop()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [dbContainer.id, 'stopped'])
      } catch (err: any) {
        if (!err.message?.includes('already stopped') && !err.message?.includes('is not running')) {
          throw err
        }
      }
    }

    await pool.query('UPDATE deployed_sites SET status = $2, updated_at = NOW() WHERE id = $1', [req.params.id, 'stopped'])
    res.json({ success: true, message: 'Site stopped' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── RESTART SITE ──────────────────────────────────────────

app.post('/sites/:id/restart', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const containers = await pool.query(
      'SELECT * FROM site_containers WHERE site_id = $1 ORDER BY role',
      [req.params.id]
    )

    if (containers.rows.length === 0) {
      return res.status(400).json({ error: 'No containers found for this site. Deploy first.' })
    }

    // Stop all containers (app first, then DB)
    const appContainer = containers.rows.find((c: any) => c.role === 'app')
    const dbContainer = containers.rows.find((c: any) => c.role === 'db')

    if (appContainer) {
      try {
        const container = docker.getContainer(appContainer.container_id || appContainer.container_name)
        await container.stop()
      } catch {
        // Already stopped
      }
    }
    if (dbContainer) {
      try {
        const container = docker.getContainer(dbContainer.container_id || dbContainer.container_name)
        await container.stop()
      } catch {
        // Already stopped
      }
    }

    // Start all containers (DB first, then app)
    if (dbContainer) {
      try {
        const container = docker.getContainer(dbContainer.container_id || dbContainer.container_name)
        await container.start()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [dbContainer.id, 'running'])
      } catch (err: any) {
        if (!err.message?.includes('already started')) throw err
      }
    }
    if (appContainer) {
      try {
        const container = docker.getContainer(appContainer.container_id || appContainer.container_name)
        await container.start()
        await pool.query('UPDATE site_containers SET status = $2 WHERE id = $1', [appContainer.id, 'running'])
      } catch (err: any) {
        if (!err.message?.includes('already started')) throw err
      }
    }

    await pool.query('UPDATE deployed_sites SET status = $2, updated_at = NOW() WHERE id = $1', [req.params.id, 'running'])
    res.json({ success: true, message: 'Site restarted' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── SITE LOGS ─────────────────────────────────────────────

app.get('/sites/:id/logs', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    const tail = parseInt(req.query.tail as string) || 200

    // Get app container
    const containerResult = await pool.query(
      `SELECT * FROM site_containers WHERE site_id = $1 AND role = 'app' LIMIT 1`,
      [req.params.id]
    )

    if (containerResult.rows.length === 0) {
      return res.status(400).json({ error: 'No app container found for this site' })
    }

    const c = containerResult.rows[0]
    const container = docker.getContainer(c.container_id || c.container_name)

    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      follow: false,
    })

    // Docker log stream returns Buffer with 8-byte header per frame
    // Convert to string, stripping the header bytes
    const logStr = logStream.toString('utf8')

    res.type('text/plain').send(logStr)
  } catch (err: any) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found. Is the site deployed?' })
    }
    res.status(500).json({ error: err.message })
  }
})

// ── SITE STATUS ───────────────────────────────────────────

app.get('/sites/:id/status', async (req, res) => {
  try {
    const site = await pool.query('SELECT * FROM deployed_sites WHERE id = $1', [req.params.id])
    if (site.rows.length === 0) return res.status(404).json({ error: 'Site not found' })

    // Get app container
    const containerResult = await pool.query(
      `SELECT * FROM site_containers WHERE site_id = $1 AND role = 'app' LIMIT 1`,
      [req.params.id]
    )

    if (containerResult.rows.length === 0) {
      return res.json({
        state: 'no_container',
        cpu_percent: 0,
        memory_mb: 0,
        memory_limit_mb: 0,
      })
    }

    const c = containerResult.rows[0]
    const container = docker.getContainer(c.container_id || c.container_name)

    let state = 'stopped'
    let cpuPercent = 0
    let memoryMb = 0
    let memoryLimitMb = 0

    try {
      const info = await container.inspect()
      state = info.State.Status

      if (state === 'running') {
        const stats: any = await container.stats({ stream: false })

        // Calculate CPU percentage
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
        const numCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1

        if (systemDelta > 0 && cpuDelta > 0) {
          cpuPercent = Math.round((cpuDelta / systemDelta) * numCpus * 100 * 100) / 100
        }

        // Calculate memory
        memoryMb = Math.round((stats.memory_stats.usage || 0) / 1024 / 1024 * 100) / 100
        memoryLimitMb = Math.round((stats.memory_stats.limit || 0) / 1024 / 1024 * 100) / 100
      }
    } catch (err: any) {
      if (err.statusCode === 404) {
        state = 'not_found'
      } else {
        throw err
      }
    }

    res.json({
      state,
      cpu_percent: cpuPercent,
      memory_mb: memoryMb,
      memory_limit_mb: memoryLimitMb,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── START SERVER ──────────────────────────────────────────

initDB().then(() => {
  app.listen(PORT, () => console.log(`Sites service on port ${PORT}`))
})
