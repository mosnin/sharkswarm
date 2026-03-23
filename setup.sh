#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }

INFRA_DIR="${HOME}/openclaw-infra"

# ── 1. Install Docker if missing ─────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  info "Docker installed. You may need to log out and back in for group changes."
else
  info "Docker already installed: $(docker --version)"
fi

# ── 2. Install Docker Compose plugin if missing ──────────────────
if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-compose-plugin
else
  info "Docker Compose already installed: $(docker compose version)"
fi

# ── 3. Create infrastructure directory ───────────────────────────
info "Setting up ${INFRA_DIR} ..."
mkdir -p "${INFRA_DIR}"

# Copy project files (assumes this script is run from the repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "${SCRIPT_DIR}" != "${INFRA_DIR}" ]; then
  cp -r "${SCRIPT_DIR}/docker-compose.yml" "${INFRA_DIR}/"
  cp -r "${SCRIPT_DIR}/.env.example"       "${INFRA_DIR}/"
  cp -r "${SCRIPT_DIR}/openclaw"           "${INFRA_DIR}/"
  cp -r "${SCRIPT_DIR}/scripts"            "${INFRA_DIR}/"
  cp -r "${SCRIPT_DIR}/frontend"           "${INFRA_DIR}/"
fi

# ── 4. Create .env from example if it doesn't exist ──────────────
cd "${INFRA_DIR}"
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created .env from .env.example — please edit it with your API keys:"
  warn "  nano ${INFRA_DIR}/.env"
else
  info ".env already exists, skipping."
fi

# ── 5. Create workspace directories for agents ──────────────────
mkdir -p openclaw/agent1/workspace openclaw/agent1/memory
mkdir -p openclaw/agent2/workspace openclaw/agent2/memory

# ── 6. Start the stack ───────────────────────────────────────────
info "Starting Docker Compose stack..."
docker compose up -d --build

# ── 7. Print status ──────────────────────────────────────────────
echo ""
info "Stack is starting up! Container status:"
docker compose ps
echo ""
info "Access points:"
info "  Agent 1 (Alpha):  http://localhost:3000"
info "  Agent 2 (Bravo):  http://localhost:3001"
info "  Frontend:         http://localhost:3002"
info "  Postgres:         localhost:5432"
info "  Redis:            localhost:6379"
echo ""
info "Useful commands:"
info "  docker compose logs -f              # Follow all logs"
info "  docker compose logs -f openclaw-agent-1  # Follow agent 1 logs"
info "  docker compose down                 # Stop the stack"
info "  docker compose up -d --scale openclaw-agent-1=1 openclaw-agent-2=1  # Restart"
