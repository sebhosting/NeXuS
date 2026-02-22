<p align="center">
  <h1 align="center">NeXuS</h1>
  <p align="center">
    <strong>Self-hosted infrastructure platform with 11 microservices, AI integration, and Docker site deployment</strong>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> &bull;
    <a href="#architecture">Architecture</a> &bull;
    <a href="#services">Services</a> &bull;
    <a href="#dashboard">Dashboard</a> &bull;
    <a href="#site-deployment">Site Deployment</a> &bull;
    <a href="#mcp-integration">MCP Integration</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Claude-MCP%20Ready-cc785c" alt="Claude MCP" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
  </p>
</p>

---

## What is NeXuS?

NeXuS is a **production-grade, self-hosted infrastructure management platform**. It runs 11 microservices behind Traefik with automated TLS, provides a unified dashboard for managing everything from content to DNS to container deployments, and includes a Claude MCP server for AI-powered infrastructure management.

**Not a toy project.** This runs in production. Every service has a real backend, real database, and a real management dashboard.

---

## Architecture

```
                         ┌──────────────────────┐
                         │   Cloudflare / DNS    │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │       Traefik         │
                         │   Reverse Proxy       │
                         │   Let's Encrypt TLS   │
                         └──────────┬───────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │            traefik-public network                 │
          │                                                   │
   ┌──────┴──────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
   │  Frontend   │  │   API    │  │   Auth   │  │   MCP    │  │
   │  Next.js    │  │ Gateway  │  │ Service  │  │  Server  │  │
   │   :3000     │  │  :4000   │  │  :6000   │  │  :5001   │  │
   └─────────────┘  └──────────┘  └──────────┘  └──────────┘  │
                                                              │
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
   │   CMS    │  │   CDN    │  │  Cache   │  │   WAF    │     │
   │  :7000   │  │  :7001   │  │  :7002   │  │  :7003   │     │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
                                                              │
   ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
   │  Backup  │  │  Sites   │  │    AI    │                   │
   │  :7004   │  │  :7005   │  │ Gateway  │                   │
   └──────────┘  └──────────┘  │  :5000   │                   │
                               └──────────┘                   │
   ┌──────────┐  ┌──────────┐                                 │
   │Prometheus│  │ Grafana  │                                 │
   │  :9090   │  │  :3000   │                                 │
   └──────────┘  └──────────┘                                 │
          │                                                   │
          └───────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────┐
          │            nexus-internal network              │
          │                                                │
   ┌──────┴──────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
   │ PostgreSQL  │  │  Redis   │  │ MongoDB  │  │Memcache│ │
   │  16-alpine  │  │ 7-alpine │  │   7      │  │ alpine │ │
   └─────────────┘  └──────────┘  └──────────┘  └────────┘ │
          │                                                │
          └────────────────────────────────────────────────┘
```

**Two isolated networks:**
- `traefik-public` -- external, Traefik-routed, TLS-terminated
- `nexus-internal` -- isolated bridge, databases only, no external access

---

## Services

### Application Services

| Service | Port | Domain | Stack | Description |
|---------|------|--------|-------|-------------|
| **Frontend** | 3000 | `nexus.sebhosting.com` | Next.js 16, React 19 | Dashboard with 14 management pages |
| **API Gateway** | 4000 | `api.sebhosting.com` | Express 5 | Docker stats, container monitoring, system metrics |
| **Auth** | 6000 | `auth.sebhosting.com` | Express 5, JWT, bcrypt | Registration, login, refresh tokens, user management |
| **CMS** | 7000 | `cms.sebhosting.com` | Express 5, MongoDB | Headless CMS -- pages and posts with CRUD |
| **CDN** | 7001 | `cdn.sebhosting.com` | Express 5, Multer | File uploads, static asset hosting, storage stats |
| **Cache** | 7002 | `cache.sebhosting.com` | Express 5, Redis | Key-value management, flush, TTL, hit/miss stats |
| **WAF** | 7003 | `waf.sebhosting.com` | Express 5, PostgreSQL | IP rules, rate limiting, blocked request logging |
| **Backup** | 7004 | `backup.sebhosting.com` | Express 5, pg_dump, mongodump | Scheduled backups for PostgreSQL, MongoDB, Redis, CDN |
| **Sites** | 7005 | `sites-api.sebhosting.com` | Express 5, Dockerode | Deploy WordPress, Drupal, Node.js, Vite as Docker containers |
| **AI Gateway** | 5000 | `ai-gateway.sebhosting.com` | Express 5 | Anthropic API proxy with usage tracking and config |
| **MCP Server** | 5001 | `mcp.sebhosting.com` | MCP SDK, Express | 50+ tools for Claude Code infrastructure management |

