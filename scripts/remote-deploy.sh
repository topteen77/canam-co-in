#!/usr/bin/env bash
# Server-side deploy (run on the VPS after git pull).
# Usage:
#   APP_ENV=production BRANCH=main   ./scripts/remote-deploy.sh
#   APP_ENV=staging    BRANCH=dev    ./scripts/remote-deploy.sh
#
# Expects:
#   - Node.js 18+
#   - Project .env already configured on the server (never from git)
#   - Optional: pm2 process names CRM_API_NAME / CRM_WEB_NAME

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_ENV="${APP_ENV:-production}"
BRANCH="${BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/topteen77/canam-co-in.git}"

CRM_API_NAME="${CRM_API_NAME:-crm-api-${APP_ENV}}"
# Frontend is usually static files via nginx; optional preview process:
CRM_WEB_NAME="${CRM_WEB_NAME:-}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ROOT/.env" ]] || die "Missing $ROOT/.env — create it on the server (see .env.example). Never commit secrets."

# Ensure APP_ENV / noindex flags for build
case "$APP_ENV" in
  production|prod)
    export APP_ENV=production
    export VITE_APP_ENV=production
    export VITE_NOINDEX=false
    ;;
  staging|dev)
    export APP_ENV=staging
    export VITE_APP_ENV=staging
    export VITE_NOINDEX=true
    ;;
  *)
    die "APP_ENV must be production or staging (got: $APP_ENV)"
    ;;
esac

log "Deploy root: $ROOT"
log "Branch: $BRANCH | Env: $APP_ENV | NOINDEX=$VITE_NOINDEX"

if [[ -d "$ROOT/.git" ]]; then
  log "Fetching $BRANCH..."
  git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"
  git fetch --prune origin
  git checkout "$BRANCH"
  git reset --hard "origin/$BRANCH"
else
  die "Not a git repo: $ROOT — clone the repo here first"
fi

# Load VITE_API_URL etc from server .env for the build (without printing secrets)
set -a
# shellcheck disable=SC1091
source <(grep -E '^(VITE_|PUBLIC_|GEMINI_API_KEY|ALLOWED_HOSTS)=' "$ROOT/.env" | sed 's/\r$//' || true)
set +a

# Force staging noindex even if .env omitted it
if [[ "$APP_ENV" == "staging" ]]; then
  export VITE_APP_ENV=staging
  export VITE_NOINDEX=true
fi

log "Installing frontend dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Installing server dependencies..."
(
  cd "$ROOT/server"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
)

log "Building frontend (VITE_APP_ENV=$VITE_APP_ENV)..."
npm run build

# Symlink server env if needed
if [[ ! -e "$ROOT/server/.env" ]]; then
  ln -sfn ../.env "$ROOT/server/.env"
fi

restart_pm2() {
  local name="$1"
  local cwd="$2"
  local script="$3"
  if ! command -v pm2 >/dev/null 2>&1; then
    return 1
  fi
  if pm2 describe "$name" >/dev/null 2>&1; then
    log "PM2 reload $name..."
    (cd "$cwd" && pm2 reload "$name" --update-env)
  else
    log "PM2 start $name..."
    (cd "$cwd" && pm2 start "$script" --name "$name" --update-env)
  fi
  pm2 save >/dev/null 2>&1 || true
  return 0
}

if restart_pm2 "$CRM_API_NAME" "$ROOT/server" "index.js"; then
  log "API process: pm2:$CRM_API_NAME"
elif systemctl is-active --quiet "crm-api-${APP_ENV}.service" 2>/dev/null; then
  log "Restarting systemd crm-api-${APP_ENV}.service..."
  sudo systemctl restart "crm-api-${APP_ENV}.service"
else
  warn_msg="No pm2/systemd API process found. Start manually: cd server && node index.js"
  printf 'WARN: %s\n' "$warn_msg" >&2
fi

if [[ -n "$CRM_WEB_NAME" ]]; then
  restart_pm2 "$CRM_WEB_NAME" "$ROOT" "npx vite preview --host 0.0.0.0 --port \${FRONTEND_PORT:-3000}" || true
fi

# Reload nginx if present (picks up new static files under dist/)
if command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t 2>/dev/null; then
    sudo systemctl reload nginx 2>/dev/null || true
    log "nginx reloaded"
  fi
fi

log "Deploy complete ($APP_ENV / $BRANCH)"
log "Static files: $ROOT/dist"
