#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED=0
[[ "${1:-}" == "--seed" ]] && SEED=1

echo "== Backend =="
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  if command -v python3.12 >/dev/null 2>&1; then python3.12 -m venv .venv; else python3 -m venv .venv; fi
fi
PY="$ROOT/backend/.venv/bin/python"
"$PY" -m pip install --upgrade pip
"$PY" -m pip install -r requirements-dev.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  KEY="$("$PY" -c 'import secrets; print(secrets.token_urlsafe(50))')"
  sed -i.bak "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${KEY}|" .env && rm -f .env.bak
  echo "backend/.env creado con una SECRET_KEY nueva."
fi

"$PY" manage.py migrate
if [[ "$SEED" == "1" ]]; then "$PY" manage.py seed_scifi_catalog; fi

echo "== Frontend =="
cd "$ROOT/frontend"
[[ -f .env ]] || cp .env.example .env
npm install

echo
echo "Instalacion completada."
echo "Crea un administrador:  backend/.venv/bin/python backend/manage.py createsuperuser"
echo "Arranca el entorno:     ./scripts/dev.sh"
