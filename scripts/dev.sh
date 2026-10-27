#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY="$ROOT/backend/.venv/bin/python"

[[ -x "$PY" ]] || { echo "Entorno no instalado. Ejecuta primero ./scripts/setup.sh" >&2; exit 1; }

(cd "$ROOT/backend" && "$PY" manage.py runserver 8000) &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

echo "Backend:  http://localhost:8000  (Swagger: /api/docs/)"
echo "Frontend: http://localhost:5173  (Ctrl+C para detener ambos)"
cd "$ROOT/frontend" && npm run dev
