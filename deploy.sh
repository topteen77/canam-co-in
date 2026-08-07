#!/usr/bin/env bash
# Deploy helper for Rakesh CRM MySQL (single image + container name from .env).
#
# Usage:
#   ./deploy.sh setup     # first-time / ensure running (install deps, start DB)
#   ./deploy.sh restart   # stop then start (keeps data)
#   ./deploy.sh rebuild   # stop, remove container, rebuild image, start (keeps data)
#   ./deploy.sh stop      # stop container
#   ./deploy.sh remove    # stop + remove container + image (DB files kept)
#   ./deploy.sh status    # show container / URLs / data path
#
# All dynamic website globals come from project-root .env
# Paths are resolved from this script's directory so the project can move.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
DOCKERFILE="$PROJECT_ROOT/Dockerfile.mysql"
DOCKERFILE_PMA="$PROJECT_ROOT/Dockerfile.phpmyadmin"
MYSQL_IMAGE_BASE="mysql:8.0"
PMA_IMAGE_BASE="phpmyadmin:5"
RUN_DIR="$PROJECT_ROOT/.deploy"
LOG_DIR="$PROJECT_ROOT/logs"

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker is not installed or not in PATH"
  docker info >/dev/null 2>&1 || die "docker daemon is not reachable"
}

