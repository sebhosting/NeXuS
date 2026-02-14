#!/bin/bash
echo "🚀 Starting NeXuS..."
docker-compose -f infrastructure/docker/docker-compose.yml up -d
echo ""
echo "✓ Services started:"
echo "  Frontend:   http://localhost:3000"
echo "  API:        http://localhost:4000"
echo "  CMS:        http://localhost:7000"
echo "  CDN:        http://localhost:7001"
echo "  Cache:      http://localhost:7002"
echo "  Auth:       http://localhost:6000"
echo "  WAF:        http://localhost:7003"
echo "  Grafana:    http://localhost:3001"