### Databases

| Database | Image | Port | Purpose |
|----------|-------|------|---------|
| **PostgreSQL** | `postgres:16-alpine` | 5432 | Auth, WAF, CDN, AI, Backup, Sites metadata |
| **MongoDB** | `mongo:7` | 27017 | CMS content (pages, posts) |
| **Redis** | `redis:7-alpine` | 6379 | Sessions, caching, rate limiting |
| **Memcached** | `memcached:alpine` | 11211 | High-performance object cache |

### Monitoring

| Tool | Domain | Purpose |
|------|--------|---------|
| **Prometheus** | `prometheus.sebhosting.com` | Metrics scraping (15s interval) from all services |
| **Grafana** | `grafana.sebhosting.com` | Dashboards -- containers, APIs, databases, cache |

---

## Dashboard

The frontend provides **14 management pages**, each with full CRUD, real-time stats, and a consistent dark-themed UI.

### Navigation

```
NAVIGATION          MANAGE              SETTINGS
  Dashboard           CMS                 Settings
  Services            CDN
  DNS                 Cache             EXTERNAL
  MCP Server          Auth                Grafana
                      WAF                 Prometheus
                      AI Gateway          Traefik
                      Backups
                      Sites
```

### Pages

| Page | What it does |
|------|-------------|
| **Dashboard** | System overview, container health, resource usage |
| **Services** | Health monitoring for all 11+ services with status LEDs |
| **DNS** | Cloudflare DNS record management (CRUD) |
| **MCP Server** | Claude MCP tool browser and testing |
| **CMS** | Pages & Posts management with publish/draft, markdown content |
| **CDN** | File upload, storage stats, file browser with preview |
| **Cache** | Redis key browser, set/get/delete, flush, hit ratio stats |
| **Auth** | User management, role assignment, session viewer, password change |
| **WAF** | IP block/allow rules, rate limits, blocked request log |
| **AI Gateway** | Usage stats, request history, model configuration |
| **Backups** | Manual/scheduled backups, restore, retention policies |
| **Sites** | Docker site deployment -- WordPress, Drupal, Node.js, Vite |
| **Settings** | Service health, user profile, system info |
| **Grafana** | Metrics dashboards (external link) |

---

## Site Deployment

The Sites service is a **Docker-based site deployment platform**. It creates and manages Docker containers via the Docker socket, with Traefik handling automatic TLS and routing.

### Supported Site Types

| Type | What gets created | Image |
|------|-------------------|-------|
| **WordPress** | App container + dedicated MariaDB | `wordpress:latest` + `mariadb:11` |
| **Drupal** | App container + dedicated MariaDB | `drupal:latest` + `mariadb:11` |
| **Node.js** | Built from your code (ZIP or git clone) | Auto-generated or your Dockerfile |
| **Vite / Static** | Nginx serving your static files | `nginx:alpine` |

### How it works

```
1. Create site (pick type, name, slug, optional custom domain)
          │
2. For WordPress/Drupal:
   ├── Pull images (wordpress + mariadb)
   ├── Create private bridge network
   ├── Create MariaDB container with generated credentials
   ├── Create app container with Traefik labels
   └── Site available at {slug}.sebhosting.com

3. For Node.js:
   ├── Upload ZIP or provide git URL
   ├── Auto-detect or generate Dockerfile
   ├── Build Docker image from your code
   ├── Create container with Traefik labels
   └── App running at {slug}.sebhosting.com

4. For Vite/Static:
   ├── Upload ZIP of built files
   ├── Build nginx image with files baked in
   ├── Create container with Traefik labels
   └── Site served at {slug}.sebhosting.com
```

