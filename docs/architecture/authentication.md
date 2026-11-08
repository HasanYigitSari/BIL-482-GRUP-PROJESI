# Accounts and authentication

Implemented scope: one passkey enrolled at signup, username-free signin, a session-protected account page, and logout. The same session protects the [inventory API and account-page controls](inventory.md). Return to the [architecture index](README.md) for component ownership.

## Data and ownership

Schema lives in [models.py](../../backend/api/models.py) and [migrations/](../../backend/api/migrations/).

| Record | Purpose and invariants |
| --- | --- |
| `User` | Unique lowercase username, 3–30 ASCII letters/digits/underscores; unique random 32-byte WebAuthn handle; active flag. Passwords are unusable. The database enforces uniqueness and lowercase usernames; serializers/manager enforce the character rules. |
| `Passkey` | Belongs to one user. Stores a globally unique credential ID, public key, signature counter, device/backup metadata, transports, creation time and last use. The schema permits multiple passkeys, but enrollment currently only happens at signup. |
| `Ceremony` | Pending signup or signin: random challenge, operation, expiry, and HMAC digest of the browser session key. Signup also stores the proposed username and user handle. A unique constraint allows one pending ceremony per session. |
| `RateLimitBucket` | Atomic counter per operation/source-address digest/minute. Unique key and window prevent duplicate counters. |
| Django `Session` | Server-side browser session and authentication state. There is currently no separate per-user session registry or global revocation mechanism. |

Private keys and device PINs/biometrics are handled by the passkey provider, not stored by the application. A passkey record represents a credential, not necessarily one physical device; a provider may synchronize it.

## HTTP contract

Routes are under `/api/v1/auth/`; see [urls.py](../../backend/api/urls.py), [views.py](../../backend/api/views.py), and [serializers.py](../../backend/api/serializers.py). Bodies and responses use JSON, except a successful logout has no body.

| Method and path | Input | Success | Access |
| --- | --- | --- | --- |
| `GET csrf/` | None | `200 {csrf_token}` and CSRF cookie | Public |
| `GET me/` | None | `200 {user: {id, username}}` | Signed in |
| `POST signup/begin/` | `{username}` | `200 {ceremony_id, options}` | Signed out |
| `POST signup/complete/` | `{ceremony_id, credential}` | `201 {user: {id, username}}` and session | Signed out |
| `POST signin/begin/` | `{}` | `200 {ceremony_id, options}` | Signed out |
| `POST signin/complete/` | `{ceremony_id, credential}` | `200 {user: {id, username}}` and session | Signed out |
| `POST logout/` | `{}` | `204`, session invalidated | Signed in |

`options` is the library-generated WebAuthn options JSON. `credential` is the browser helper's serialized registration or authentication response. Every POST requires the CSRF cookie and `X-CSRFToken`, including anonymous requests. Auth responses have `Cache-Control: no-store`.

Handled errors use `{code, message}`: invalid/expired ceremonies generally return `400`, unauthenticated access `401`, CSRF rejection `403`, username/credential or signed-in-state conflicts `409`, and throttling `429` with `Retry-After`. Account responses expose only ID and username. The frontend also handles network failures and non-JSON responses; unexpected server failures are not guaranteed to use the handled-error format.

## Signup and signin

[services.py](../../backend/api/services.py) owns these flows:

1. Begin checks the rate limit and signed-out state. Signup normalizes and validates the username and checks availability. A browser session is created if needed.
2. Under a database transaction, lock the session row, replace any existing pending ceremony for that session, and issue a random 32-byte challenge expiring in five minutes. Signup requests discoverable credentials; both flows require user verification.
3. The frontend calls the browser's passkey prompt and posts the result with the ceremony ID.
4. Complete locks the session, then its matching unexpired ceremony. The WebAuthn library verifies the expected challenge, RP ID, exact origin and required user verification. Signin additionally locks the credential row, requires an active owner and matching user handle, and verifies the signature/counter and unchanged backup eligibility.
5. Signup creates the user and passkey together only after verification; signin updates the counter, backup state and last-use timestamp. The successful transaction deletes the ceremony, so it cannot complete twice. Failed transactions roll back; the pending ceremony remains until expiry or replacement.
6. The view establishes the Django login session and sets a fixed 24-hour expiry. This happens after the credential transaction commits. Login rotates the anonymous session key. Logout invalidates the current session.

