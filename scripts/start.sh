#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/stop.sh"
initialize start "$@"

for command in python3 node npm initdb pg_ctl lsof ps; do
    require_command "$command"
done

show_services() {
    runtime summary
    printf '\nOpen http://localhost:5173\n'
    printf 'Logs are in .local/ — setup details in .local/startup.log\n'
    printf 'Stop with make stop\n'
}

was_running=false
if database_running; then
    was_running=true
fi
if "$was_running" && runtime healthy && runtime http http://localhost:5173/ && runtime http http://localhost:5173/api/v1/auth/csrf/; then
    printf 'Inventory Manager is already running.\n'
    show_services
    exit 0
fi

mkdir -p "$LOCAL" "$RUN"
STARTUP_LOG="$LOCAL/startup.log"
: > "$STARTUP_LOG"
# Keep errors visible even when a failed function has redirected its output.
exec 3>&2
started_database=false
step='stopping partial app processes'

startup_finished() {
    local status=$?
    trap - EXIT INT TERM
    if [[ "$status" -ne 0 ]]; then
        printf '\nStartup failed while %s. See %s\n' "$step" "$STARTUP_LOG" >&3
        if runtime stop-apps >> "$STARTUP_LOG" 2>&1; then
            if "$started_database"; then
                stop_database >> "$STARTUP_LOG" 2>&1 || printf 'PostgreSQL shutdown failed. See .local/startup.log\n' >&3
            fi
        else
            printf 'App shutdown failed. Runtime files are preserved. See .local/startup.log\n' >&3
        fi
    fi
    exit "$status"
}
trap startup_finished EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

prepare_dependencies() {
    if [[ ! -x "$PYTHON" ]]; then
        python3 -m venv "$BACKEND/.venv"
    fi
    local digest
    digest="$(runtime fingerprint "$BACKEND/requirements.txt")"
    if [[ ! -x "$BACKEND/.venv/bin/uvicorn" || ! -f "$LOCAL/python-dependencies.sha256" || "$(cat "$LOCAL/python-dependencies.sha256")" != "$digest" ]]; then
        "$PYTHON" -m pip install --cache-dir "$LOCAL/pip-cache" -r "$BACKEND/requirements.txt"
        printf '%s' "$digest" > "$LOCAL/python-dependencies.sha256"
    fi
    digest="$(runtime fingerprint "$FRONTEND/package.json" "$FRONTEND/package-lock.json")"
    if [[ ! -f "$VITE" || ! -f "$LOCAL/node-dependencies.sha256" || "$(cat "$LOCAL/node-dependencies.sha256")" != "$digest" ]]; then
        npm --prefix "$FRONTEND" ci --cache "$LOCAL/npm-cache" --no-fund
        printf '%s' "$digest" > "$LOCAL/node-dependencies.sha256"
    fi
}

printf 'Starting Inventory Manager…\n'
runtime stop-apps >> "$STARTUP_LOG" 2>&1
step='checking local ports'
runtime ports 8000 5173 >> "$STARTUP_LOG" 2>&1
if ! "$was_running"; then
    runtime ports 5433 >> "$STARTUP_LOG" 2>&1
fi
step='preparing dependencies'
prepare_dependencies >> "$STARTUP_LOG" 2>&1
step='preparing local configuration'
"$PYTHON" "$BACKEND/setup_local.py" >> "$STARTUP_LOG" 2>&1
if ! "$was_running"; then
    step='starting PostgreSQL'
    started_database=true
    pg_ctl -D "$DATA" -l "$LOCAL/postgres.log" start -w -t 20 >> "$STARTUP_LOG" 2>&1
fi
step='preparing the application database'
"$PYTHON" "$BACKEND/setup_local.py" --database >> "$STARTUP_LOG" 2>&1
step='applying migrations'
"$PYTHON" "$BACKEND/manage.py" migrate --noinput >> "$STARTUP_LOG" 2>&1

step='starting the inventory worker'
rm -f "$RUN/inventory.ready.json"
inventory_pid="$(runtime launch inventory "$BACKEND" "$PYTHON" "$BACKEND/manage.py" inventory_worker 2>> "$STARTUP_LOG")"
runtime wait-inventory "$inventory_pid" >> "$STARTUP_LOG" 2>&1
step='starting the Django API'
backend_pid="$(runtime launch backend "$BACKEND" "$PYTHON" -m uvicorn config.asgi:application --app-dir "$BACKEND" --host 127.0.0.1 --port 8000 --no-proxy-headers --reload 2>> "$STARTUP_LOG")"
runtime wait-http http://127.0.0.1:8000/api/v1/auth/csrf/ "$backend_pid" >> "$STARTUP_LOG" 2>&1
step='starting the frontend'
frontend_pid="$(runtime launch frontend "$FRONTEND" "$(command -v node)" "$VITE" 2>> "$STARTUP_LOG")"
runtime wait-http http://localhost:5173/ "$frontend_pid" >> "$STARTUP_LOG" 2>&1
step='checking service readiness'
runtime wait-http http://localhost:5173/api/v1/auth/csrf/ "$backend_pid" >> "$STARTUP_LOG" 2>&1
runtime healthy >> "$STARTUP_LOG" 2>&1
show_services
