# NeXuS 🚀

> **The ultimate cloud-native infrastructure management platform**
> Self-hosted, production-ready, battle-tested microservices architecture

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude MCP](https://img.shields.io/badge/Claude-MCP%20Ready-orange)](https://modelcontextprotocol.io/)

---

## What is NeXuS?

NeXuS is a **production-grade infrastructure platform** that brings enterprise-level capabilities to your self-hosted environment. Built with modern microservices architecture, it provides everything you need to run scalable web applications with observability, security, and AI integration built-in.

### Key Features

- **🔐 Zero-Trust Security** — JWT auth, WAF, rate limiting, Cloudflare integration
- **⚡ Lightning Fast** — Redis + Memcached multi-tier caching
- **📊 Full Observability** — Prometheus metrics + Grafana dashboards
- **🤖 AI-Native** — Built-in AI gateway with Claude MCP server
- **🎯 Production Ready** — Docker Compose orchestration, health checks, automated SSL
- **🌐 CDN-Backed** — Cloudflare integration for global edge delivery
- **📝 CMS Included** — Headless CMS with MongoDB backend
- **🔄 Auto-Scaling** — Ready for Kubernetes deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                        │
│                  (SSL, WAF, DDoS)                        │
└────────────────────┬────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │   Traefik   │ ← Reverse Proxy
              └─────┬───────┘
       ┌────────────┼────────────┐
       │            │            │
  ┌────▼───┐  ┌────▼────┐  ┌────▼────┐
  │Frontend│  │   API   │  │  Auth   │
  │ Next.js│  │ Express │  │ Service │
  └────────┘  └────┬────┘  └────┬────┘
                   │            │
       ┌───────────┼────────────┼───────────┐
       │           │            │           │
  ┌────▼────┐ ┌───▼───┐   ┌────▼────┐ ┌───▼────┐
  │PostgreSQL│ │ Redis │   │ MongoDB │ │Memcached│
  └─────────┘ └───────┘   └─────────┘ └────────┘
```

### Core Services

| Service | Purpose | Port | URL |
|---------|---------|------|-----|
| **Frontend** | Next.js web app | 3000 | https://nexus.sebhosting.com |
| **API Gateway** | Main REST API, Docker stats | 4000 | https://api.sebhosting.com |
| **Auth Service** | JWT authentication | 6000 | https://auth.sebhosting.com |
| **CMS Service** | Headless content management | 7000 | https://cms.sebhosting.com |
| **CDN Service** | Static asset delivery | 7001 | https://cdn.sebhosting.com |
| **Cache Service** | Distributed caching layer | 7002 | https://cache.sebhosting.com |
| **WAF Service** | Web application firewall | 7003 | https://waf.sebhosting.com |
| **AI Gateway** | Claude API integration | 5000 | https://ai-gateway.sebhosting.com |
| **MCP Server** | Claude Code integration | 5001 | https://mcp.sebhosting.com |
| **Grafana** | Metrics visualization | 3000 | https://grafana.sebhosting.com |
| **Prometheus** | Metrics collection | 9090 | Internal |

### Databases

- **PostgreSQL 16** — Primary relational database
- **MongoDB 7** — Document store for CMS
- **Redis 7** — Session store & caching
- **Memcached** — High-performance object cache

---

## Quick Start

### Prerequisites

- Docker 29+ & Docker Compose
- Node.js 25+ (for local development)
- Domain with Cloudflare DNS (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/sebhosting/nexus.git
cd nexus

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Start all services
cd infrastructure/docker
docker compose up -d

# Check health status
curl http://localhost:4000/health
```

### Environment Variables

```env
# Database Passwords
POSTGRES_PASSWORD=your-secure-password
MONGODB_PASSWORD=your-secure-password
REDIS_PASSWORD=your-secure-password

# JWT Secret
JWT_SECRET=your-jwt-secret-min-32-chars

# Cloudflare (optional)
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ZONE_ID=your-zone-id

# Grafana
GRAFANA_PASSWORD=admin-password

# Claude MCP (optional)
CF_SERVICE_TOKEN_ID=your-service-token-id
CF_SERVICE_TOKEN_SECRET=your-service-token-secret
```

---

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build all services
npm run build
```

### Docker Development

```bash
# Build and start services
make start

# View logs
make logs

# Stop services
make stop

# Rebuild a specific service
docker compose up -d --build api
```

### Service Structure

```
nexus/
├── frontend/          # Next.js frontend
├── backend/           # API Gateway (Express)
├── services/
│   ├── auth-service/  # JWT authentication
│   ├── cms-service/   # Headless CMS
│   ├── cdn-service/   # Static assets
│   ├── cache-service/ # Caching layer
│   ├── waf-service/   # Web firewall
│   ├── ai-gateway/    # Claude integration
│   └── mcp-server/    # Claude MCP tools
└── infrastructure/
    ├── docker/        # Docker Compose configs
    ├── prometheus/    # Metrics config
    └── traefik/       # Reverse proxy config
```

---

## Claude MCP Integration

NeXuS includes a **Model Context Protocol (MCP) server** that lets Claude Code interact with your infrastructure:

### Available Tools

- `nexus_system_overview` — Get container stats, memory, load average
- `nexus_health_check` — Ping all services, check HTTP status codes
- `nexus_list_containers` — List all containers with resource usage
- `nexus_container_stats` — Detailed stats for a specific container
- `nexus_restart_container` — Restart a service by name
- `nexus_stop_container` — Stop a running container

### Configure Claude Desktop

Add to `~/.claude/mcp_servers.json`:

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

---

## Monitoring & Observability

### Grafana Dashboards

Access Grafana at `https://grafana.sebhosting.com` (default: `admin` / your GRAFANA_PASSWORD)

**Pre-configured dashboards:**
- Container resource usage
- API request metrics
- Database performance
- Cache hit rates

### Prometheus Metrics

Metrics available at `http://nexus-prometheus:9090` (internal only)

```promql
# Example queries
rate(http_requests_total[5m])
container_memory_usage_bytes
redis_connected_clients
```

### Health Checks

```bash
# Check all services
curl https://api.sebhosting.com/stats

# Individual service health
curl https://auth.sebhosting.com/health
curl https://cms.sebhosting.com/health
```

---

## Security

### Built-in Security Features

- **JWT Authentication** — Stateless auth with Redis session store
- **Rate Limiting** — 20 requests/15min on auth endpoints
- **WAF Protection** — Web application firewall rules
- **CORS Configuration** — Strict origin policies
- **Cloudflare Integration** — DDoS protection, SSL/TLS
- **Secret Management** — Environment-based secrets
- **Network Isolation** — Internal Docker network for databases

### Production Hardening

See `infrastructure/docker/docker-compose-HARDENED.yml` for additional security configurations:
- Read-only root filesystems
- Dropped kernel capabilities
- Resource limits
- No-new-privileges flag

---

## Deployment

### Production Deployment

1. **Set up Cloudflare DNS** pointing to your server
2. **Configure Traefik** for Let's Encrypt SSL
3. **Update `.env`** with production credentials
4. **Deploy with Docker Compose:**

```bash
cd infrastructure/docker
docker compose up -d
```

### Kubernetes (Coming Soon)

K8s manifests and Helm charts are planned for future releases.

---

## API Documentation

### Main API Endpoints

#### `GET /health`
Returns service health status

#### `GET /stats`
Returns Docker container statistics, host metrics, and system info

```json
{
  "timestamp": "2026-02-14T06:19:07.261Z",
  "docker": {
    "containers": "17",
    "running": "17",
    "images": "29",
    "serverVersion": "29.2.1"
  },
  "host": {
    "load1": 0.95,
    "memPercent": 2
  },
  "containers": [...]
}
```

#### `GET /stats/logs/:name`
Get container logs (tail 50 by default)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Credits

Built with 🔥 by **SEB**
Powered by: Docker, TypeScript, Next.js, Express, PostgreSQL, MongoDB, Redis, Traefik, Prometheus, Grafana, and Claude AI

---

## Support

- **Issues:** https://github.com/sebhosting/nexus/issues
- **Discussions:** https://github.com/sebhosting/nexus/discussions

---

**Star this repo if NeXuS helped you build something awesome!** ⭐
