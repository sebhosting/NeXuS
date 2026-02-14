.PHONY: help install start stop logs build

help:
	@echo "NeXuS - Commands"
	@echo ""
	@echo "  make install    - Install all dependencies"
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make logs       - View logs"
	@echo "  make build      - Build all services"

install:
	@bash scripts/install-deps.sh

start:
	@bash scripts/start.sh

stop:
	@bash scripts/stop.sh

logs:
	@docker-compose -f infrastructure/docker/docker-compose.yml logs -f

build:
	@npm run build
