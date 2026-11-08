# Inventory and replenishment

One product, **Demo digital link**, demonstrates delivery from stored inventory and automatic replacement. Each order requests one item. URLs under `https://example.invalid/items/` are nonfunctional demonstration data. There are no payments, real integrations, cancellations, redemption checks or expiry rules. Return to the [architecture index](README.md) for surrounding components.

## Ownership and storage

The existing Django `api` app owns the schema in [models.py](../../backend/api/models.py). [0002_inventory.py](../../backend/api/migrations/0002_inventory.py) adds the inventory tables and seeds product code `demo-link`, target stock `3`, and the singleton mock control. It does not modify existing accounts or passkeys.

| Record | Responsibility and database rules |
| --- | --- |
| `Product` | Unique code, display name, nonnegative available-stock target, provider key and provider product reference. |
| `InventoryItem` | Product, URL, provider key/reference, creation time and a one-to-one acquisition link for provenance. Provider references are unique within a provider. Availability means no order references the item; there is no separately maintained stock counter. |
| `Order` | Owner, product, client request UUID, status, optional one-to-one item and timestamps. `(user, request_id)` is unique. A check requires pending orders to have no item/fulfillment time and fulfilled orders to have both. An item can belong to only one order. |
| `AcquisitionJob` | UUID doubles as the stable provider request ID. Stores the product, a snapshot of its provider mapping, state, attempt count, retry time and a sanitized error code. A partial unique constraint permits at most one unfinished job per product, including blocked jobs. |
| `MockProviderControl` | Singleton row `1`, holding shared pause and fail-next flags. Both survive process restarts. |

Items, orders and successful jobs remain stored. Protected foreign keys preserve their ownership/provenance chain; there is no deletion endpoint. Item/product consistency is maintained by the allocation service. Counts come from database queries, so polling summaries are advisory and can change between requests.

## Ordering and allocation

[services.py](../../backend/api/inventory/services.py) owns all allocation. Within one short transaction, `place_order`:

1. Locks the requesting user row and checks `(user, request_id)`. This serializes retries even when two requests specify different products. A matching replay returns the existing order; a different product returns `409 request_conflict`.
2. Locks the product row and creates the new pending order.
3. Assigns available items to pending orders ordered by `(created_at, id)`. Existing waiting orders therefore precede a new request, even if new stock is available.
4. Ensures a durable acquisition job exists if any order is pending or available stock is below target, then commits before returning the order.

The worker and demo mutations also lock the product before changing allocation or acquisition state. The common lock order is user (ordering only), product, then mock control when needed. Provider calls never run inside these transactions. Database uniqueness constraints are the final guard against duplicate items, orders and unfinished jobs.

## Worker and recovery

[inventory_worker.py](../../backend/api/management/commands/inventory_worker.py) runs [worker.py](../../backend/api/inventory/worker.py). One PostgreSQL **session advisory lock** allows only one active worker for this database. The worker retains its original database connection and verifies lock ownership before work and after provider calls. A lost session or lock terminates the process; it does not reconnect and continue without ownership. `make start` can restart a failed worker. There is no automatic process supervisor.

Each loop fulfills waiting orders from existing stock first. If supply is needed, it claims one acquisition, commits, calls the provider, and then performs one transaction to store the item, mark the job successful, fulfill waiting orders and enqueue the next acquisition if needed. The loop waits one second between passes; each mock attempt takes two seconds. Fresh stock therefore fills asynchronously after startup.

```text
queued → running → succeeded
             ├──→ retry → running
             └──→ blocked → explicit retry → running
```

Temporary failures retry the same job after 5, 10, 20, 40, then 60 seconds, capped at 60. Invalid responses, duplicate provider items and permanent/unexpected provider errors block the job. Only fixed error codes/messages are exposed or logged, never raw provider exceptions or delivered URLs. A blocked job prevents more acquisitions for that product until explicitly retried.

An interrupted `running` job is reclaimed with its original UUID after restart. If the provider returned an item but the database transaction did not commit, the same provider request recovers that item. Successful item storage, assignment and job completion commit together. SIGTERM/SIGINT let the current attempt finish before exit; forced termination leaves durable work for the next worker.

Pause prevents new provider attempts while existing inventory still fulfills orders. An underway attempt can finish. Lowering the target never removes inventory; an unattempted queued job can remain dormant until needed. An already attempted job is resolved with its original ID, including after restart or retry, even if the target was lowered. Pending demand always takes priority over the available-stock buffer, including when the target is zero.