### Management

From the dashboard you can **start**, **stop**, **restart**, **view logs**, **redeploy**, and **delete** any site. Each site gets its own containers, volumes, and network -- fully isolated.

### DNS

Set up a **wildcard DNS record** (`*.sebhosting.com`) to avoid adding A records per site. Traefik handles TLS certificates automatically via Let's Encrypt.

---

## MCP Integration

NeXuS includes a **Model Context Protocol server** that gives Claude Code direct access to your infrastructure.

### Setup

Add to your Claude Code MCP config:

```json
{
  "nexus-mcp": {
    "url": "https://mcp.sebhosting.com/mcp",
    "headers": {
      "cf-access-client-id": "your-service-token-id",
      "cf-access-client-secret": "your-service-token-secret"
    }
  }
}
```

### Available Tools

| Category | Tools |
|----------|-------|
| **System** | `nexus_system_overview`, `nexus_health_check` |
| **Containers** | `nexus_list_containers`, `nexus_container_stats`, `nexus_restart_container`, `nexus_stop_container` |
| **DNS** | `nexus_list_dns`, `nexus_create_dns`, `nexus_update_dns`, `nexus_delete_dns` |
| **Cache** | `nexus_cache_stats`, `nexus_cache_get`, `nexus_cache_set`, `nexus_cache_flush` |
| **CMS** | `nexus_list_pages`, `nexus_create_page`, `nexus_update_page`, `nexus_delete_page` |

### Example

Ask Claude Code: *"Check if all NeXuS services are healthy"* and it will use `nexus_health_check` to ping every service and report status.

---

## Quick Start

### Prerequisites

- Docker 29+ with Docker Compose
- A domain with DNS control (for Traefik TLS)
- Traefik running on the host (external `traefik-public` network)

### 1. Clone

```bash
git clone https://github.com/yourusername/nexus.git
cd nexus
```

### 2. Configure

```bash
cp .env.example infrastructure/docker/.env
nano infrastructure/docker/.env
```

Required environment variables:

```env
# Databases
POSTGRES_PASSWORD=your-secure-password
MONGODB_PASSWORD=your-secure-password
REDIS_PASSWORD=your-secure-password

# Auth
JWT_SECRET=your-jwt-secret-minimum-32-characters

# Grafana
GRAFANA_PASSWORD=your-grafana-password

# AI (optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Deploy

```bash
cd infrastructure/docker
docker compose up -d --build
```

### 4. DNS

Point these A records to your server:

```
nexus.sebhosting.com        → your-server-ip
api.sebhosting.com          → your-server-ip
auth.sebhosting.com         → your-server-ip
cms.sebhosting.com          → your-server-ip
cdn.sebhosting.com          → your-server-ip
cache.sebhosting.com        → your-server-ip
waf.sebhosting.com          → your-server-ip
ai-gateway.sebhosting.com   → your-server-ip
backup.sebhosting.com       → your-server-ip
sites-api.sebhosting.com    → your-server-ip
grafana.sebhosting.com      → your-server-ip
prometheus.sebhosting.com   → your-server-ip
mcp.sebhosting.com          → your-server-ip
*.sebhosting.com            → your-server-ip  (wildcard for deployed sites)
```

### 5. First Login

Navigate to `https://nexus.sebhosting.com`. The first registered user automatically becomes **admin**.

---

## Project Structure