env_get() {
  local key="$1"
  local file="${2:-$ENV_FILE}"
  local line
  [[ -f "$file" ]] || { printf ''; return 0; }
  line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
  [[ -n "$line" ]] || { printf ''; return 0; }
  local val="${line#*=}"
  val="${val%$'\r'}"
  if [[ "$val" == \"*\" ]]; then val="${val:1:${#val}-2}"; fi
  if [[ "$val" == \'*\' ]]; then val="${val:1:${#val}-2}"; fi
  printf '%s' "$val"
}

resolve_path() {
  # Resolve path relative to project root (absolute paths left as-is)
  local p="$1"
  if [[ "$p" = /* ]]; then
    printf '%s' "$p"
    return
  fi
  local dir base
  dir="$(dirname "$p")"
  base="$(basename "$p")"
  printf '%s/%s' "$(cd "$PROJECT_ROOT" && cd "$dir" && pwd)" "$base"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE — copy .env.example to .env and configure it"

  # Ensure server/.env points at root .env (Node scripts under server/ often load .env locally)
  if [[ ! -e "$PROJECT_ROOT/server/.env" ]]; then
    ln -sfn ../.env "$PROJECT_ROOT/server/.env"
  fi

  NAME="$(env_get DOCKER_NAME)"
  NAME="${NAME:-rakesh-crm}"
  PMA_NAME="${NAME}-pma"
  NETWORK_NAME="${NAME}-net"

  DB_NAME="$(env_get DB_NAME)"
  DB_USER="$(env_get DB_USER)"
  DB_PASSWORD="$(env_get DB_PASSWORD)"
  DB_HOST="$(env_get DB_HOST)"
  DB_PORT="$(env_get DB_PORT)"
  DB_NAME="${DB_NAME:-db_nod_crm}"
  DB_USER="${DB_USER:-phpadmin}"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-3306}"
  [[ -n "$DB_PASSWORD" ]] || die "DB_PASSWORD is empty in $ENV_FILE"

  FRONTEND_HOST="$(env_get FRONTEND_HOST)"
  FRONTEND_PORT="$(env_get FRONTEND_PORT)"
  BACKEND_HOST="$(env_get BACKEND_HOST)"
  BACKEND_PORT="$(env_get PORT)"
  FRONTEND_HOST="${FRONTEND_HOST:-localhost}"
  FRONTEND_PORT="${FRONTEND_PORT:-3000}"
  BACKEND_HOST="${BACKEND_HOST:-localhost}"
  BACKEND_PORT="${BACKEND_PORT:-5001}"

  PHPMYADMIN_PORT="$(env_get PHPMYADMIN_PORT)"
  PUBLIC_PHPMYADMIN_URL="$(env_get PUBLIC_PHPMYADMIN_URL)"
  PHPMYADMIN_PORT="${PHPMYADMIN_PORT:-8081}"
  PUBLIC_PHPMYADMIN_URL="${PUBLIC_PHPMYADMIN_URL:-http://localhost:${PHPMYADMIN_PORT}}"

  PUBLIC_FRONTEND_URL="$(env_get PUBLIC_FRONTEND_URL)"
  PUBLIC_BACKEND_URL="$(env_get PUBLIC_BACKEND_URL)"
  VITE_API_URL="$(env_get VITE_API_URL)"
  PUBLIC_FRONTEND_URL="${PUBLIC_FRONTEND_URL:-http://${FRONTEND_HOST}:${FRONTEND_PORT}}"
  PUBLIC_BACKEND_URL="${PUBLIC_BACKEND_URL:-http://${BACKEND_HOST}:${BACKEND_PORT}}"
  VITE_API_URL="${VITE_API_URL:-${PUBLIC_BACKEND_URL}/api}"

  local data_rel dump_rel
  data_rel="$(env_get DB_DATA_DIR)"
  dump_rel="$(env_get SQL_DUMP_PATH)"
  data_rel="${data_rel:-../db-data}"
  dump_rel="${dump_rel:-../db_nod_crm.sql}"
  DB_DATA_DIR="$(resolve_path "$data_rel")"
  SQL_DUMP="$(resolve_path "$dump_rel")"
}

ensure_db_data_dir() {
  mkdir -p "$DB_DATA_DIR"
  log "DB data directory: $DB_DATA_DIR"
}

# --- Port helpers -----------------------------------------------------------

port_listeners() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v p=":$port" '
      index($4, p) > 0 {
        n = split($4, a, ":");
        if (a[n] == substr(p, 2)) print $0;
      }' || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  fi
  return 0
}

port_is_open() {
  local port="$1"
  local lines
  lines="$(port_listeners "$port")"
  [[ -n "$lines" ]]
}

port_held_by_our_container() {
  local port="$1"
  local cname
  for cname in "$NAME" "$PMA_NAME"; do
    named_container_running "$cname" 2>/dev/null || continue
    docker port "$cname" 2>/dev/null | grep -qE ":${port}\$" && return 0
  done
  return 1
}

describe_port_users() {
  local port="$1"
  local lines
  lines="$(port_listeners "$port")"
  if [[ -z "$lines" ]]; then
    echo "  - (no listener details; try: ss -ltnp | grep :$port)"
    return
  fi

  if port_held_by_our_container "$port"; then
    echo "  - Docker container '$NAME' (expected)"
    return
  fi

  # Prefer docker container names publishing this port
  local dock
  dock="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ":${port}->|:0\.0\.0\.0:${port}\b" || true)"
  if [[ -n "$dock" ]]; then
    echo "$dock" | while IFS= read -r row; do
      echo "  - Docker container: $row"
    done
    return
  fi

  echo "$lines" | while IFS= read -r line; do
    local pid name
    pid="$(echo "$line" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
    if [[ -n "$pid" ]] && [[ -r "/proc/$pid/comm" ]]; then
      name="$(cat "/proc/$pid/comm" 2>/dev/null || echo unknown)"
      echo "  - process '$name' (pid $pid)"
    elif echo "$line" | grep -qi 'docker'; then
      echo "  - docker-proxy (another container or stale publish)"
    else
      echo "  - listening on port $port (run with sudo ss -ltnp for process name)"
    fi
  done
}

# Hard fail if port is in use by something other than our container
assert_port_free_for_bind() {
  local port="$1"
  local label="$2"

  if ! port_is_open "$port"; then
    return 0
  fi

  if port_held_by_our_container "$port"; then
    return 0
  fi

  # Our container may be stopped but docker-proxy gone — still occupied by others
  {
    echo "ERROR: $label port $port is already open / in use."
    echo "       Free the port, or change the value in $ENV_FILE and retry."
    echo "       Current listeners:"
    describe_port_users "$port"
    if docker ps -a --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ":${port}->|:${port}\b" >/dev/null; then
      echo "       Related Docker containers:"
      docker ps -a --format '  - {{.Names}}  {{.Status}}  {{.Ports}}' | grep -E ":${port}->|:${port}\b" || true
    fi
  } >&2
  exit 1
}

check_app_ports_report() {
  if port_is_open "$FRONTEND_PORT" && ! app_pid_alive frontend; then
    warn "Frontend port $FRONTEND_PORT is already open (not our deploy process)."
    describe_port_users "$FRONTEND_PORT" >&2
  fi
  if port_is_open "$BACKEND_PORT" && ! app_pid_alive backend; then
    warn "Backend port $BACKEND_PORT is already open (not our deploy process)."
    describe_port_users "$BACKEND_PORT" >&2
  fi
  return 0
}

print_urls() {
  echo
  echo "----------------------------------------"
  echo " Connect"
  echo "----------------------------------------"
  echo " Frontend:   $PUBLIC_FRONTEND_URL"
  echo " Backend:    $PUBLIC_BACKEND_URL"
  echo " API:        $VITE_API_URL"
  echo " phpMyAdmin: $PUBLIC_PHPMYADMIN_URL"
  echo "             login: $DB_USER / (DB_PASSWORD from .env)"
  echo " MySQL:      ${DB_HOST}:${DB_PORT}  (db=$DB_NAME user=$DB_USER)"
  echo "----------------------------------------"
  echo " Logs:       $LOG_DIR/frontend.log"
  echo "             $LOG_DIR/backend.log"
  echo " Config:     $ENV_FILE"
  echo "----------------------------------------"
  echo
}

# --- App process (frontend + backend) ---------------------------------------

ensure_run_dirs() {
  mkdir -p "$RUN_DIR" "$LOG_DIR"
}

pid_file() {
  case "$1" in
    backend)  printf '%s' "$RUN_DIR/backend.pid" ;;
    frontend) printf '%s' "$RUN_DIR/frontend.pid" ;;
    *) die "Unknown app: $1" ;;
  esac
}

app_pid_alive() {
  local which="$1"
  local pf pid
  pf="$(pid_file "$which")"
  [[ -f "$pf" ]] || return 1
  pid="$(tr -d ' \n' < "$pf" || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

stop_app() {
  local which="$1"
  local pf pid port
  pf="$(pid_file "$which")"
  case "$which" in
    backend)  port="$BACKEND_PORT" ;;
    frontend) port="$FRONTEND_PORT" ;;
  esac

  if [[ -f "$pf" ]]; then
    pid="$(tr -d ' \n' < "$pf" || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      log "Stopping $which (pid $pid)..."
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
      local i
      for i in $(seq 1 15); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.3
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        pkill -9 -P "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "$pf"
  fi

  # Clear orphaned listeners left by npm/node child processes
  if [[ -n "${port:-}" ]] && port_is_open "$port"; then
    local pids
    pids="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '
      index($4, p) > 0 {
        n = split($4, a, ":");
        if (a[n] == substr(p, 2)) print $0;
      }' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
    if [[ -n "$pids" ]]; then
      log "Freeing $which port $port (orphaned pids: $pids)..."
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
      sleep 0.5
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
      sleep 0.3
    fi
  fi
}

stop_apps() {
  stop_app frontend
  stop_app backend
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local logfile="$3"
  local i
  for i in $(seq 1 60); do
    if port_is_open "$port"; then
      log "$label is listening on port $port"
      return 0
    fi
    sleep 0.5
  done
  warn "$label failed to open port $port — last log lines:"
  [[ -f "$logfile" ]] && tail -n 40 "$logfile" >&2 || true
  die "$label did not start on port $port. Check $logfile"
}

# After npm spawns node, record the real listener pid
record_listener_pid() {
  local which="$1"
  local port="$2"
  local pf pid
  pf="$(pid_file "$which")"
  pid="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '
    index($4, p) > 0 {
      n = split($4, a, ":");
      if (a[n] == substr(p, 2)) print $0;
    }' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
  if [[ -n "$pid" ]]; then
    echo "$pid" >"$pf"
  fi
}

start_backend() {
  ensure_run_dirs
  local pf
  pf="$(pid_file backend)"

  if app_pid_alive backend && port_is_open "$BACKEND_PORT"; then
    log "Backend already running (pid $(cat "$pf"))"
    return 0
  fi

  stop_app backend
  assert_port_free_for_bind "$BACKEND_PORT" "Backend (PORT)"

  log "Starting backend (PORT=$BACKEND_PORT)..."
  (
    cd "$PROJECT_ROOT/server"
    # setsid so deploy exit does not kill the app
    setsid npm run start-full >"$LOG_DIR/backend.log" 2>&1 < /dev/null &
    echo $! >"$pf"
  )
  wait_for_port "$BACKEND_PORT" "Backend" "$LOG_DIR/backend.log"
  record_listener_pid backend "$BACKEND_PORT"
}

start_frontend() {
  ensure_run_dirs
  local pf
  pf="$(pid_file frontend)"

  if app_pid_alive frontend && port_is_open "$FRONTEND_PORT"; then
    log "Frontend already running (pid $(cat "$pf"))"
    return 0
  fi

  stop_app frontend
  assert_port_free_for_bind "$FRONTEND_PORT" "Frontend (FRONTEND_PORT)"

  log "Starting frontend (FRONTEND_PORT=$FRONTEND_PORT)..."
  (
    cd "$PROJECT_ROOT"
    setsid npm run dev >"$LOG_DIR/frontend.log" 2>&1 < /dev/null &
    echo $! >"$pf"
  )
  wait_for_port "$FRONTEND_PORT" "Frontend" "$LOG_DIR/frontend.log"
  record_listener_pid frontend "$FRONTEND_PORT"
}

start_apps() {
  start_backend
  start_frontend
}

print_app_status() {
  echo "Apps:"
  if app_pid_alive backend; then
    echo "  Backend:   running (pid $(tr -d ' \n' < "$(pid_file backend)")) → $PUBLIC_BACKEND_URL"
  else
    echo "  Backend:   stopped"
  fi
  if app_pid_alive frontend; then
    echo "  Frontend:  running (pid $(tr -d ' \n' < "$(pid_file frontend)")) → $PUBLIC_FRONTEND_URL"
  else
    echo "  Frontend:  stopped"
  fi
}

# --- Docker lifecycle -------------------------------------------------------

named_container_exists() {
  docker ps -a --format '{{.Names}}' | grep -qx "$1"
}

named_container_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

named_image_exists() {
  docker image inspect "$1" >/dev/null 2>&1
}

container_exists() { named_container_exists "$NAME"; }
container_running() { named_container_running "$NAME"; }
image_exists() { named_image_exists "$NAME"; }

pma_exists() { named_container_exists "$PMA_NAME"; }
pma_running() { named_container_running "$PMA_NAME"; }
pma_image_exists() { named_image_exists "$PMA_NAME"; }

ensure_network() {
  if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    log "Creating Docker network $NETWORK_NAME..."
    docker network create "$NETWORK_NAME" >/dev/null
  fi
}

connect_to_network() {
  local cname="$1"
  named_container_exists "$cname" || return 0
  if ! docker inspect -f '{{json .NetworkSettings.Networks}}' "$cname" 2>/dev/null | grep -q "\"$NETWORK_NAME\""; then
    docker network connect "$NETWORK_NAME" "$cname" 2>/dev/null || true
  fi
}

stop_named_container() {
  local cname="$1"
  if named_container_running "$cname"; then
    log "Stopping container $cname..."
    docker stop "$cname" >/dev/null
  fi
}

remove_named_container() {
  local cname="$1"
  if named_container_exists "$cname"; then
    stop_named_container "$cname"
    log "Removing container $cname..."
    docker rm "$cname" >/dev/null
  fi
}

remove_named_image() {
  local iname="$1"
  if named_image_exists "$iname"; then
    log "Removing image $iname..."
    docker rmi "$iname" >/dev/null || warn "Could not remove image $iname (may be in use)"
  fi
}

stop_container() {
  stop_named_container "$PMA_NAME"
  stop_named_container "$NAME"
}

remove_container() {
  remove_named_container "$PMA_NAME"
  remove_named_container "$NAME"
}

remove_image() {
  remove_named_image "$PMA_NAME"
  remove_named_image "$NAME"
}

cleanup_legacy() {
  local legacy
  for legacy in crm-mysql; do
    if named_container_exists "$legacy"; then
      log "Removing legacy container $legacy..."
      docker rm -f "$legacy" >/dev/null || true
    fi
  done
}

build_image() {
  log "Building image $NAME from $DOCKERFILE..."
  docker pull "$MYSQL_IMAGE_BASE" >/dev/null
  docker build -t "$NAME" -f "$DOCKERFILE" "$PROJECT_ROOT"
}

build_pma_image() {
  log "Building image $PMA_NAME from $DOCKERFILE_PMA..."
  docker pull "$PMA_IMAGE_BASE" >/dev/null
  docker build -t "$PMA_NAME" -f "$DOCKERFILE_PMA" "$PROJECT_ROOT"
}

mysql_ready() {
  docker exec "$NAME" mysqladmin ping -h127.0.0.1 -uroot -p"$DB_PASSWORD" --silent 2>/dev/null
}

wait_for_mysql() {
  local i
  log "Waiting for MySQL inside $NAME..."
  for i in $(seq 1 90); do
    if mysql_ready; then
      log "MySQL is ready"
      return 0
    fi
    sleep 2
  done
  docker logs "$NAME" 2>&1 | tail -40 || true
  die "Timed out waiting for MySQL"
}

table_count() {
  docker exec "$NAME" mysql -uroot -p"$DB_PASSWORD" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null \
    | tr -d '\r' || echo 0
}

import_dump_if_needed() {
  local count
  count="$(table_count)"
  if [[ "${count:-0}" -gt 0 ]]; then
    log "Database already has $count tables — skipping SQL import"
    return 0
  fi

  [[ -f "$SQL_DUMP" ]] || die "SQL dump not found: $SQL_DUMP (needed for empty database). Set SQL_DUMP_PATH in .env"

  log "Importing $SQL_DUMP into $DB_NAME..."
  docker exec -i "$NAME" mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_DUMP"
  count="$(table_count)"
  log "Import complete ($count tables)"
}

grant_app_user() {
  docker exec "$NAME" mysql -uroot -p"$DB_PASSWORD" -e "
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
    ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASSWORD}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
    FLUSH PRIVILEGES;
  " 2>/dev/null || true
}

start_phpmyadmin() {
  ensure_network
  connect_to_network "$NAME"
  pma_image_exists || build_pma_image

  if pma_running; then
    log "phpMyAdmin already running — stopping before restart..."
    stop_named_container "$PMA_NAME"
  fi

  if pma_exists; then
    assert_port_free_for_bind "$PHPMYADMIN_PORT" "phpMyAdmin (PHPMYADMIN_PORT)"
    log "Starting existing phpMyAdmin container $PMA_NAME..."
    docker start "$PMA_NAME" >/dev/null
    connect_to_network "$PMA_NAME"
  else
    assert_port_free_for_bind "$PHPMYADMIN_PORT" "phpMyAdmin (PHPMYADMIN_PORT)"
    log "Creating phpMyAdmin $PMA_NAME on port $PHPMYADMIN_PORT..."
    docker run -d \
      --name "$PMA_NAME" \
      --restart unless-stopped \
      --network "$NETWORK_NAME" \
      -e PMA_HOST="$NAME" \
      -e PMA_PORT=3306 \
      -e PMA_USER="$DB_USER" \
      -e PMA_PASSWORD="$DB_PASSWORD" \
      -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" \
      -e UPLOAD_LIMIT=64M \
      -p "${PHPMYADMIN_PORT}:80" \
      "$PMA_NAME" >/dev/null
  fi

  wait_for_pma() {
    local i
    for i in $(seq 1 60); do
      if port_is_open "$PHPMYADMIN_PORT"; then
        log "phpMyAdmin is listening on port $PHPMYADMIN_PORT"
        return 0
      fi
      sleep 0.5
    done
    docker logs "$PMA_NAME" 2>&1 | tail -40 || true
    die "phpMyAdmin did not start on port $PHPMYADMIN_PORT. Is PHPMYADMIN_PORT free? (see .env)"
  }
  wait_for_pma
  log "phpMyAdmin up: $PUBLIC_PHPMYADMIN_URL"
}

start_container() {
  ensure_db_data_dir
  ensure_network
  image_exists || build_image

  if container_running; then
    log "Container $NAME already running — stopping before restart..."
    stop_named_container "$PMA_NAME"
    stop_named_container "$NAME"
  fi

  if container_exists; then
    # Existing container already has its published ports; ensure DB_PORT is free before start
    assert_port_free_for_bind "$DB_PORT" "MySQL (DB_PORT)"
    log "Starting existing container $NAME..."
    docker start "$NAME" >/dev/null
  else
    assert_port_free_for_bind "$DB_PORT" "MySQL (DB_PORT)"
    log "Creating container $NAME (port $DB_PORT, data -> $DB_DATA_DIR)..."
    docker run -d \
      --name "$NAME" \
      --restart unless-stopped \
      --network "$NETWORK_NAME" \
      -e MYSQL_ROOT_PASSWORD="$DB_PASSWORD" \
      -e MYSQL_DATABASE="$DB_NAME" \
      -e MYSQL_USER="$DB_USER" \
      -e MYSQL_PASSWORD="$DB_PASSWORD" \
      -p "${DB_PORT}:3306" \
      -v "${DB_DATA_DIR}:/var/lib/mysql" \
      "$NAME" >/dev/null
  fi

  connect_to_network "$NAME"
  wait_for_mysql
  grant_app_user
  import_dump_if_needed
  start_phpmyadmin

  log "MySQL up: host=$DB_HOST port=$DB_PORT db=$DB_NAME user=$DB_USER"
  log "Data persisted at: $DB_DATA_DIR"
}

install_deps() {
  log "Installing frontend dependencies..."
  (cd "$PROJECT_ROOT" && npm install)

  log "Installing server dependencies..."
  (cd "$PROJECT_ROOT/server" && npm install)

  if [[ ! -L "$PROJECT_ROOT/server/.env" ]] && [[ ! -e "$PROJECT_ROOT/server/.env" ]]; then
    ln -sfn ../.env "$PROJECT_ROOT/server/.env"
    log "Linked server/.env -> ../.env"
  fi
}

cmd_setup() {
  require_docker
  load_env
  cleanup_legacy
  install_deps
  start_container
  stop_apps
  start_apps
  log "Setup complete."
  print_app_status
  print_urls
}

cmd_restart() {
  require_docker
  load_env
  stop_apps
  if container_running; then
    stop_container
  fi
  start_container
  start_apps
  log "Restart complete."
  print_app_status
  print_urls
}

cmd_rebuild() {
  require_docker
  load_env
  stop_apps
  cleanup_legacy
  if container_running || container_exists || pma_exists; then
    log "Stopping and removing containers before rebuild (data kept in $DB_DATA_DIR)..."
    remove_container
  fi
  assert_port_free_for_bind "$DB_PORT" "MySQL (DB_PORT)"
  assert_port_free_for_bind "$PHPMYADMIN_PORT" "phpMyAdmin (PHPMYADMIN_PORT)"
  remove_image
  build_image
  build_pma_image
  start_container
  start_apps
  log "Rebuild complete."
  print_app_status
  print_urls
}

cmd_stop() {
  require_docker
  load_env
  stop_apps
  stop_container
  log "Stopped MySQL + phpMyAdmin + apps. Data kept at: $DB_DATA_DIR"
}

cmd_remove() {
  require_docker
  load_env
  stop_apps
  remove_container
  remove_image
  cleanup_legacy
  if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    docker network rm "$NETWORK_NAME" >/dev/null 2>&1 || warn "Could not remove network $NETWORK_NAME"
  fi
  log "Removed containers/images '$NAME' and '$PMA_NAME'."
  log "DB files kept at: $DB_DATA_DIR"
  log "To wipe DB data as well: rm -rf \"$DB_DATA_DIR\""
}

cmd_status() {
  require_docker
  load_env
  echo "Project:     $PROJECT_ROOT"
  echo "Env file:    $ENV_FILE"
  echo "MySQL name:  $NAME"
  echo "PMA name:    $PMA_NAME"
  echo "Network:     $NETWORK_NAME"
  echo "DB data:     $DB_DATA_DIR"
  echo "SQL dump:    $SQL_DUMP"
  echo
  docker ps -a --filter "name=${NAME}" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  if image_exists; then
    docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' "$NAME"
  fi
  if pma_image_exists; then
    docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' "$PMA_NAME"
  fi
  if [[ -d "$DB_DATA_DIR" ]]; then
    local db_size
    db_size="$(du -sh "$DB_DATA_DIR" 2>/dev/null | awk '{print $1}' || true)"
    echo "DB dir size: ${db_size:-unknown}"
  else
    echo "DB dir:      missing (will be created on setup/start)"
  fi
  echo
  print_app_status
  echo
  echo "Port check:"
  for pair in "MySQL:$DB_PORT" "phpMyAdmin:$PHPMYADMIN_PORT" "Frontend:$FRONTEND_PORT" "Backend:$BACKEND_PORT"; do
    label="${pair%%:*}"
    port="${pair##*:}"
    if port_is_open "$port"; then
      echo "  $label ($port): OPEN"
      describe_port_users "$port"
    else
      echo "  $label ($port): free"
    fi
  done
  print_urls
}

usage() {
  load_env 2>/dev/null || true
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  setup     Install deps, start MySQL + phpMyAdmin + backend + frontend
  restart   Stop then start all (keeps DB data)
  rebuild   Rebuild images, then start all (keeps data)
  stop      Stop MySQL + phpMyAdmin + frontend + backend
  remove    Remove containers + images (keeps DB data; stops apps)
  status    Show paths, ports, app PIDs, and connect URLs

All dynamic settings: $ENV_FILE  (see .env.example)
Docker MySQL:         \${DOCKER_NAME:-rakesh-crm}
Docker phpMyAdmin:    \${DOCKER_NAME:-rakesh-crm}-pma
phpMyAdmin URL:       \${PUBLIC_PHPMYADMIN_URL:-http://localhost:8081}
DB data folder:       \${DB_DATA_DIR:-../db-data} (relative to project root)
EOF
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    setup)   cmd_setup ;;
    restart) cmd_restart ;;
    rebuild) cmd_rebuild ;;
    stop)    cmd_stop ;;
    remove)  cmd_remove ;;
    status)  cmd_status ;;
    -h|--help|help|"") usage; [[ -n "$cmd" ]] || exit 1 ;;
    *) die "Unknown command: $cmd (try: setup|restart|rebuild|stop|remove|status)" ;;
  esac
}

main "$@"
