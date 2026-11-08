# Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama Sistemi

This course project develops a digital inventory and order fulfillment system for one organization. Its goal is to store unique digital products, assign them to customers, and replenish shared inventory according to demand. This repository includes the course documents and the runnable **Inventory Manager** prototype.

## Group 1 — Members

| Name             | Student Number |
| ---------------- | -------------- |
| Ömer Kılınç      | 261111011      |
| Deren Berk       | 221101068      |
| Hasan Yiğit Sarı | 231101050      |

## Current implementation

The prototype uses React, TypeScript, and Vite for the browser UI, Django REST Framework and WebAuthn for the API and passkey accounts, and PostgreSQL for persistent data. A separate Python worker fulfills pending orders and replenishes stock.

- Create an account and sign in with a passkey.
- View shared stock for one demo digital product and place orders from your account.
- Receive an available item immediately, or wait for fulfillment when stock is empty. Pending orders are fulfilled oldest first.
- View your own order history and assigned demo links. Each inventory item is delivered at most once.
- Replenish stock toward a configurable target, initially three items, with durable acquisition jobs and retries.
- Use the shared local simulation controls to pause supply, change the target, and exercise failure recovery.

The existing course specifications describe a broader system with Viewer, Operator, and Administrator roles, customer records, encrypted digital codes, adaptive replenishment policies, and a proposed FastAPI backend. In the current Django prototype, signed-in users order mock links for themselves, and a configured stock target drives replenishment. The [architecture guides](docs/architecture/README.md) document implemented behavior, and the [course documents](#documentation) describe the intended project requirements.

Demo links use `example.invalid` and are nonfunctional. Account recovery, backup passkeys, real supplier integrations, payments, production deployment, and automated tests are deferred. Use development accounts, since losing the only passkey currently means losing access to that account.

## Prerequisites

Use Python 3.14, Node.js 24 with npm, PostgreSQL 17, and a current browser with a passkey provider or compatible security key. The local setup uses macOS with Homebrew PostgreSQL and requires `make`, `bash`, `python3`, `node`, `npm`, `initdb`, `pg_ctl`, `ps`, and `lsof` on `PATH`. The lifecycle scripts use POSIX process management and Unix sockets.

The first startup needs internet access to install the pinned Python and Node dependencies. The frontend and backend dependencies, local secrets, and project database are prepared by `make start`.

## Run locally

From the directory containing this checkout, run the following commands.

```sh
cd BIL-482-GRUP-PROJESI
make start
```

If the original `inventory-manager` checkout is running, run `make stop` from that checkout first. Both checkouts use the same local ports. Each checkout creates its own database and configuration, so the first start here creates a fresh environment and accounts must be registered here.

Open [http://localhost:5173](http://localhost:5173) using that exact hostname and port for passkey authentication. The services run in the background and the command returns to your terminal.

Startup prints a concise service summary with process IDs and local addresses after readiness checks pass. Dependency installation, configuration, database initialization, and migration output go to `.local/startup.log`. A failed startup prints the failed step and the log location. Running `make start` again shows the status of healthy existing services.

Run all lifecycle commands from this repository's root.

| Command      | What it does                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make start` | Installs missing or changed dependencies, prepares local secrets and PostgreSQL, creates the database if needed, applies migrations, and starts the inventory worker, backend and frontend in the background.              |
| `make stop`  | Stops the worker, frontend and backend (including reload workers), then this project's PostgreSQL. Preserves accounts, inventory, orders, secrets, and installed dependencies. Safe to repeat.                             |
| `make clear` | Stops everything first, then permanently deletes this project's database, generated secrets, installed dependencies, logs, builds, and caches. Source, migrations, and dependency lockfiles are preserved. Safe to repeat. |

These commands invoke [start.sh](scripts/start.sh), [stop.sh](scripts/stop.sh), and [clear.sh](scripts/clear.sh), respectively. Each shell script also works when invoked directly from another directory.

`make start` works both after `make stop` and after `make clear`. It preserves an existing database, reuses healthy running services, and repairs partial startup by restarting the app processes. Startup failures stop the app processes and any database newly started by that invocation. Logs are retained for inspection.

| Component | Local address |
| --- | --- |
| Browser UI | `http://localhost:5173` |
| Django API | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:5433` |

Vite forwards browser requests under `/api/` to Django. The inventory worker runs as a separate process. An occupied port causes startup to report an error.

Database storage lives in `.local/postgres`, with process state and worker readiness under `.local/run`. Setup output goes to `.local/startup.log`, and service logs go to `.local/backend.log`, `.local/frontend.log`, `.local/inventory.log`, and `.local/postgres.log`. Dependencies and configuration live in `backend/.venv`, `frontend/node_modules`, and `backend/.env`. Git ignores these generated files, local `.env` variants, `.DS_Store`, and `AGENTS.md`. The placeholder `backend/.env.example` is tracked. The project manages its own PostgreSQL cluster using the installed PostgreSQL executables.

Stock fills asynchronously after startup, taking roughly ten seconds from empty under normal conditions. Use `make stop` followed by `make start` to load changes to worker code. The web servers hot reload.

**Clear is a full local reset:** it removes all accounts, inventory, orders, acquisition jobs and simulation settings, plus `backend/.env`, `backend/.venv`, `frontend/node_modules`, and `frontend/dist`. The next start recreates the environment with the default product and stock target. Passkeys saved in your device or password manager cannot be removed by a project script; after clearing, those old passkeys no longer have an account here.

## Checks and manual walkthrough

With dependencies and local configuration prepared, these checks work with all services stopped. After `make clear`, those prerequisites must be recreated first:

```sh
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python -m compileall -q backend/config backend/api backend/manage.py backend/setup_local.py
for script in scripts/*.sh; do bash -n "$script"; done
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

After starting the app, manually:

1. Create a username and approve the passkey prompt. Confirm the account page shows the username.
2. Refresh and confirm you remain signed in.
3. Sign out; visiting `/account` should return you to signin.
4. Sign in with the saved passkey and confirm the same account appears.
5. While signed out, try the same username with different letter casing; it must be rejected.
6. Cancel a passkey prompt and retry. Cancellation must not create an account.
7. In a separate signed-out browser session, `/api/v1/auth/me/` should return HTTP 401.

### Inventory walkthrough

These are manual scenarios to run after starting the app; static checks do not verify live allocation or migrations.

1. On the account page, wait for **Demo digital link** to show three available. Order once: a link should appear immediately in **My orders**, then stock should return to three. Copy the link; it is deliberately nonfunctional.
2. Open **Local simulation**, pause supply, and wait for any underway attempt to finish. Order until stock is empty, then place two more orders. They should remain pending. Refresh: the orders and pause setting should remain.
3. Resume supply. The oldest pending order should become ready first, then the next; afterward available stock should return to three. Orders are displayed newest first, so compare their order numbers/timestamps.
4. With full stock, choose **Fail next attempt**, then order. The replacement should enter retry with a five-second delay and then succeed. The resulting stock count should be three, with no duplicate delivered item. Logs show sanitized acquisition IDs/statuses.
5. To check replay, use browser developer tools to resend an `orders/` POST with the same `product_id`, `request_id`, session and CSRF token. Expect `200` and the same order ID; a new UUID returns `201`. After an ambiguous network failure or refresh during submission, use **Retry last order** in the page. It retains the original UUID. An expired CSRF token requires a fresh token from `/api/v1/auth/csrf/` before a manual resend.
6. Use two browser profiles with different signed-in accounts and order concurrently. Each must receive a distinct URL and see only its own history. A signed-out `/api/v1/orders/` request must return `401`. Demo controls/counts are intentionally shared locally and never list other users' links.
7. During an acquisition, run `make stop`, then `make start`. A graceful stop may finish the attempt first; committed orders and items must survive. For an abrupt-interruption check, find the current `inventory` PID in `.local/run/processes.json`, terminate only that worker with `kill -KILL <worker-pid>` while an attempt is running, then use `make start`. Compare `acquisition_started` entries in `.local/inventory.log`: the interrupted job must resume with the same UUID and a higher attempt count. Already completed jobs must not be acquired again.
8. Lower the stock target: existing inventory stays. With target zero, pending demand still causes acquisition. Restore target three afterward. Retry a blocked job with **Retry acquisition** if a permanent configuration/result error occurs; the fail-next control deliberately creates a temporary failure only.
9. `make stop` must stop the worker and both web servers before the project database. When you intentionally want a full reset, `make clear` must remove all inventory/runtime state; the next start seeds fresh defaults. Neither command manages the existing Homebrew cluster.

No automated tests or test dependencies are included. Browser/authenticator behavior, database constraints, concurrency and restart recovery require live manual verification after startup.

## Documentation

The numbered course documents are in `docs/`, assignment briefs and policies are in `docs/assignments/`, and supporting artwork is in `docs/_assets/`.

| Document | Purpose |
| --- | --- |
| [Project summary](docs/assignments/project-summary.md) | Overall project goals and planned scope. |
| [Project definition](docs/1_Project%20Definition%20Document.md) | Objectives, audience, features, and success criteria. |
| [Project plan](docs/2_Project%20Plan%20Document.md) | Course delivery plan and responsibilities. |
| [Software requirements](docs/3_Software%20Requirements%20Specification%20Document.md) | Requirements, use cases, and associated diagrams. |
| [Software design document](docs/4_Software%20Design%20Document.md) | PA2 draft for UC-04, including current design, remaining requirements, traceability, and an embedded document task matrix. |
| [PA1 assignment brief](docs/assignments/Project_Assignment_1.pdf) | Original planning and requirements assignment. |
| [PA2 assignment brief](docs/assignments/Project_Assignment_2.pdf) | Selected use case implementation and software design deliverables. |
| [Assignment policy](docs/assignments/assignment-policy.md) | Group contributions and evaluation requirements. |

Implementation documentation accompanies the application source.

| Document | Purpose |
| --- | --- |
| [Architecture index](docs/architecture/README.md) | Implemented system, component responsibilities, and source locations. |
| [Authentication](docs/architecture/authentication.md) | Account model, API, passkey flows, and sessions. |
| [Inventory](docs/architecture/inventory.md) | Allocation, replenishment, retries, and simulation controls. |
| [Local runtime](docs/architecture/local-runtime.md) | Configuration, processes, database storage, and maintenance. |

The imported [notes](docs/notes/) and [initial implementation plan](docs/architecture/1_initial-setup-plan.md) preserve exploratory designs and earlier planning. They may discuss ideas beyond the current implementation. Consult the architecture guides for current behavior.
