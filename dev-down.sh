#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$REPO_ROOT/.run"
VECTOR_CONTAINER="vectoraidb"

stop_pid_file() {
  local pid_file="$1"
  local label="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label PID file not found."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping $label (PID $pid)..."
    kill "$pid" >/dev/null 2>&1 || true
  else
    echo "$label PID $pid is not running."
  fi

  rm -f "$pid_file"
}

stop_pid_file "$RUN_DIR/backend.pid" "backend"
stop_pid_file "$RUN_DIR/frontend.pid" "frontend"

if command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -qx "$VECTOR_CONTAINER"; then
    echo "Stopping VectorAI container ($VECTOR_CONTAINER)..."
    docker stop "$VECTOR_CONTAINER" >/dev/null
  else
    echo "VectorAI container is not running."
  fi
else
  echo "docker not found; skipped VectorAI stop."
fi

echo "Done."
