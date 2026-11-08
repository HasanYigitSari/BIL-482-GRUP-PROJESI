#!/usr/bin/env bash
# Shared lifecycle helpers are sourced by start.sh and clear.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOCAL="$ROOT/.local"
DATA="$LOCAL/postgres"
RUN="$LOCAL/run"
PYTHON="$BACKEND/.venv/bin/python"
VITE="$FRONTEND/node_modules/vite/bin/vite.js"

fail() {
    printf 'Inventory Manager — %s\n' "$*" >&2
    exit 1
}

initialize() {
    local action="$1"
    shift
    if [[ $# -eq 0 ]]; then
        # Python supplies a portable advisory lock on macOS and Linux. Only this
        # supervisor holds it, so background services cannot retain the lock.
        exec python3 - "$ROOT/scripts/stop.sh" "$ROOT/scripts/$action.sh" <<'PYTHON'
import fcntl
from pathlib import Path
import signal
import subprocess
import sys

with Path(sys.argv[1]).open() as lock:
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit("Inventory Manager — another lifecycle command is running. Wait for it to finish.")
    child = subprocess.Popen(["/bin/bash", sys.argv[2], "--locked"])
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda number, frame: child.send_signal(number))
    status = child.wait()
    sys.exit(status if status >= 0 else 128 - status)
PYTHON
    fi
    [[ $# -eq 1 && "$1" == --locked ]] || fail "Run make $action."
    local path
    for path in "$BACKEND" "$FRONTEND" "$LOCAL" "$DATA" "$RUN" "$BACKEND/.venv" "$FRONTEND/node_modules"; do
        [[ ! -L "$path" ]] || fail "Refusing to manage a symlinked project directory — $path"
    done
    cd "$ROOT"
    umask 077
    unset LOCAL_DEVELOPMENT DJANGO_SECRET_KEY DJANGO_SETTINGS_MODULE DJANGO_ALLOWED_HOSTS
    unset DB_NAME DB_USER DB_PASSWORD DB_HOST DB_PORT WEBAUTHN_RP_ID WEBAUTHN_ORIGIN
    export PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "$1 is missing from PATH. Install it or add its bin directory."
}

# Keep JSON state compatible with existing checkouts. Python handles process
# groups, ownership checks, and readiness without requiring jq or GNU setsid.
runtime() {
    python3 - "$ROOT" "$@" <<'PYTHON'
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener

ROOT = Path(sys.argv[1])
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
LOCAL = ROOT / ".local"
RUN = LOCAL / "run"
PYTHON = BACKEND / ".venv/bin/python"
VITE = FRONTEND / "node_modules/vite/bin/vite.js"
STATE = RUN / "processes.json"
INVENTORY_READY = RUN / "inventory.ready.json"
APP_NAMES = ("backend", "frontend", "inventory")
ENV = os.environ.copy()


def run(args, **kwargs):
    return subprocess.run([str(arg) for arg in args], cwd=ROOT, env=ENV, check=True, **kwargs)


def processes():
    result = run(["ps", "-axo", "pid=,pgid=,stat=,command="], capture_output=True, text=True)
    rows = {}
    for line in result.stdout.splitlines():
        fields = line.strip().split(None, 3)
        if len(fields) == 4 and not fields[2].startswith("Z"):
            rows[int(fields[0])] = {"group": int(fields[1]), "command": fields[3]}
    return rows


def matches(name, command):
    if name == "backend":
        return " -m uvicorn config.asgi:application " in command + " " and (
            command.startswith(f"{PYTHON} ") or f"--app-dir {BACKEND} " in command + " "
        )
    if name == "inventory":
        return (
            Path(command.split()[0]).name.lower().startswith("python")
            and f" {BACKEND / 'manage.py'} inventory_worker " in command + " "
        )
    return f" {VITE} " in command + " " and Path(command.split()[0]).name == "node"


def backend_worker(pid, command):
    if "multiprocessing.spawn" not in command and "multiprocessing.resource_tracker" not in command:
        return False
    # macOS may show Python's real executable instead of its virtualenv path.
    result = subprocess.run(
        ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"], capture_output=True, text=True,
    )
    return f"n{BACKEND}" in result.stdout.splitlines()


def load_state():
    if not STATE.exists():
        return {}
    try:
        data = json.loads(STATE.read_text())
        if not isinstance(data, dict) or any(
            name not in APP_NAMES or not isinstance(pid, int) or pid <= 1
            for name, pid in data.items()
        ):
            raise ValueError("invalid process state")
        return data
    except (ValueError, OSError) as exc:
        raise RuntimeError(f"Cannot read {STATE}. Preserving the runtime files for inspection.") from exc


def managed_groups(rows):
    groups = {}
    # Recover our launcher processes even if a PID file was lost during startup.
    for pid, row in rows.items():
        for name in APP_NAMES:
            if pid == row["group"] and matches(name, row["command"]):
                groups[name] = pid
    for name, group in load_state().items():
        members = {pid: row for pid, row in rows.items() if row["group"] == group}
        if not members:
            continue  # Stale state after a reboot or a normal process exit.
        # The reloader parent may have died while its Python worker remained alive.
        owned = any(matches(name, row["command"]) for row in members.values())
        if name == "backend":
            owned |= any(
                row["command"].startswith(f"{PYTHON} ") or backend_worker(pid, row["command"])
                for pid, row in members.items()
            )
        elif name == "frontend":
            owned |= any(row["command"].startswith(f"{FRONTEND}/node_modules/") for row in members.values())
        if not owned:
            continue  # The saved ID was reused by another program. Never signal it.
        groups[name] = group
    return groups


def stop_apps():
    groups = set(managed_groups(processes()).values())
    if os.getpgrp() in groups:
        raise RuntimeError("Refusing to signal the current terminal's process group.")
    for sig, timeout in ((signal.SIGTERM, 10), (signal.SIGKILL, 5)):
        groups.intersection_update(managed_groups(processes()).values())
        for group in groups:
            try:
                os.killpg(group, sig)
            except ProcessLookupError:
                pass
        deadline = time.monotonic() + timeout
        while groups and time.monotonic() < deadline:
            active = {row["group"] for row in processes().values()}
            groups.intersection_update(active)
            if groups:
                time.sleep(0.2)
        if not groups:
            break
    if groups:
        raise RuntimeError("Some app processes did not stop. Runtime files have been preserved.")
    STATE.unlink(missing_ok=True)
    INVENTORY_READY.unlink(missing_ok=True)


def port_available(port):
    # Check both loopback families, without claiming or killing anyone else's listener.
    for family, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        with socket.socket(family, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.3)
            if sock.connect_ex((host, port)) == 0:
                raise RuntimeError(f"Port {port} is already in use by another process. It was left untouched.")


def launch(name, args, cwd):
    log = LOCAL / f"{name}.log"
    with log.open("ab") as output:
        process = subprocess.Popen(
            [str(arg) for arg in args], cwd=cwd, env=ENV, stdin=subprocess.DEVNULL,
            stdout=output, stderr=subprocess.STDOUT, start_new_session=True,
        )
    try:
        state = load_state()
        state[name] = process.pid
        temporary = STATE.with_suffix(".tmp")
        temporary.write_text(json.dumps(state))
        temporary.replace(STATE)
    except BaseException:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=10)
        raise
    return process


def http_ready(url):
    opener = build_opener(ProxyHandler({}))
    try:
        with opener.open(url, timeout=1) as response:
            return response.status == 200
    except (URLError, TimeoutError, ConnectionError):
        return False


def wait_ready(url, pid):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        if pid not in processes():
            raise RuntimeError("An app server exited during startup. Check .local/backend.log and .local/frontend.log.")
        if http_ready(url):
            return
        time.sleep(0.2)
    raise RuntimeError(f"Startup timed out waiting for {url}. Check the logs in .local/.")


def inventory_ready(pid):
    try:
        data = json.loads(INVENTORY_READY.read_text())
        return isinstance(data, dict) and data.get("pid") == pid and 0 <= time.time() - data["heartbeat"] < 15
    except (OSError, ValueError, KeyError, TypeError):
        return False


def wait_inventory(pid):
    deadline = time.monotonic() + 25
    while time.monotonic() < deadline:
        if pid not in processes():
            raise RuntimeError("The inventory worker exited. Check .local/inventory.log.")
        if inventory_ready(pid):
            return
        time.sleep(0.2)
    raise RuntimeError("Inventory startup timed out. Check .local/inventory.log.")


try:
    action, *args = sys.argv[2:]
    if action == "stop-apps":
        stop_apps()
    elif action == "ports":
        for port in args:
            port_available(int(port))
    elif action == "fingerprint":
        print(hashlib.sha256(b"".join(Path(path).read_bytes() for path in args)).hexdigest())
    elif action == "launch":
        name, cwd, *command = args
        print(launch(name, command, cwd).pid)
    elif action == "wait-http":
        wait_ready(args[0], int(args[1]))
    elif action == "wait-inventory":
        wait_inventory(int(args[0]))
    elif action == "http":
        sys.exit(0 if http_ready(args[0]) else 1)
    elif action == "healthy":
        groups = managed_groups(processes())
        sys.exit(0 if len(groups) == 3 and inventory_ready(groups["inventory"]) else 1)
    elif action == "summary":
        groups = managed_groups(processes())
        postgres_pid = (LOCAL / "postgres/postmaster.pid").read_text().splitlines()[0]
        for label, pid, address in (
            ("PostgreSQL", postgres_pid, "127.0.0.1:5433 (port 5433)"),
            ("Inventory worker", groups["inventory"], "background worker"),
            ("Django API", groups["backend"], "http://127.0.0.1:8000 (port 8000)"),
            ("Frontend", groups["frontend"], "http://localhost:5173 (port 5173)"),
        ):
            print(f"  Running  {label:<18} PID {str(pid):<7} {address}")
    else:
        raise RuntimeError(f"Unknown runtime operation {action!r}.")
except (RuntimeError, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
    sys.exit(f"Inventory Manager — {error}")
PYTHON
}

database_running() {
    [[ -f "$DATA/PG_VERSION" ]] || return 1
    require_command pg_ctl
    local status=0
    pg_ctl -D "$DATA" status >/dev/null 2>&1 || status=$?
    case "$status" in
        0) return 0 ;;
        3) return 1 ;;
        *) fail "Could not determine this project's PostgreSQL status." ;;
    esac
}

stop_database() {
    if database_running; then
        pg_ctl -D "$DATA" stop -m fast -w -t 20 >/dev/null
    fi
}

stop_services() {
    runtime stop-apps
    stop_database
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    initialize stop "$@"
    stop_services
    printf 'Inventory Manager stopped. Accounts, inventory, and database files are preserved.\n'
fi
