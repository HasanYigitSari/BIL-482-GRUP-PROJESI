# Initial setup plan

Status: broader architecture and implementation sequence. The approved first implementation is the **local core login flow only**: signup, passkey signin, account page, and logout. Its source, dependencies, local PostgreSQL cluster, and initial migration are prepared; services remain stopped and the migration is unapplied. See the [README](../../README.md) for setup and startup. Backup credentials, recovery, deployment, and automated tests remain deferred.

## 1. First milestone

Build a website backed by our own Python API, with this complete initial experience:

**Create account → register a passkey → sign in → see an authenticated account page → sign out.**

Include backup credentials and recovery before accepting real users. Support chat and native mobile clients will follow once this foundation works.

We will own the account workflows, data, sessions, and permission rules. Established open-source libraries will handle WebAuthn verification and framework functionality. Authentication will not depend on an external identity provider, email service, or notification service. Deployment will initially use ordinary Ubuntu services without Docker.

## 2. Tools and layers

| Layer | Proposed tools | Responsibility |
| --- | --- | --- |
| Website | React, TypeScript, Vite, React Router | Forms, pages, navigation, passkey prompts, and API calls. |
| HTTP API | Django REST framework on Django | Request validation, endpoint handlers, permissions, and JSON responses. |
| Account workflows | Our Python code | Coordinate registration, signin, credential management, and recovery. |
| Passkey verification | Python `webauthn` package | Generate ceremony options and verify registration/authentication responses. |
| Browser sessions | Django database-backed sessions | Remember authenticated browsers, expire sessions, and support logout. |
| Persistent storage | PostgreSQL through Django's ORM | Accounts, credentials, challenges, sessions, and recovery records. |
| Python runtime | Uvicorn in a virtual environment | Run Django through ASGI. |
| Web entry point | Nginx on Ubuntu | Serve the built website and proxy API requests to Uvicorn. |
| Process supervision | Ubuntu `systemd` | Start the backend on boot and restart it if it stops unexpectedly. |