```
nexus/
├── frontend/                    # Next.js 16 dashboard
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── ai/             # AI Gateway management
│   │   │   ├── auth/           # User & session management
│   │   │   ├── backups/        # Backup & restore
│   │   │   ├── cache/          # Redis key browser
│   │   │   ├── cdn/            # File uploads & storage
│   │   │   ├── cms/            # Pages & posts editor
│   │   │   ├── dns/            # DNS record management
│   │   │   ├── grafana/        # Metrics dashboards
│   │   │   ├── mcp/            # MCP tool browser
│   │   │   ├── services/       # Service health monitor
│   │   │   ├── settings/       # System settings
│   │   │   ├── sites/          # Docker site deployer
│   │   │   └── waf/            # Firewall rules & logs
│   │   └── login/              # Authentication
│   ├── components/
│   │   └── Sidebar.tsx         # Navigation sidebar
│   └── lib/
│       └── AuthContext.tsx      # JWT auth context
│
├── backend/                     # API Gateway (Express 5)
│   └── src/index.ts            # Docker stats, health, metrics
│
├── services/
│   ├── auth-service/           # JWT, bcrypt, refresh tokens, RBAC
│   ├── cms-service/            # MongoDB CRUD for pages & posts
│   ├── cdn-service/            # File storage, static site hosting
│   ├── cache-service/          # Redis management API
│   ├── waf-service/            # IP rules, rate limits, block log
│   ├── ai-gateway/             # Anthropic proxy, usage tracking
│   ├── backup-service/         # pg_dump, mongodump, cron scheduling
│   ├── sites-service/          # Docker container orchestration
│   └── mcp-server/             # Claude MCP tool server
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml  # All 17 containers defined here
│   │   └── .env                # Environment secrets
│   ├── prometheus/
│   │   └── prometheus.yml      # Scrape configs for all services
│   └── grafana/
│       └── dashboards/         # Pre-configured dashboards
│
├── .env.example                # Environment template
├── package.json                # Monorepo workspace config
├── Makefile                    # Build automation
└── tsconfig.json               # TypeScript config
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, TailwindCSS 4 |
| **Backend** | Express 5, TypeScript, Node.js 25 |
| **Databases** | PostgreSQL 16, MongoDB 7, Redis 7, Memcached |
| **Auth** | JWT (access + refresh), bcrypt, httpOnly cookies |
| **Container Mgmt** | Dockerode (Docker Engine API) |
| **Reverse Proxy** | Traefik with Let's Encrypt |
| **Monitoring** | Prometheus + Grafana |
| **AI** | Anthropic Claude API, Model Context Protocol |
| **Infrastructure** | Docker Compose, Cloudflare DNS |

---

## Security

- **JWT Authentication** -- Access tokens (15min) + refresh tokens (7 days) with rotation
- **Password Hashing** -- bcrypt with 12 salt rounds
- **Rate Limiting** -- 20 requests / 15 minutes on auth endpoints
- **WAF** -- IP block/allow rules, rate limiting per path, blocked request logging
- **Network Isolation** -- Databases on internal-only Docker network
- **CORS** -- Strict origin whitelist
- **httpOnly Cookies** -- Refresh tokens stored as secure httpOnly cookies
- **RBAC** -- Admin and viewer roles, first user auto-promoted to admin

---

## Monitoring

### Prometheus

Scrapes metrics from all services every 15 seconds:

```yaml
scrape_configs:
  - job_name: 'nexus-api'        # port 4000
  - job_name: 'nexus-frontend'   # port 3000
  - job_name: 'nexus-auth'       # port 6000
  - job_name: 'nexus-cms'        # port 7000
  - job_name: 'nexus-cdn'        # port 7001
  - job_name: 'nexus-cache'      # port 7002
  - job_name: 'nexus-waf'        # port 7003
  - job_name: 'nexus-ai'         # port 5000
  - job_name: 'nexus-mcp'        # port 5001
```

### Grafana

Login at `https://grafana.sebhosting.com` with `admin` / your `GRAFANA_PASSWORD`.

Pre-configured dashboards for container resources, API metrics, database performance, and cache hit rates.

---

## Common Commands

```bash
# Start everything
cd infrastructure/docker && docker compose up -d --build

# Rebuild a single service
docker compose up -d --build auth-service

# View logs
docker compose logs -f sites-service

# Check all container status
docker compose ps

# Stop everything
docker compose down

# Full rebuild
docker compose down && docker compose up -d --build
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/something`)
3. Commit your changes
4. Push and open a Pull Request

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <strong>SEB</strong><br/>
  Powered by Docker, TypeScript, Next.js, Express, PostgreSQL, MongoDB, Redis, Traefik, Prometheus, Grafana, and Claude AI
</p>