The same lock order is used by begin and complete to serialize overlapping requests from the same session. Username and credential uniqueness constraints settle concurrent signup conflicts. Different tabs in the same browser session replace each other's pending ceremonies.

## Session and frontend behavior

[authentication.py](../../backend/api/authentication.py) enforces CSRF even for anonymous callers, which DRF's default session authentication otherwise skips. Protected API views require an authenticated user; the backend only loads active users. There is no password authentication or admin login route.

[App.tsx](../../frontend/src/App.tsx) owns account state in memory. It calls `me/` on mount and window focus, treats `401` as signed out, and ignores stale refresh results using a request counter. `/signup` and `/signin` redirect signed-in users to `/account`; `/account` redirects signed-out users to `/signin`. Server permissions remain the access boundary.

[api.ts](../../frontend/src/lib/api.ts) uses the shared `/api/v1/` base. Authentication helpers pass explicit `auth/...` paths; inventory helpers use `products/`, `orders/` and `demo/inventory/`. It sends same-origin cookies, obtains a fresh masked CSRF token from `auth/csrf/` before every POST, and applies a 15-second fetch timeout. An optional abort signal lets inventory polling cancel hidden/unmounted requests. A `401` outside `auth/me/` emits a session-expired event. [errors.py](../../backend/api/errors.py) preserves domain `{code, message}` errors from both auth and inventory while normalizing other handled DRF exceptions.

[auth.ts](../../frontend/src/lib/auth.ts) owns the begin → browser prompt → complete sequence and error mapping. Sessions are restored from the server, not browser local storage. Inventory uses tab session storage only for unresolved order request IDs; it stores neither credentials nor authorization there. Expiry is noticed on refresh, focus or an API request (including inventory polling); there is no expiry timer.

Signup/signin UI checks secure-context and WebAuthn availability and blocks repeated submission while busy. Browser cancellation/timeout, duplicate credentials and unsupported authenticators have messages. `NotAllowedError` currently uses a cancellation/timeout message even though the browser may also report it when no usable passkey is available.

## Security constraints and current limits

- Local RP ID is `localhost`; expected origin is exactly `http://localhost:5173`. The passkey display name is `Inventory Manager`. Account data and credentials belong to that RP. Hosting on a different unrelated domain requires new enrollment.
- The `inventory_manager_session` and `inventory_manager_csrf` cookies are HttpOnly and SameSite=Lax. Secure cookies and HTTPS redirects are enabled outside explicit local-development settings. See [local runtime](local-runtime.md) for the development configuration and deployment limits.
- Signup and signin each allow 30 combined begin/complete requests per source address per minute. The source is `REMOTE_ADDR`; forwarding headers are not trusted. With local Vite proxying, browsers share the proxy's bucket. This is not yet a production proxy/rate-limit design.
- The application security logger records event names, rejection codes and internal account IDs. Do not add credentials, challenges, session keys or recovery secrets to logs.
- Additional-passkey enrollment, recovery codes, passkey removal and logout of all sessions are not implemented. Losing access to every copy of the enrolled credential means losing account access. Recovery discussed in conversation remains a proposal.
- Authentication does not establish a person's real-world identity. Username availability is intentionally disclosed during signup.

Static checks and the manual browser walkthrough are in the [project README](../../README.md#checks-and-manual-walkthrough). Automated tests and a complete security audit are deferred; this document records behavior, not a production security certification.
