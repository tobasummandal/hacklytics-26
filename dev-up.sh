#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
RUN_DIR="$REPO_ROOT/.run"

VECTOR_CONTAINER="vectoraidb"
VECTOR_IMAGE="williamimoh/actian-vectorai-db:1.0b"
BACKEND_PORT=8000
FRONTEND_PORT=5173

mkdir -p "$RUN_DIR"

if [[ "${1:-}" == "--background" ]]; then
  nohup "$0" --foreground >"$RUN_DIR/dev-up.log" 2>&1 &
  echo "Started dev-up in background (PID $!)."
  echo "Bootstrap log: $RUN_DIR/dev-up.log"
  exit 0
fi

if [[ "${1:-}" == "--foreground" ]]; then
  shift
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

port_open() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

ensure_vectorai() {
  require_cmd docker

  if docker ps --format '{{.Names}}' | grep -qx "$VECTOR_CONTAINER"; then
    echo "VectorAI container already running."
    return
  fi

  if docker ps -a --format '{{.Names}}' | grep -qx "$VECTOR_CONTAINER"; then
    echo "Starting existing VectorAI container..."
    docker start "$VECTOR_CONTAINER" >/dev/null
    return
  fi

  echo "Creating and starting VectorAI container..."
  docker run -d --name "$VECTOR_CONTAINER" -p 50051:50051 "$VECTOR_IMAGE" >/dev/null
}

start_backend() {
  local pid_file="$RUN_DIR/backend.pid"
  local log_file="$RUN_DIR/backend.log"

  if [[ ! -x "$BACKEND_DIR/venv/bin/python" ]]; then
    echo "Missing backend virtualenv at $BACKEND_DIR/venv."
    echo "Create it and install dependencies before running dev-up."
    exit 1
  fi

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo "Backend already running (PID $(cat "$pid_file"))."
    return
  fi

  if port_open "$BACKEND_PORT"; then
    echo "Port $BACKEND_PORT is already in use; skipping backend start."
    return
  fi

  echo "Starting backend on :$BACKEND_PORT ..."
  (
    cd "$BACKEND_DIR"
    nohup "$BACKEND_DIR/venv/bin/uvicorn" main:app --host 0.0.0.0 --port "$BACKEND_PORT" < /dev/null >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
}

start_frontend() {
  local pid_file="$RUN_DIR/frontend.pid"
  local log_file="$RUN_DIR/frontend.log"

  require_cmd npm

  if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo "Frontend directory not found at $FRONTEND_DIR"
    exit 1
  fi

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "Missing frontend dependencies. Run: cd \"$FRONTEND_DIR\" && npm install"
    exit 1
  fi

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo "Frontend already running (PID $(cat "$pid_file"))."
    return
  fi

  if port_open "$FRONTEND_PORT"; then
    echo "Port $FRONTEND_PORT is already in use; skipping frontend start."
    return
  fi

  echo "Starting frontend on :$FRONTEND_PORT ..."
  (
    cd "$FRONTEND_DIR"
    nohup npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" < /dev/null >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
}

wait_for_http() {
  local url="$1"
  local label="$2"

  for _ in {1..40}; do
    if curl -sS "$url" >/dev/null 2>&1; then
      echo "$label is up: $url"
      return
    fi
    sleep 0.5
  done

  echo "$label did not become ready in time."
}

wait_for_pid() {
  local pid_file="$1"
  local label="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label PID file missing."
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  for _ in {1..20}; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  echo "$label process exited early. Check logs."
  return 1
}

require_cmd curl

ensure_vectorai
start_backend
start_frontend

wait_for_pid "$RUN_DIR/backend.pid" "Backend"
wait_for_pid "$RUN_DIR/frontend.pid" "Frontend"
wait_for_http "http://127.0.0.1:$BACKEND_PORT/health" "Backend"
wait_for_http "http://127.0.0.1:$FRONTEND_PORT" "Frontend"

echo "Done."
echo "Backend log:  $RUN_DIR/backend.log"
echo "Frontend log: $RUN_DIR/frontend.log"
