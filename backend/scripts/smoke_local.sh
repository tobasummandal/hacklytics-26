#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8000}"
WEB_BASE="${WEB_BASE:-http://127.0.0.1:5173}"

echo "[smoke] checking backend health..."
curl -fsS "${API_BASE}/health" >/dev/null

echo "[smoke] checking frontend..."
curl -fsS -I "${WEB_BASE}" >/dev/null

echo "[smoke] checking graph endpoints..."
curl -fsS "${API_BASE}/graph?limit_nodes=50&limit_edges=100" >/dev/null
curl -fsS "${API_BASE}/graph/cytoscape?limit_nodes=50&limit_edges=100" >/dev/null

echo "[smoke] checking metrics..."
curl -fsS "${API_BASE}/metrics" >/dev/null

echo "[smoke] all checks passed."
