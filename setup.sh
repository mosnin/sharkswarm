#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NANOCLAW_REPO="https://github.com/qwibitai/nanoclaw.git"

info "NanoClaw Multi-Agent Setup"
info "Working directory: ${SCRIPT_DIR}"
echo

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

# ── 3. Clone NanoClaw repo if not present ─────────────────────────
if [ ! -d "${SCRIPT_DIR}/backend/nanoclaw" ]; then
  info "Cloning NanoClaw from ${NANOCLAW_REPO}..."
  git clone "${NANOCLAW_REPO}" "${SCRIPT_DIR}/backend/nanoclaw"
else
  info "NanoClaw repo already cloned, pulling latest..."
  cd "${SCRIPT_DIR}/backend/nanoclaw" && git pull && cd "${SCRIPT_DIR}"
fi

# ── 4. Create .env from example if it doesn't exist ──────────────
cd "${SCRIPT_DIR}/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created backend/.env from .env.example"
  warn "Please edit it with your API keys before continuing:"
  warn "  nano ${SCRIPT_DIR}/backend/.env"
  warn ""
  warn "Then re-run this script: bash setup.sh"
  exit 0
else
  info "backend/.env already exists, skipping."
fi

# ── 5. Create workspace directories for agents ──────────────────
mkdir -p agent1/workspace agent1/memory
mkdir -p agent2/workspace agent2/memory

# ── 6. Start the stack ───────────────────────────────────────────
info "Starting Docker Compose stack..."
docker compose up -d --build

# ── 7. Print status ──────────────────────────────────────────────
echo
info "Stack is starting up! Container status:"
docker compose ps
echo
info "Access points:"
info "  Agent Alpha:  http://localhost:3000"
info "  Agent Beta:   http://localhost:3001"
info "  Dashboard:    http://localhost:3002"
info "  Postgres:     localhost:5432"
info "  Redis:        localhost:6379"
echo
info "Useful commands:"
info "  cd backend && docker compose logs -f                    # Follow all logs"
info "  cd backend && docker compose logs -f nanoclaw-agent-1   # Agent 1 logs"
info "  cd backend && docker compose down                       # Stop the stack"
