# Local runtime

Inventory Manager uses existing Python, Node and Homebrew PostgreSQL installations. It creates its own dependencies, configuration and database storage inside the project. The inventory worker uses the same Python environment; no Docker, external queue, or boot-time job is used. See the [project README](../../README.md) for commands and the manual walkthrough.

## Process and network boundaries

| Component | Local endpoint | Owner |
| --- | --- | --- |
| React / Vite | `http://localhost:5173` | [vite.config.ts](../../frontend/vite.config.ts), launched by [start.sh](../../scripts/start.sh) |
| Django / Uvicorn | `http://127.0.0.1:8000` | [config/asgi.py](../../backend/config/asgi.py), launched with reload and `--no-proxy-headers` |
| Inventory worker | No listening port | [inventory_worker.py](../../backend/api/management/commands/inventory_worker.py), launched as a separate Python process |
| PostgreSQL | `127.0.0.1:5433`; Unix socket in `.local/run/` | Project cluster in `.local/postgres/` |

Vite proxies `/api/` to Uvicorn without rewriting the host. Open the site through `localhost:5173`, not a `file://` page or another hostname. Ports are fixed. The lifecycle script refuses occupied ports rather than terminating unrelated listeners or choosing another port.

## Configuration and persistent state

[setup_local.py](../../backend/setup_local.py) generates `backend/.env` from [.env.example](../../backend/.env.example), with random Django and database secrets and file mode `0600`. Its default invocation initializes PostgreSQL with SCRAM authentication and loopback-only TCP access. After `start.sh` starts the cluster, `setup_local.py --database` connects through the project socket, verifies the database storage directory, and creates the application database if needed. Service startup and migration execution belong to `start.sh`. If the database directory exists and `.env` is missing, setup refuses to invent replacement credentials.

The local database and PostgreSQL role are both named `inventory_manager`. The cluster includes `inventory-manager-local.conf`, which supplies the loopback address, port and Unix socket location inside the checkout. Lifecycle paths are resolved from the repository's location, so the checkout can be moved before the first startup without changing source configuration.

The BIL-482-GRUP-PROJESI checkout creates its own `.local/`, environment file, and dependencies on its first `make start`. Existing accounts and inventory belong to the database of the checkout where they were created. To switch from the original `inventory-manager` checkout, run `make stop` there before starting this copy. Both use ports `5173`, `8000`, and `5433`.

[settings.py](../../backend/config/settings.py) loads the environment and configures Django. `LOCAL_DEVELOPMENT=true` enables debug mode, HTTP cookies and the shared inventory simulation endpoints, and requires the exact local RP/origin. Outside that mode, demo endpoints return `404`, HTTPS origin and explicit allowed hosts are required, Secure cookies and HTTPS redirects are enabled, and debug is disabled. Public deployment is not configured or verified.

The shell scripts remove inherited app/database configuration variables from their child environment so a different project's settings do not redirect local operations. Database preparation checks PostgreSQL's actual `data_directory` before creating the application database.

| Location | Contents |
| --- | --- |
| `.local/postgres/` | Permanent local PostgreSQL cluster, including accounts, public credentials, sessions, orders, items, acquisition jobs and simulation controls. |
| `.local/run/processes.json` | Backend/frontend/inventory process group IDs; Unix sockets also use `.local/run/`. |
| `.local/run/inventory.ready.json` | Worker PID and heartbeat timestamp, written atomically after acquiring its database lock and checking seed data. |
| `.local/*.log` | Backend, frontend, inventory and PostgreSQL logs. Worker output goes to `.local/inventory.log`. |
| `.local/startup.log` | Dependency installation, configuration, cluster startup, migration output, and startup failure details. Replaced for each startup attempt that prepares services. |
| `.local/` caches and stamps | Pip/npm caches and dependency-file hashes used to decide when installation is needed. |
| `backend/.env`, `backend/.venv/` | Generated secrets/configuration and Python dependencies. |
| `frontend/node_modules/`, `frontend/dist/` | Installed frontend dependencies and optional build output. |

These generated files are ignored by [.gitignore](../../.gitignore). The Homebrew executables are reused, but its existing database cluster and global packages are not managed by this project.

