#!/bin/bash
echo "🛑 Stopping NeXuS..."
docker-compose -f infrastructure/docker/docker-compose.yml down
echo "✓ All services stopped"