React suits the interactive account screens and future support chat. Vite supplies the development server and production frontend build; React Router handles page navigation. The production frontend is a set of static files served by Nginx. See [React's Vite setup](https://react.dev/learn/build-a-react-app-from-scratch), [Vite](https://vite.dev/guide/), and [React Router](https://reactrouter.com/start/declarative/installation).

The backend will contain one Django application, named `api`, with files separated by responsibility. We can use Django's custom user model and authentication extension points while keeping its session system. See [Django authentication customization](https://docs.djangoproject.com/en/stable/topics/auth/customizing/).

## 3. Proposed repository layout

The existing notes remain grouped under `docs/notes/`. The application and deployment files below are proposed additions.

```text
inventory-manager/
├── README.md                      # Setup instructions and project overview
├── .gitignore                     # Exclude secrets, dependencies, builds, uploads
│
├── docs/
│   ├── initial-setup-plan.md       # This consolidated plan
│   └── notes/                     # Existing explanations and design notes
│       ├── passkey-authentication.md
│       ├── data-update-flows.md
│       ├── django-file-storage.md
│       └── postgresql-features.md
│
├── backend/
│   ├── manage.py                  # Django commands: run, migrate, test
│   ├── requirements.txt           # Python dependencies and pinned versions
│   ├── .env.example               # Example environment variables, no secrets
│   │
│   ├── config/                    # Application configuration
│   │   ├── settings.py            # Database, sessions, security, installed apps
│   │   ├── urls.py                # Top-level routing: /api/v1/ → api.urls
│   │   └── asgi.py                # Entry point used by Uvicorn
│   │
│   └── api/                       # Our single Django application
│       ├── apps.py                # Registers this application with Django
│       ├── urls.py                # Maps API paths to endpoint handlers
│       ├── views.py               # Receives requests and returns responses
│       ├── serializers.py         # Validates input and defines response fields
│       ├── services.py            # Signup, signin, passkey and recovery workflows
│       ├── models.py              # Users, credentials, challenges, recovery records
│       ├── tests.py               # Authentication, permissions and session tests
│       └── migrations/            # Versioned database schema changes
│
├── frontend/
│   ├── package.json               # JavaScript dependencies and development scripts
│   ├── package-lock.json          # Exact dependency versions
│   ├── index.html                 # HTML entry point that loads React
│   ├── vite.config.ts             # Build settings and development API proxy
│   ├── tsconfig.json              # TypeScript configuration
│   │
│   └── src/
│       ├── main.tsx               # Starts React
│       ├── App.tsx                # Page routes, shared layout, current-user state
│       ├── styles.css             # Shared styling
│       │
│       ├── lib/
│       │   ├── api.ts             # Shared fetch helper: cookies, CSRF, errors
│       │   └── auth.ts            # Calls auth endpoints and browser passkey APIs
│       │
│       └── pages/
│           ├── SignUp.tsx         # Username entry and passkey registration
│           ├── SignIn.tsx         # Passkey signin
│           ├── Account.tsx        # Signed-in screen, logout, credential controls
│           └── Recovery.tsx       # Recovery code and replacement-passkey flow
│
└── deploy/
    ├── backend.service            # systemd service that runs Uvicorn
    └── nginx.conf                 # Serves frontend build and proxies API requests
```

Empty Python `__init__.py` files are omitted from the diagram for readability; the implementation will include them where needed. Generated build output, installed dependencies, virtual environments, uploaded files, and actual secrets stay outside Git.

### Backend responsibilities

The separation is by responsibility within the single `api` app:

- `config/settings.py` controls how the application runs. Deployment-specific values come from the environment; `.env.example` documents those values without containing real secrets.
- `config/urls.py` mounts the API under a common prefix. `api/urls.py` maps individual API paths to handlers.
- `views.py` handles HTTP concerns: access requirements, input parsing through serializers, invoking workflows, establishing or ending sessions, and returning responses.
- `serializers.py` defines accepted input and exposed response fields. It does not replace account ownership or authorization checks.
- `services.py` performs account workflows and calls the `webauthn` library. It contains the longer operations that should not crowd endpoint handlers.
- `models.py` defines our persistent records and their relationships. Django supplies its existing session model.
- `tests.py` verifies successful flows and security-relevant failure cases. `migrations/` records schema changes.

For example, a complete-signup request passes through:

```text
SignUp.tsx
    → lib/auth.ts: obtain the browser's passkey response
    → lib/api.ts: send the response to the backend
    → api/urls.py: choose the endpoint
    → api/views.py: validate the request through its serializer
    → api/services.py: verify the passkey and create the account
    → api/models.py: persist the records
    → api/views.py: establish the session and return the response
```

### Frontend responsibilities

Pages manage forms, loading states, errors, and screen behavior. `auth.ts` coordinates the API/browser steps of passkey authentication. `api.ts` handles HTTP details consistently, including the session cookie, CSRF token, and error responses.

`App.tsx` initially holds shared current-user state and routes. It asks the API who is signed in when the website loads. Route guards improve navigation; the backend independently enforces access on every protected endpoint.

We will extract shared UI components as actual reuse appears. The initial structure does not require separate feature packages or a global state-management library.

## 4. One public origin and a shared API

Initially, expose the website and API on the same HTTPS origin:

```text
https://app.example.com/          Website
https://app.example.com/api/v1/   API
```

`app.example.com` is a placeholder for our chosen permanent hostname. A shared origin simplifies browser cookies and CSRF handling. React calls the JSON API rather than placing account workflows inside frontend code.

Choose the WebAuthn Relying Party ID before enrolling real users. For this layout, the initial RP ID can be `app.example.com`, with `https://app.example.com` as the expected website origin. Keep development settings separate from the production values.

Native apps can later reuse the account records and verification workflows. Their platform passkey APIs and session credential transport will need client-specific integration; they will not use the browser's cookie storage as their assumed design.

## 5. Signup flow

1. The person chooses an available username on the React signup page.
2. The page asks the API to begin signup.
3. The backend creates a short-lived pending signup with a fresh random challenge and a server-generated WebAuthn user handle, bound to that client's pending session.
4. The browser asks the user to create a passkey. The authenticator or credential manager handles local verification and private-key storage.
5. The browser returns registration data to our API.
6. Our backend uses `webauthn` to verify the expected challenge, origin, RP ID, and required user verification.
7. After successful verification, a transaction creates the account and credential relationship and consumes the pending challenge. Django establishes a session and the website opens the account page.

The account starts with an unusable Django password, so the passkey design does not accidentally expose a password-only login path. Username uniqueness is enforced on the server. A pending signup grants no normal account access, and it cannot attach a credential to an existing account merely by naming that account.

Signup does not require email or SMS. A passkey establishes control of an account credential; it does not verify legal identity or email ownership. See [py_webauthn registration](https://duo-labs.github.io/py_webauthn/registration.html).

## 6. Signin, sessions, and signout

1. The person selects **Sign in with a passkey**.
2. Our API generates a fresh, short-lived authentication challenge.
3. The browser offers an eligible credential and requests local user verification.
4. The authenticator produces a signed response, which the frontend submits to the API.
5. The backend finds the credential, verifies the response with its stored public key and expected ceremony values, and checks that the owning account is active.
6. After successful verification and one-time challenge consumption, Django establishes an authenticated session and the website loads the account page.

The server receives neither the private key nor the person's biometric/PIN. A user's credential manager may synchronize passkeys through its own service; a compatible hardware security key is an option without that cloud synchronization. Our backend performs verification locally. See [py_webauthn authentication](https://duo-labs.github.io/py_webauthn/authentication.html).

The browser receives an opaque session ID in a `Secure`, `HttpOnly`, host-scoped cookie with an appropriate `SameSite` policy. Session data remains in our database. Later API requests use the cookie, so navigating the application does not require repeated passkey prompts.

The backend enforces session expiration and revocation. Signout invalidates the session on the server and clears its browser cookie. Sensitive operations such as adding another credential require recent passkey verification. See [Django sessions](https://docs.djangoproject.com/en/5.2/topics/http/sessions/).

## 7. Initial API responsibilities

| Operation | Purpose |
| --- | --- |
| Begin signup | Create a pending signup and return registration options. |
| Complete signup | Verify registration, create the account, and establish a session. |
| Begin signin | Return fresh authentication options. |
| Complete signin | Verify the assertion and establish a session. |
| Get current account | Return the current authenticated account's permitted fields. |
| Sign out | Invalidate the current session. |
| Manage credentials | List credentials and authorize adding or removing a passkey. |
| Manage recovery | Issue or regenerate recovery codes after recent authentication; recover access through a restricted flow. |

These operations will live under `/api/v1/`. The exact endpoint names can be chosen during implementation. Protected endpoints require authentication by default; signup and signin are deliberately public entry points with their own validation and abuse controls.

## 8. Recovery and security behavior

Encourage users to register a second independent passkey. During onboarding, offer high-entropy recovery codes for offline safekeeping. Store verifier hashes rather than raw codes and consume each code only once.

A recovery code creates a restricted, short-lived recovery session that permits replacement-passkey enrollment. Completing recovery revokes existing sessions and the old recovery-code set, and provides a way to revoke lost credentials. Without a working credential or recovery code, automatic recovery is unavailable. The detailed policy is in the [passkey authentication note](../notes/passkey-authentication.md).

The implementation will also enforce:

- Fresh, expiring, one-time challenges bound to the client session and intended operation.
- Exact production origins and RP ID, with user verification required during both registration and signin.
- Rate limits on signup, signin, credential changes, and recovery, enforced consistently across server processes.
- CSRF protection on browser signup, signin, signout, and other state-changing requests, including requests made before authentication.
- Server-side account and permission checks, independent of frontend navigation or visibility.
- Recent authentication for sensitive account changes, safe handling of concurrent requests, and cleanup of abandoned pending ceremonies.
- Security-event logging that excludes session tokens, recovery secrets, and unnecessary personal data.

CSRF deserves explicit treatment: DRF's session authentication does not by itself provide the required protection for every anonymous login request. See [DRF session authentication](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication).

## 9. Development and Ubuntu deployment

During development, Vite serves the React website and proxies `/api/` to the local Django backend. The API helper uses relative URLs. PostgreSQL supplies persistent storage, and Python dependencies run inside a virtual environment.

For production:

```text
Browser
   |
   | HTTPS to our permanent hostname
   v
Public HTTPS entry point
   |
   v
Nginx on Ubuntu
   ├── Website requests → built React files
   └── /api/ requests   → Uvicorn → Django → PostgreSQL
```

Nginx serves the frontend build and forwards API requests to Uvicorn. Client-side website routes need a fallback to the frontend entry page; API paths must remain routed to Django. `systemd` supervises Uvicorn, with environment values supplied outside the repository. Node.js is needed for frontend development/building, rather than as a production application server for this design. See [Nginx serving and proxying](https://nginx.org/en/docs/beginners_guide.html) and [Django with Uvicorn](https://docs.djangoproject.com/en/stable/howto/deployment/asgi/uvicorn/).

The earlier Cloudflare named-tunnel option remains an external networking dependency. It can carry public traffic to Nginx behind NAT while our application and account data remain on Ubuntu. If the requirement excludes Cloudflare too, we must arrange another reachable HTTPS entry point. The authentication implementation does not depend on Cloudflare or an external identity provider.

Keep PostgreSQL and the application server restricted to the required local/private interfaces. Configure allowed hosts, HTTPS/proxy handling, and cookie security for the actual traffic path. Back up the database and test restoration. See [Django's deployment guidance](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/).

## 10. Implementation sequence and completion criteria

1. Establish the repository structure, dependencies, development configuration, and permanent production hostname/RP ID.
2. Define the custom user model before the initial schema migration, plus credential and pending-ceremony records.
3. Implement and test signup and signin through the Python API.
4. Build the React pages and connect them through the shared API and passkey helpers.
5. Finish current-account loading, session expiration, signout, backup credentials, and recovery.
6. Verify failed and concurrent operations: expired/replayed challenges, incorrect origins, missing user verification, disabled accounts, unauthorized credential enrollment, recovery-code reuse, and session revocation.
7. Build the frontend, deploy through Nginx/Uvicorn, and test real browser passkeys and security keys on the actual HTTPS hostname.

The milestone is complete when a person can create an account, sign out, return and sign in, restore their signed-in UI after refreshing, manage a backup credential, and complete the defined recovery process. Protected API requests must reject missing, expired, or revoked authentication.

## 11. How support chat and mobile apps fit later

Support chat will add conversation/message models, endpoint handlers, serializers, and workflows inside the same Django `api` app. The website gains a chat page. We will split individual files when their size or responsibilities make navigation difficult, rather than create a separate Django app for every feature immediately.

Later mobile clients call the same API and share the same accounts. Live updates and attachment storage can be introduced using the approaches already described in our [data-update note](../notes/data-update-flows.md) and [Django file-storage note](../notes/django-file-storage.md).

This first milestone does not require chat transport, Redis, upload endpoints, or a notification-delivery integration. Those components can be added when the corresponding functionality is implemented.