## Lifecycle contract

[makefile](../../makefile) invokes three Bash scripts, [start.sh](../../scripts/start.sh), [stop.sh](../../scripts/stop.sh), and [clear.sh](../../scripts/clear.sh). Start and clear source shared helpers from `stop.sh`. Each entry point resolves paths from its own checkout, so direct execution also works from another directory.

A Python supervisor holds a nonblocking file lock on `stop.sh` for the duration of each command. Background services do not inherit the lock. Embedded Python helpers provide process-group ownership checks, atomic JSON state writes, service launch, and readiness probes using the existing Python installation. The process-state format remains compatible with the previous lifecycle implementation. Symlink checks protect managed directories.

Startup prints a concise summary of PostgreSQL, the inventory worker, the Django API, and Vite after readiness checks pass. The summary includes process IDs and the addresses of network services. Setup output is redirected to `.local/startup.log`, while service output stays in each service's log. Failures identify the startup step and log location, and trigger cleanup of partial startup. Repeated starts of healthy services print the same service details without rerunning setup.

- **`make start`:** Reuse healthy running services only when all three app processes, worker heartbeat and HTTP routes are healthy. Otherwise stop partial app processes, check ports, install missing/changed dependencies, prepare configuration/cluster, start PostgreSQL if needed, ensure the application database exists, and apply migrations. Launch the inventory worker, Uvicorn and Vite in separate background process groups. Wait for worker readiness and HTTP readiness, including the proxy route; recheck the worker before reporting success. A failure stops the apps and then any database started by that invocation, retaining files/logs. A database already running before that invocation is preserved on failure. If app shutdown fails, preserve the database and files for inspection.
- **`make stop`:** Identify project-owned processes using saved IDs and command/cwd checks, stop their process groups (including the inventory worker and reload workers), then stop the project cluster using PostgreSQL's fast shutdown. If app shutdown cannot be confirmed, do not proceed to database shutdown. Reject uncertain ownership rather than signal another application. Preserve data, secrets and dependencies. Repeated stops are supported.
- **`make clear`:** Successfully stop first, then remove `.local/`, `backend/.env`, `backend/.venv/`, `frontend/node_modules/`, `frontend/dist/`, Python/TypeScript compiler artifacts and `.DS_Store` files. Preserve source, documentation, migrations and dependency lockfiles. The next start rebuilds a fresh environment and seeds the product/control records. This permanently removes project accounts, inventory, orders, jobs and controls; it cannot remove saved passkeys from users' providers.

The worker announces readiness only after obtaining its PostgreSQL session advisory lock and finding the migrated seed records. The lifecycle script checks a matching PID and heartbeat less than 15 seconds old. Readiness means the worker can process jobs, not that stock is already full. Replenishment happens asynchronously. Its heartbeat runs between work passes; the mock's two-second calls fit within the readiness window. See [inventory.md](inventory.md) for job recovery and lock-loss behavior. The worker does not hot reload; use `make stop` then `make start` after changing worker code.

Start is the explicit action that installs dependencies, changes the database and runs servers. Documentation or static inspection should not trigger it. Stop and clear also need sufficient host process visibility; a sandbox-denied process listing is not proof that services are stopped.

## Maintenance and verification

- Schema changes require Django migrations under [api/migrations/](../../backend/api/migrations/); `make start` applies them.
- With the database running, `backend/.venv/bin/python backend/manage.py cleanup_auth` deletes expired ceremonies/sessions and rate-limit windows older than two minutes. The command is manual; no scheduler is installed.
- The README's Bash syntax checks work before dependencies are installed. Django checks, Python compilation, TypeScript checks, and the frontend build use the prepared dependencies and configuration and can run with services stopped. After `make clear`, those prerequisites must be recreated.
- Browser passkey prompts require manual verification with a compatible authenticator. Inventory allocation, concurrent users, retry/restart behavior and lifecycle commands require the README's live walkthrough after authorized startup. There are no automated tests or test dependencies.
- Production hosting, trusted proxy handling, backup/restore operations and monitoring remain outside the implemented local runtime. The existence of non-development settings does not make `make start` a production deployment command.
