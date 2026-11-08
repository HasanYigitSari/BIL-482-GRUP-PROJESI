# Software Design Document

**Project:** DAFS: Demand-Adaptive Inventory and Instant Order Fulfillment System  
**Assignment:** Project Assignment 2  
**Selected use case:** UC-04 — Replenish inventory from suppliers  
**Document version:** 0.3  
**Date:** 8 November 2026  
**Status:** Draft describing the current implementation and the remaining work for UC-04.

UC-04 replenishes digital inventory in the background. This draft describes the current prototype; Adapter, Strategy, two supplier interfaces, adaptive demand evaluation, and encrypted storage remain incomplete.

## Document Contributors

Contribution details will be completed by the team.

| Full name | Student number | Contribution to this document |
| --- | --- | --- |
| Ömer Kılınç | 261111011 | |
| Deren Berk | 221101068 | |
| Hasan Yiğit Sarı | 231101050 | |

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Context](#2-system-context)
3. [Key Features and Functionality](#3-key-features-and-functionality)
4. [Assumptions and Dependencies](#4-assumptions-and-dependencies)
5. [Architectural Design](#5-architectural-design)
6. [Component Design](#6-component-design)
7. [Data Design](#7-data-design)
8. [Design Patterns](#8-design-patterns)
9. [Implementation Notes](#9-implementation-notes)
10. [User Interface Design](#10-user-interface-design)
11. [External Interfaces](#11-external-interfaces)
12. [Performance Considerations](#12-performance-considerations)
13. [Error Handling and Logging](#13-error-handling-and-logging)
14. [Design for Testability](#14-design-for-testability)
15. [Deployment and Installation Design](#15-deployment-and-installation-design)
16. [Change Log](#16-change-log)
17. [Future Work / Open Issues](#17-future-work--open-issues)

- [Appendix A — Task Matrices](#appendix-a--task-matrices)
- [Appendix B — Requirements and Test Traceability](#appendix-b--requirements-and-test-traceability)
- [References](#references)

Sections 1–17 follow the PA2 outline. Diagram descriptions below will be replaced with images prepared by the team.

## 1. System Overview

DAFS manages shared digital inventory for one organization. UC-04 replenishes stock through suppliers while preserving existing items and assignments. The [SRS](3_Software%20Requirements%20Specification%20Document.md), Sections 6.4 and 10.5, maps this use case to Adapter, supported by Strategy.

The current application uses React/TypeScript/Vite, Django REST Framework, PostgreSQL, and a separate Python inventory worker. It demonstrates replenishment of one mock product toward a configurable available-stock target. Pending orders also cause acquisition, including when the target is zero.

PA1 specifies FastAPI, staff roles, customer records, and out-of-stock rejection. The Django prototype instead supports users ordering for themselves and pending orders. These differences require reconciliation.

## 2. System Context

The system contains the browser application, API, database, and worker. In UC-04, the Administrator owns configuration and supplier simulators are external participants; the worker is internal.

The mock provider runs locally without network calls. Signed-in users can inspect stock and use shared simulation controls; Administrator authorization is not implemented.

Passkeys and Django sessions provide supporting authentication. See the [authentication guide](architecture/authentication.md).

## 3. Key Features and Functionality

| Capability | Current implementation | UC-04 completion requirement |
| --- | --- | --- |
| Replenishment evaluation | Pending orders or available stock below `Product.target_stock` cause acquisition. | Evaluate the selected Strategy using agreed demand, stock, and policy inputs. |
| Durable procurement | One unfinished acquisition job per product; the job UUID identifies provider requests. | Preserve these guarantees through both supplier adapters. |
| Supplier integration | One local `MockProvider` returns one deterministic demo item per request. | Demonstrate two different supplier contracts through Adapter. |
| Import validation | Validate the result shape and URL; enforce provider/reference uniqueness. | Encrypt codes and prevent duplicate code imports under different references or suppliers. |
| Recovery | Temporary errors retry; permanent/invalid results block; interrupted jobs retain their UUID. | Verify normal, failure, uncertain-result, and repeated-processing scenarios for both suppliers. |
| Inventory preservation | Lowering a target does not delete items or completed orders. | Retain this behavior when adaptive policies change targets. |

Current successful acquisition flow:

1. Evaluate stock, locate or create a job, and claim eligible work under a product lock.
2. Call the provider outside the transaction using the job UUID.
3. Validate and store the item, complete the job, fulfill waiting orders, and ensure subsequent work atomically.
4. Expose stock and acquisition status through the API.

## 4. Assumptions and Dependencies

- One organization, one seeded demonstration product, and one active inventory worker per database.
- Safe replay requires provider idempotency or reconciliation. The mock returns the same result for the same UUID.
- Mock URLs use `example.invalid`; they are synthetic and have no usable commercial value.
- The local environment uses macOS, Python 3.14, Node.js 24, PostgreSQL 17, and a WebAuthn-capable browser/authenticator, as documented in the [README](../README.md).
- Python and frontend dependency versions are recorded in [requirements.txt](../backend/requirements.txt), [package.json](../frontend/package.json), and [package-lock.json](../frontend/package-lock.json).
- Initial dependency installation requires network access.

## 5. Architectural Design

### 5.1 System Architecture Diagram (High-Level)

![System Architecture Diagram](../_assets/uc04-system-architecture.png)

*Figure 5.1: High-Level System Architecture and Deployment Topology.*

**Diagram Description:**
The high-level architecture diagram illustrates the multi-tier local deployment for UC-04. The client layer consists of a React browser application communicating with the Django REST Framework backend through a Vite development proxy. Transactional persistence and advisory session locks are managed within PostgreSQL, while an independent Python inventory worker handles background procurement directly against the external local MockProvider interface without blocking web application requests.

### 5.2 Architectural Patterns and Styles

The layered client-server design separates HTTP views/serializers, inventory services, and persistence. The worker reuses the same backend services and schema in a separate process. PostgreSQL stores jobs and coordinates worker ownership; no external broker is used.

### 5.3 Rationale for Architectural Decisions

| Decision | Reason and consequence |
| --- | --- |
| Shared Django services for API and worker | Keeps allocation, persistence, and job rules in one place. |
| Provider calls outside transactions | Avoids holding inventory row locks during supplier delays. |
| PostgreSQL row locks and constraints | Coordinates concurrent writes and enforces item, request, and unfinished-job uniqueness. |
| Durable job UUIDs | Allows interrupted acquisitions to resume using the same supplier request identity. |
| One worker with a session advisory lock | Simplifies recovery and prevents simultaneous ownership; limits procurement throughput. |
| Separate project PostgreSQL cluster | Isolates local project state from existing Homebrew databases. |

Django is the implemented framework choice. The team still needs to record and reconcile its departure from the FastAPI direction in PA1.

## 6. Component Design

### 6.1 Subsystems and Modules

The table retains SRS component IDs and identifies incomplete responsibilities.

### 6.2 Responsibilities of Each Component

| Component | Implementation | Responsibility and boundary |
| --- | --- | --- |
| CMP-01 Dashboard | [Inventory.tsx](../frontend/src/components/Inventory.tsx), [InventoryDemo.tsx](../frontend/src/components/InventoryDemo.tsx) | Display stock, personal orders, and local simulation controls. |
| CMP-02 API and access control | [views.py](../backend/api/inventory/views.py), [serializers.py](../backend/api/inventory/serializers.py) | Authenticate requests, validate input, and return permitted data. Staff roles remain missing. |
| CMP-03 Inventory service | [services.py](../backend/api/inventory/services.py) | Query available stock, store acquired items, and coordinate allocation. Encryption and full item lifecycle behavior remain missing. |
| CMP-05 Policy service | `needs_supply` in [services.py](../backend/api/inventory/services.py) | Current fixed-target decision. An interchangeable Strategy implementation is not present. |
| CMP-06 Background worker | [worker.py](../backend/api/inventory/worker.py) | Own the worker lock, claim jobs, call the provider, and persist outcomes. |
| CMP-07 Supplier integration | [providers.py](../backend/api/inventory/providers.py) | Provider protocol, registry, mock implementation, and output validation. Two translating adapters remain missing. |
| CMP-08 Persistence | [models.py](../backend/api/models.py), [inventory migration](../backend/api/migrations/0002_inventory.py) | Store products, items, jobs, orders, and controls; enforce database constraints. |

### 6.3 Interfaces Between Components

- `claim_next()` returns an eligible job and its simulated-failure flag, or no work.
- `providers.acquire(provider_key, product_reference, request_id, fail=...)` returns a validated `ProviderItem` or raises a provider error.
- `complete_acquisition(job_id, result)` stores the item and completes related inventory changes atomically.
- `fail_acquisition(job_id, code, temporary=...)` records retry or blocked state.
- `update_demo(product_id, action, target_stock=...)` applies a supported simulation action under a product lock.

### 6.4 Component Diagrams

![Component Diagram](../_assets/uc04-components.png)

*Figure 6.4: Subsystem Component and Module Dependencies.*

**Diagram Description:**
The component diagram outlines module dependencies across frontend, API, worker, and persistence subsystems. The React UI issues HTTP calls via the frontend API helper to Django REST serializers and views. Business logic is centralized in inventory services, shared by both the API and the background worker loop. The worker delegates supplier validation to the provider registry and MockProvider adapters before writing domain records through Django models to PostgreSQL.

## 7. Data Design

### 7.1 Data Model / ER Diagram

![Data Model ER Diagram](../_assets/uc04-data-model.png)

*Figure 7.1: Entity-Relationship Diagram for UC-04 Replenishment Domain.*

**Diagram Description:**
The ER diagram details the relational schema governing inventory replenishment and order fulfillment. A `Product` defines the target stock and provider mapping, spawning multiple `AcquisitionJob` instances during background procurement. Completed jobs produce `InventoryItem` records. `Order` records placed by a `User` link optionally (`0..1`) to an `InventoryItem` upon fulfillment, while simulation parameters are controlled via `MockProviderControl`.

### 7.2 Data Storage (Database or File Structure)

Business records and sessions are stored in PostgreSQL. The project cluster is under `.local/postgres`; migrations define the schema and seed the demo product and simulation control. Protected relationships retain inventory and acquisition provenance.

Runtime configuration is in the ignored `backend/.env`; generated logs and process state are under `.local/`. Provider results currently store plaintext mock URLs. Encrypted codes and code-level deduplication are required by FR-04/NFR-S01 and are not implemented.

### 7.3 Data Flow Diagrams

![Data Flow Diagram](../_assets/uc04-data-flow.png)

*Figure 7.3: Data Flow Diagram for UC-04 Background Replenishment.*

**Diagram Description:**
The data flow diagram traces inventory replenishment from supply evaluation through storage. Current stock levels, pending orders, and product targets are evaluated to create durable `AcquisitionJob` intents. The background worker claims jobs via UUIDs, issues requests to the mock provider, and routes outcomes through result validation. Successful acquisitions atomically commit new items to stock and complete waiting jobs, while errors or retries update job states and emit status to the inventory API.

### 7.4 Data Validation Rules

- Product references must identify an existing product; request IDs must be UUIDs.
- Simulation targets must be integers from 0 through 2,147,483,647. Only `set_target` accepts a target value.
- Provider results must be `ProviderItem` values with a nonempty reference of at most 200 characters and an HTTPS URL of at most 2,000 characters with a hostname and no embedded credentials.
- `(provider_key, provider_reference)` is unique. The same payload under different references is not currently prevented.
- Each product has at most one unfinished job, including blocked work.
- `(user, request_id)` is unique; reuse with a different product is rejected.
- A pending order has no item or fulfillment time; a fulfilled order has both.
- Product/item consistency is enforced by service behavior, not by a cross-table database check.

## 8. Design Patterns

### 8.1 Applied Design Patterns

UC-04 requires **Adapter, supported by Strategy**. Both remain incomplete.

| Pattern | Present implementation | Remaining requirement |
| --- | --- | --- |
| Adapter | `Provider`, registry, `MockProvider`, and normalized result type | Two different supplier contracts and translating adapters. |
| Strategy | `needs_supply` checks pending orders and a fixed target | Interchangeable policies, validated settings, and agreed demand evaluation. |

![Provider Interface Class Diagram](../_assets/uc04-provider-interface.png)

*Figure 8.1: UML Class Diagram for Provider Interface (Adapter Pattern).*

**Diagram Description:**
The class diagram demonstrates the structural application of the Adapter pattern for supplier integration. The abstract `Provider` interface declares the standardized `acquire(product_reference, request_id, fail)` contract returning a normalized `ProviderItem`. The concrete `MockProvider` implements this interface, encapsulating provider-specific payload translation and synthetic error handling to isolate backend inventory services from external contract changes.

### 8.2 Context and Justification

Adapter isolates supplier formats and errors from the worker through a common procurement contract.

Strategy separates replenishment policy from procurement and persistence. The final policy rules and justification will be completed with the implementation.

Pattern comments must state the name, intent, motivation, and benefit; quantify improvements where supported by measurements. Job status values alone do not implement the State pattern.

## 9. Implementation Notes

All allocation and acquisition mutations use short transactions with product row locking. Ordering additionally locks the user before checking request identity. The worker holds a PostgreSQL session advisory lock and verifies ownership before and after provider calls. Loss of that session or lock terminates the worker.

Jobs snapshot the provider mapping when created. Retries therefore cannot silently switch supplier after a product setting changes. An interrupted running job is reclaimed with its existing UUID; successful jobs are not reacquired. This recovery depends on provider idempotency or reconciliation.

The worker processes one acquisition per pass. Retries use delays of 5, 10, 20, 40, then 60 seconds. Target reductions can leave unattempted jobs dormant; attempted jobs retain their identity. Blocked work requires explicit retry.

These behaviors are documented in the [inventory architecture guide](architecture/inventory.md). Runtime acceptance results remain to be recorded against the final submission commit.

## 10. User Interface Design

### 10.1 UI Mockups or Wireframes

UC-04 runs automatically. The current account page provides these inspection and simulation controls:

```text
Demo digital link                         [available count]
[Order demo link]

My orders
  Order #[id]     [Ready / Waiting for stock]
  [Demo URL and copy action when fulfilled]

Local simulation
  Available [n]   Waiting [n]   Delivered [n]
  Supply [enabled / paused]
  Acquisition [state]   Attempts [n]   Next retry [time]
  [Pause / Resume supply]  [Fail next attempt]
  [Retry acquisition when blocked]
  Available stock target [number]  [Save target]
  [Validation or provider error message]
```

The UI polls every two seconds after the preceding batch settles and stops while hidden or unmounted. Administrator policy selection remains unimplemented.

## 11. External Interfaces

### 11.1 APIs

These current endpoints are under `/api/v1/`. All require an active session, POST requests require CSRF validation, and responses use `Cache-Control: no-store`.

| Method and route | Request | Response or behavior |
| --- | --- | --- |
| `GET products/` | None | Product IDs, names, codes, and available counts. |
| `GET demo/inventory/` | None | Shared pause/fail-next flags, stock/order counts, targets, and unfinished acquisition summaries. |
| `POST demo/inventory/` | `product_id`, `action`, optional `target_stock` | Apply pause, resume, fail-next, set-target, or retry; return the updated summary. |
| `POST orders/` | `product_id`, `request_id` | Supporting demand trigger; 201 for a new order, 200 for an identical replay. |
| `GET orders/?page=1` | Page number | Current user's history, 20 orders per page. |

Demo routes return 404 outside local development and are not an Administrator API. Handled errors use `{code, message}` with 400/404/409 for validation, missing records, or conflicts. See the [inventory guide](architecture/inventory.md).

### 11.2 Third-party Systems

The local supplier call returns `ProviderItem(reference, url)`. Two distinct supplier contracts remain to be implemented and documented.

PostgreSQL supplies transactional persistence and locking. WebAuthn libraries and the user's browser/authenticator provide supporting passkey functionality. Real supplier purchasing, payments, and automatic email delivery are outside the initial demonstration scope.

## 12. Performance Considerations

### 12.1 Performance Requirements

NFR-P02 applies to UC-04: supplier delays must not make an in-stock assignment wait for procurement. Provider calls run outside inventory transactions, but AT-18 must verify the behavior.

The SRS also specifies inventory-read p95 below 50 ms and in-stock assignment p99 below 150 ms at 50 requests/second with 1,000 items. Its AT-14 entry still describes load and thresholds as pending. Reconcile that inconsistency before benchmarking. No measured latency, throughput, or pattern-performance improvement is claimed here.

### 12.2 Scalability & Optimization Strategies

Current safeguards include a pending-order index, paginated history, short mutation transactions, and at most one unfinished job per product. Counts are calculated from stored records rather than a separately maintained stock counter.

One worker, two-second mock calls, and one-second waits limit procurement throughput. Multiple-worker scaling is not implemented.

## 13. Error Handling and Logging

### 13.1 Exception Management

| Condition | Current handling |
| --- | --- |
| Temporary provider failure | Store `retry`, preserve job UUID, and schedule capped exponential backoff. |
| Unknown provider or invalid result | Store `blocked` with a sanitized error code. |
| Integrity error during acquisition completion | Roll back the completion transaction and block the job with `duplicate_provider_item`. This broad classification should be checked against the final supplier/import design. |
| Unexpected provider exception | Block the job without exposing raw exception content. |
| Worker lock/session loss | Terminate; restart through the local lifecycle command. |
| Process interruption | Reclaim unfinished work using the persisted provider request identity. |

The current mock has a fixed delay. Timeout and uncertain-result behavior for the two supplier interfaces must be specified and verified when those interfaces are added.

### 13.2 Logging Mechanisms

The `api.inventory` logger records job/order IDs, attempts, event names, states, and sanitized failure codes. Raw provider exceptions and delivered URLs are not logged by these event calls. Inventory worker output goes to `.local/inventory.log`; startup and other service logs are documented in the [runtime guide](architecture/local-runtime.md).

## 14. Design for Testability

The provider boundary, deterministic results, persistent jobs, and simulation controls support repeatable verification. Final supplier and policy test scenarios remain to be developed.

Automated tests are deferred; no passing results are claimed. Record test IDs, commit, environment, expected/actual outcomes, executor, date, and evidence. Appendix B retains the existing acceptance-test IDs.

Coverage includes both suppliers and policies, invalid/duplicate results, recovery, target reduction, storage protection, authorization, and nonblocking procurement.

## 15. Deployment and Installation Design

### 15.1 Environment Configuration

The local application uses `localhost:5173` for the browser, `127.0.0.1:8000` for Django, and `127.0.0.1:5433` for the project PostgreSQL cluster. Vite proxies API requests. The worker has no listening port.

[.env.example](../backend/.env.example) defines placeholder configuration for local mode, Django/database secrets, database connection details, and WebAuthn RP/origin. Setup generates local secrets in the ignored environment file. The supported local passkey origin is exactly `http://localhost:5173`.

### 15.2 Packaging and Dependencies

From the repository root, `make start` prepares dependencies/configuration, starts the isolated database, applies migrations, and starts the worker, backend, and frontend. `make stop` preserves data; `make clear` permanently removes generated project state and dependencies. Detailed prerequisites and instructions are in the [README](../README.md).

The deliverable consists of source, migrations, dependency manifests/lockfile, lifecycle scripts, and documentation. Generated secrets, database files, installed dependencies, and runtime logs are excluded from Git. Production deployment is not configured. Record a successful fresh-checkout demonstration before final submission.

## 16. Change Log

| Version | Date | Change | Review status |
| --- | --- | --- | --- |
| 0.1 | 8 November 2026 | Created the UC-04 design draft and traceability. | Team review pending. |
| 0.2 | 8 November 2026 | Shortened draft content, separated Mermaid files, and left contribution fields open for the team. | Team review pending. |
| 0.3 | 8 November 2026 | Replaced diagram source links with short descriptions for team-prepared images. | Team review pending. |

## 17. Future Work / Open Issues

| ID | Issue | Required resolution |
| --- | --- | --- |
| SDD-01 | Strategy and demand rules | Reconcile FR-13 with SRS Section 10.4; define windows, limits, rounding, and resize timing; implement and demonstrate interchangeable policies. |
| SDD-02 | Adapter demonstration | Implement two different supplier interfaces and their request/result/error translations. |
| SDD-03 | Digital-code protection | Implement encrypted code storage and code-level duplicate protection; verify retained and replayed results. |
| SDD-04 | Authorization and scope differences | Reconcile staff roles, Administrator configuration, customer identities, pending orders, and Django versus the PA1 specification. |
| SDD-05 | Performance specification | Align NFR-P01 with AT-14 and record applicable benchmark/nonblocking results. |
| SDD-06 | Pattern comments and traceability | Add required pattern comments and replace incomplete mappings with concrete implemented symbols and executed test evidence. |
| SDD-07 | Submission records | Complete actual document authorship, task ownership, commit evidence, and team review; finalize and export the document with rendered diagrams. |
## Appendix A — Task Matrices

The team will complete its assignment and document contributions below.

### A.1 Assignment Workload

| Full name | Student number | Assignment task | Files or components | Contribution evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Ömer Kılınç | 261111011 | | | | |
| Deren Berk | 221101068 | | | | |
| Hasan Yiğit Sarı | 231101050 | | | | |

### A.2 Document-Specific Contributions

| Full name | Student number | Document task | Sections | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Ömer Kılınç | 261111011 | | | | |
| Deren Berk | 221101068 | | | | |
| Hasan Yiğit Sarı | 231101050 | | | | |

## Appendix B — Requirements and Test Traceability

PA1 IDs are retained. Implementation status is based on code inspection; all test executions remain pending.

| Use case / requirement | Design sections | Current implementation reference | Existing test IDs | Status |
| --- | --- | --- | --- | --- |
| UC-04 / FR-04 | 7, 9, 13 | `providers.acquire`, `complete_acquisition`, `InventoryItem` | AT-01, AT-04, AT-13 | Partial validation/reference uniqueness; encryption and code deduplication missing; execution pending. |
| UC-04 / FR-13 | 3, 6, 8 | `needs_supply`, `claim_next` | AT-06, AT-16 | Fixed target only; demand Strategy missing; execution pending. |
| UC-04 / FR-14 | 6, 8, 11 | `Provider`, `MockProvider`, `PROVIDERS` | AT-07 | One mock; two translating adapters missing; execution pending. |
| UC-04 / FR-15, NFR-R02 | 7, 9, 13 | `complete_acquisition`, `fail_acquisition`, `run_worker` | AT-09, AT-13 | Recovery mechanisms present; full supplier/code-level cases incomplete; execution pending. |
| UC-04 / FR-16 | 3, 9 | `update_demo`, `claim_next` | AT-06, AT-16 | Fixed-target reduction retains records; adaptive case and execution pending. |
| UC-04 / FR-02, NFR-S02 | 2, 6, 11 | Session-protected inventory views | AT-05, AT-17 | Authentication present; staff role enforcement missing; execution pending. |
| UC-04 / NFR-S01 | 7, 13 | `InventoryItem.url`, inventory event logging | AT-04, AT-17 | Plaintext mock storage; encryption and verification pending. |
| UC-04 / NFR-P02 | 5, 9, 12 | `run_worker` calls providers outside mutation transactions | AT-18 | Separation present; execution pending. |
| Supporting setup / NFR-PT01 | 15 | Lifecycle scripts and README | AT-15 | Instructions present; independent setup evidence pending. |

## References

1. [Project Assignment 2](assignments/Project_Assignment_2.pdf), pages 1–3: deliverables, contribution requirements, pattern comments, traceability, and SDD outline.
2. [Project Assignment 1](assignments/Project_Assignment_1.pdf): term-wide table-of-contents requirement and PA1 deliverables.
3. [Project Definition Document](1_Project%20Definition%20Document.md), version 2.0.
4. [Project Plan Document](2_Project%20Plan%20Document.md), version 2.0: acceptance planning and contribution expectations.
5. [Software Requirements Specification Document](3_Software%20Requirements%20Specification%20Document.md), version 2.0: UC-04, FR/NFR definitions, component/pattern mappings, and AT identifiers.
6. [Architecture index](architecture/README.md), [inventory](architecture/inventory.md), [authentication](architecture/authentication.md), and [local runtime](architecture/local-runtime.md): current implementation boundaries.
7. [Assignment policy](assignments/assignment-policy.md): individual contributions and shared project understanding.
