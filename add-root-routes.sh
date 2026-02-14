#!/bin/bash
# Add root routes to all services
GREEN='\033[0;32m'; NC='\033[0m'
NEXUS="$HOME/NeXuS"

echo -e "${GREEN}Adding root routes to all services...${NC}"

# ─── CMS SERVICE ────────────────────────────────────────────────
cat >> $NEXUS/services/cms-service/src/index.ts << 'EOF'

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-cms',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      pages: 'GET /pages, POST /pages, GET /pages/:id, PUT /pages/:id, DELETE /pages/:id',
      posts: 'GET /posts, POST /posts',
      health: 'GET /health'
    }
  })
})
EOF

# ─── CDN SERVICE ────────────────────────────────────────────────
cat >> $NEXUS/services/cdn-service/src/index.ts << 'EOF'

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-cdn',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      upload: 'POST /upload (multipart/form-data)',
      files: 'GET /files (list), GET /files/:filename (download), DELETE /files/:id',
      health: 'GET /health'
    }
  })
})
EOF

# ─── CACHE SERVICE ──────────────────────────────────────────────
cat >> $NEXUS/services/cache-service/src/index.ts << 'EOF'

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-cache',
    version: '1.0.0',
    status: 'healthy',
    backend: 'redis',
    endpoints: {
      stats: 'GET /stats',
      keys: 'GET /keys?pattern=*&cursor=0',
      key: 'GET /key/:key, POST /key {key, value, ttl}, DELETE /key/:key',
      flush: 'POST /flush',
      health: 'GET /health'
    }
  })
})
EOF

# ─── AI GATEWAY ─────────────────────────────────────────────────
cat >> $NEXUS/services/ai-gateway/src/index.ts << 'EOF'

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-ai-gateway',
    version: '1.0.0',
    status: 'healthy',
    providers: ['anthropic', 'openai'],
    endpoints: {
      messages: 'POST /v1/messages (Anthropic proxy)',
      stats: 'GET /stats (24h usage)',
      health: 'GET /health'
    }
  })
})
EOF

# ─── WAF SERVICE ────────────────────────────────────────────────
cat >> $NEXUS/services/waf-service/src/index.ts << 'EOF'

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'nexus-waf',
    version: '1.0.0',
    status: 'healthy',
    features: ['rate-limiting', 'ip-blocking', 'request-validation'],
    endpoints: {
      health: 'GET /health'
    }
  })
})
EOF

# ─── AUTH SERVICE ───────────────────────────────────────────────
cat >> $NEXUS/services/auth-service/src/index.ts << 'EOF'

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
EOF

echo -e "${GREEN}✓ Root routes added to all services${NC}"
echo ""
echo "Rebuild services:"
echo "  cd $NEXUS/infrastructure/docker"
echo "  docker compose build --no-cache cms-service cdn-service cache-service ai-gateway waf-service auth-service"
echo "  docker compose up -d"
