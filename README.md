<p align="center">
  <h1 align="center">NeXuS</h1>
  <p align="center">
    <strong>Self-hosted infrastructure management platform with 11 microservices, AI integration, and Docker site deployment</strong>
  </p>
  <p align="center">
    <a href="https://nexus-docs.sebhosting.com">Documentation</a> &bull;
    <a href="#live-demo">Live Demo</a> &bull;
    <a href="#quick-start">Quick Start</a> &bull;
    <a href="#architecture">Architecture</a> &bull;
    <a href="#services">Services</a> &bull;
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

## Live Demo

Try NeXuS without installing anything:

**[https://nexus.sebhosting.com](https://nexus.sebhosting.com)**

Register for a **free 7-day trial** with full read+write access to all features. No credit card required.

> **Note:** The demo runs on a shared instance. Please be respectful of other users' data.

---

## Architecture

```
                         ┌──────────────────────┐
                         │   Cloudflare / DNS   │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │       Traefik        │
                         │   Reverse Proxy      │
                         │   Let's Encrypt TLS  │
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
- `traefik-public` — external, Traefik-routed, TLS-terminated
- `nexus-internal` — isolated bridge, databases only, no external access

---

## Services

### Application Services

| Service | Port | Subdomain | Stack | Description |
|---------|------|-----------|-------|-------------|
| **Frontend** | 3000 | `nexus.your_domain.com` | Next.js 16, React 19 | Dashboard with 14 management pages |
| **API Gateway** | 4000 | `api.your_domain.com` | Express 5 | Docker stats, container monitoring, system metrics |
| **Auth** | 6000 | `auth.your_domain.com` | Express 5, JWT, bcrypt | Registration, login, refresh tokens, user management |
| **CMS** | 7000 | `cms.your_domain.com` | Express 5, MongoDB | Headless CMS — pages and posts with CRUD |
| **CDN** | 7001 | `cdn.your_domain.com` | Express 5, Multer | File uploads, static asset hosting, storage stats |
| **Cache** | 7002 | `cache.your_domain.com` | Express 5, Redis | Key-value management, flush, TTL, hit/miss stats |
| **WAF** | 7003 | `waf.your_domain.com` | Express 5, PostgreSQL | IP rules, rate limiting, blocked request logging |
| **Backup** | 7004 | `backup.your_domain.com` | Express 5, pg_dump, mongodump | Scheduled backups for PostgreSQL, MongoDB, Redis, CDN |
| **Sites** | 7005 | `sites-api.your_domain.com` | Express 5, Dockerode | Deploy WordPress, Drupal, Node.js, Vite via Docker |
| **AI Gateway** | 5000 | `ai-gateway.your_domain.com` | Express 5 | Anthropic API proxy with usage tracking and config |
| **MCP Server** | 5001 | `mcp.your_domain.com` | MCP SDK, Express | Claude Code infrastructure management tools |

### Databases

| Database | Image | Port | Purpose |
|----------|-------|------|---------|
| **PostgreSQL** | `postgres:16-alpine` | 5432 | Auth, WAF, CDN, AI, Backup, Sites metadata |
| **MongoDB** | `mongo:7` | 27017 | CMS content (pages, posts) |
| **Redis** | `redis:7-alpine` | 6379 | Sessions, caching, rate limiting |
| **Memcached** | `memcached:alpine` | 11211 | High-performance object cache |

### Monitoring

| Tool | Subdomain | Purpose |
|------|-----------|---------|
| **Prometheus** | `prometheus.your_domain.com` | Metrics scraping (15s interval) from all services |
| **Grafana** | `grafana.your_domain.com` | Dashboards for containers, APIs, databases, cache |

---

## Dashboard

14 management pages with full CRUD, real-time stats, and a dark-themed UI:

| Page | What it does |
|------|-------------|
| **Dashboard** | System overview — container health, CPU, memory, load average |
| **Sites** | Deploy WordPress, Drupal, Node.js, or Vite sites as Docker containers |
| **CMS** | Pages & posts management with publish/draft and markdown content |
| **CDN** | File upload, storage stats, file browser with preview |
| **DNS** | Cloudflare DNS record management (A, AAAA, CNAME, MX, TXT) |
| **Auth** | User management, role assignment, pending approvals, sessions |
| **WAF** | IP block/allow rules, rate limits, blocked request log |
| **Cache** | Redis key browser, set/get/delete, flush, hit ratio stats |
| **Services** | Health monitoring for all services with live status indicators |
| **AI Gateway** | AI API usage stats, request history, model configuration |
| **Backups** | Manual/scheduled backups, restore, cron scheduling |
| **MCP Server** | Claude MCP tool browser and testing |
| **Settings** | Service health dashboard, user profile, security settings |
| **Grafana** | Metrics dashboards (external link) |

---

## Site Deployment

The Sites service is a **Docker-based site deployment platform**. It creates and manages containers via the Docker socket, with Traefik handling automatic TLS and routing.

### Supported Site Types

| Type | What gets created | Image |
|------|-------------------|-------|
| **WordPress** | App container + dedicated MariaDB | `wordpress:latest` + `mariadb:11` |
| **Drupal** | App container + dedicated MariaDB | `drupal:latest` + `mariadb:11` |
| **Node.js** | Built from your code (ZIP or git clone) | Auto-generated Dockerfile |
| **Vite / Static** | Nginx serving your static files | `nginx:alpine` |

### How it works

1. Create site from dashboard (pick type, name, slug)
2. NeXuS pulls images, creates containers, sets up networking
3. Traefik auto-issues TLS certificate via Let's Encrypt
4. Site live at `{slug}.your_domain.com`

Each site gets its own containers, volumes, and network — fully isolated. Start, stop, restart, view logs, redeploy, and delete from the dashboard.

---

## MCP Integration

NeXuS includes a **Model Context Protocol server** that gives Claude Code direct access to your infrastructure.

### Setup

Add to your Claude Code MCP config:

```json
{
  "nexus-mcp": {
    "url": "https://mcp.your_domain.com/mcp",
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

Ask Claude Code: *"Check if all NeXuS services are healthy"* and it will use `nexus_health_check` to ping every service and report status.

---

## Quick Start

### Prerequisites

- Docker 29+ with Docker Compose
- A domain with DNS control (for Traefik TLS)
- Traefik running on the host (external `traefik-public` network)

### 1. Clone

```bash
git clone https://github.com/sebhosting/NeXuS.git
cd NeXuS
```

### 2. Configure

```bash
cp .env.example infrastructure/docker/.env
nano infrastructure/docker/.env
```

Required variables:

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

### 3. Update domains

Find and replace `your_domain.com` with your actual domain in `infrastructure/docker/docker-compose.yml`.

### 4. Deploy

```bash
cd infrastructure/docker
docker compose up -d --build
```

### 5. DNS

Point these A records to your server IP:

```
nexus.your_domain.com         → your-server-ip
api.your_domain.com           → your-server-ip
auth.your_domain.com          → your-server-ip
cms.your_domain.com           → your-server-ip
cdn.your_domain.com           → your-server-ip
cache.your_domain.com         → your-server-ip
waf.your_domain.com           → your-server-ip
ai-gateway.your_domain.com    → your-server-ip
backup.your_domain.com        → your-server-ip
sites-api.your_domain.com     → your-server-ip
grafana.your_domain.com       → your-server-ip
prometheus.your_domain.com    → your-server-ip
mcp.your_domain.com           → your-server-ip
*.your_domain.com             → your-server-ip  (wildcard for deployed sites)
```

### 6. First Login

Navigate to `https://nexus.your_domain.com`. The first registered user automatically becomes **admin**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, TailwindCSS 4 |
| **Backend** | Express 5, TypeScript 5, Node.js 25 |
| **Databases** | PostgreSQL 16, MongoDB 7, Redis 7, Memcached |
| **Auth** | JWT (access + refresh), bcrypt, httpOnly cookies |
| **Container Mgmt** | Dockerode (Docker Engine API) |
| **Reverse Proxy** | Traefik with Let's Encrypt |
| **Monitoring** | Prometheus + Grafana |
| **AI** | Anthropic Claude API, Model Context Protocol |
| **Infrastructure** | Docker Compose, Cloudflare DNS |

---

## Security

- **JWT Authentication** — Access tokens (15min) + refresh tokens (7 days) with rotation
- **Password Hashing** — bcrypt with 12 salt rounds
- **Rate Limiting** — 20 requests / 15 minutes on auth endpoints
- **WAF** — IP block/allow rules, rate limiting per path, blocked request logging
- **Network Isolation** — Databases on internal-only Docker network
- **CORS** — Strict origin whitelist
- **httpOnly Cookies** — Refresh tokens stored as secure httpOnly cookies
- **RBAC** — Admin and viewer roles, first user auto-promoted to admin
- **Non-root containers** — All services run as unprivileged `node` user
- **Docker healthchecks** — Every service has a built-in health endpoint

---

## Common Commands

```bash
# Start everything
cd infrastructure/docker && docker compose up -d --build

# Rebuild a single service
docker compose build --no-cache auth-service && docker compose up -d auth-service

# View logs
docker compose logs -f sites-service

# Check all container status
docker compose ps

# Stop everything
docker compose down

# Full rebuild (no cache)
docker compose down && docker compose build --no-cache && docker compose up -d
```

---

## Documentation

Full documentation available at **[nexus-docs.sebhosting.com](https://nexus-docs.sebhosting.com)**.

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
  Built by <strong><a href="https://sebhosting.com">SEB Hosting</a></strong><br/>
  Powered by Docker, TypeScript, Next.js, Express, PostgreSQL, MongoDB, Redis, Traefik, Prometheus, Grafana, and Claude AI
</p>
