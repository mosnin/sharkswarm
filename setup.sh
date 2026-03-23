#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERR]${NC} $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_REPO="https://github.com/openclaw/openclaw.git"

info "SharkSwarm Multi-Agent Setup"
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

# ── 3. Clone OpenClaw repo if not present ─────────────────────────
if [ ! -d "${SCRIPT_DIR}/backend/nanoclaw/.git" ]; then
  info "Cloning OpenClaw from ${OPENCLAW_REPO}..."
  rm -rf "${SCRIPT_DIR}/backend/nanoclaw"
  git clone --depth 1 "${OPENCLAW_REPO}" "${SCRIPT_DIR}/backend/nanoclaw"
else
  info "OpenClaw repo already cloned, pulling latest..."
  git -C "${SCRIPT_DIR}/backend/nanoclaw" pull || warn "Could not pull latest OpenClaw (offline?)"
fi

# ── 4. Create .env from example if it doesn't exist ──────────────
cd "${SCRIPT_DIR}/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created backend/.env from .env.example"
  warn "⚠  You MUST edit it with your API keys:"
  warn "   nano ${SCRIPT_DIR}/backend/.env"
  warn ""
  warn "Set at minimum:"
  warn "   OPENAI_API_KEY=sk-your-real-key"
  warn "   POSTGRES_PASSWORD=a-strong-password"
  warn "   CORS_ORIGIN=https://your-app.vercel.app"
  echo
else
  info "backend/.env already exists, skipping."
fi

# ── 5. Validate .env has a real API key ──────────────────────────
if grep -q 'sk-REPLACE_ME' .env 2>/dev/null; then
  err "OPENAI_API_KEY is still the placeholder value in backend/.env"
  err "Edit it before running the stack:"
  err "   nano ${SCRIPT_DIR}/backend/.env"
  exit 1
fi

# ── 6. Create workspace directories for agents ──────────────────
mkdir -p agent1/workspace agent1/memory
mkdir -p agent2/workspace agent2/memory

# ── 7. Stop any previous run to avoid port conflicts ─────────────
info "Stopping any previous containers..."
docker compose down --remove-orphans 2>/dev/null || true

# ── 8. Start the stack ───────────────────────────────────────────
info "Building and starting Docker Compose stack..."
docker compose up -d --build

# ── 9. Print status ──────────────────────────────────────────────
echo
info "Stack is starting up! Container status:"
docker compose ps
echo
info "Access points:"
info "  API Gateway:   http://$(hostname -I | awk '{print $1}'):4000"
info "  Frontend:      http://$(hostname -I | awk '{print $1}'):3000  (optional self-hosted)"
echo
info "Useful commands:"
info "  cd backend && docker compose logs -f                    # Follow all logs"
info "  cd backend && docker compose logs -f openclaw-agent-1   # Agent 1 logs"
info "  cd backend && docker compose ps                         # Container status"
info "  cd backend && docker compose down                       # Stop the stack"