## Provider boundary

[providers.py](../../backend/api/inventory/providers.py) defines `acquire(product_reference, request_id)` returning a `ProviderItem(reference, url)`. The registry maps the product's provider key to its adapter; jobs snapshot this mapping so later configuration changes cannot redirect retries.

The mock makes no network calls. It deterministically derives its item reference and URL from the acquisition UUID, so the same request returns the same item after restart. The worker consumes the fail-next flag when claiming an attempt; that attempt raises a temporary error after the normal two-second delay. A process interruption can consume the flag before the simulated error is recorded. Adapter output must have a nonempty bounded reference and an HTTPS URL without embedded credentials.

Future real adapters must support equivalent durable idempotency or reconciliation before they are usable here. No claim of exactly-once purchasing is made for a provider without that capability. The current mock URLs are not secrets with real value; handling real digital products will require a separate security and retention review.

## HTTP contract

[urls.py](../../backend/api/inventory/urls.py), [views.py](../../backend/api/inventory/views.py) and [serializers.py](../../backend/api/inventory/serializers.py) define these routes under `/api/v1/`. All require an active session and return `Cache-Control: no-store`; POSTs use the existing CSRF enforcement. Handled errors use the shared `{code, message}` shape.

| Method and path | Contract |
| --- | --- |
| `GET products/` | `{products: [{id, code, name, available_count}]}`. Seeded with one product. |
| `POST orders/` | Accepts `{product_id, request_id}` (UUID). Returns `{order}` with `201` for a new order or `200` for a replay. Unknown product: `404`; invalid input: `400`; request/product conflict: `409`. |
| `GET orders/?page=1` | Current user's orders only, newest `(created_at, id)` first, 20 per page: `{count, next, previous, results}`. |
| `GET demo/inventory/` | `{paused, fail_next, products}`. Each product has `id`, `name`, `target_stock`, `available_count`, `pending_count`, `fulfilled_count`, and `acquisition` or `null`. |
| `POST demo/inventory/` | Accepts `{product_id, action, target_stock?}`; returns the same summary. Actions: `pause`, `resume`, `fail_next`, `set_target`, `retry`. Only `set_target` accepts/requires an integer target (0–2147483647). `retry` returns `409` unless a job is blocked. |

An order has `id`, `product_id`, `product_name`, `status`, `url`, `created_at`, and `fulfilled_at`. URL and fulfillment time are null while pending. Order queries and replay lookup are always scoped to the authenticated owner. Summaries contain no URLs, provider request IDs or other users' order records.

Acquisition summaries expose `state`, `attempts`, `retry_at`, `error_code`, `message`, and `updated_at` for the unfinished job. Demo endpoints return `404` unless `LOCAL_DEVELOPMENT=true`. Their controls and aggregate counts are intentionally shared across signed-in local users; they are not a production administration API.

## Frontend and local verification

[Inventory.tsx](../../frontend/src/components/Inventory.tsx) adds the product and paginated order history to the account page. [InventoryDemo.tsx](../../frontend/src/components/InventoryDemo.tsx) contains the local controls. [lib/inventory.ts](../../frontend/src/lib/inventory.ts) defines API types and calls the shared [api.ts](../../frontend/src/lib/api.ts) helper.

Visible data refreshes two seconds after the preceding batch settles. Requests within a batch run together; batches do not overlap, including on failure. Hiding or unmounting the page cancels requests and polling; returning to the page refreshes immediately. A `404` demo response hides the panel. Session expiry uses the shared authentication event and redirects to signin.

Before submitting, the component persists `{product_id, request_id}` in `sessionStorage` under `inventory-manager:order-request:<userId>`. An ambiguous failure or refresh preserves it and shows **Retry last order**. A successful response clears it; a later explicit order click creates a new UUID. Definitive `400`/`404`/`409` responses clear the rejected request. Writable session storage is required to submit. Storage is tab-scoped: closing/clearing the tab loses this retry aid, while committed orders remain in the database and order history.

Delivered URLs are shown as copyable text, labeled nonfunctional, rather than navigation links. Runtime integration, readiness and logs are documented in [local-runtime.md](local-runtime.md). Static checks and the manual scenarios to run after authorized startup are in the [README](../../README.md#inventory-walkthrough). Automated tests remain deferred.
