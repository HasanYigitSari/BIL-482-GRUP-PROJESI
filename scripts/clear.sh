#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/stop.sh"
initialize clear "$@"

stop_services
rm -rf -- "$LOCAL" "$BACKEND/.venv" "$BACKEND/.env" "$FRONTEND/node_modules" "$FRONTEND/dist"
# Prune repository metadata and agent configuration, and never follow symlinks.
find "$ROOT" \( -name .git -o -name .agents -o -name .codex \) -prune -o \
    -name __pycache__ -prune -exec rm -rf -- {} + -o \
    -type f \( -name .DS_Store -o -name '*.pyc' -o -name '*.pyo' -o -name '*.tsbuildinfo' \) -exec rm -f -- {} +

printf 'Cleared the project database, dependencies, secrets, logs, builds, and caches.\n'
printf 'Source and lockfiles were kept. Run make start for a fresh environment.\n'
