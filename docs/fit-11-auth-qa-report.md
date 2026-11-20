# FIT-11 — Secure Authentication & User Management: QA Report

Date: 2026-11-20 · Base commit: `0a014d4` (FIT-10) · **Not deployed.** Everything below was verified locally; see section 9.

## 1. Summary

Fitness AI now has email/password accounts:
- registration, login, logout
- server-side sessions in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie
- `GET /api/auth/me`
- a profile-name update
- protected app routes
- rate-limited, CSRF-protected endpoints
- a user-friendly login and registration UI

To make the session cookie work in Safari (iPhone), the API is now served **same-origin** through a Cloudflare Worker. It sits in front of the existing Render API.

## 2. Architecture and security decisions

### 2.1 Why a Worker proxy (the cross-origin cookie problem)

FIT-10 put the frontend on Cloudflare and the API on `*.onrender.com`. Those are different sites: both domains are public suffixes. A session cookie set by the API would therefore be a **third-party cookie**, and Safari has blocked third-party cookies by default since 2020. Login would fail on iPhone, a target platform.

The alternatives were rejected:
- `SameSite=None` cookies: still blocked by Safari, and weaker CSRF protection.
- Tokens in `localStorage`: readable by any XSS; ruled out by the requirements.
- A custom domain for both: costs money.

**Chosen:** Workers static assets serve the app, and `run_worker_first: ["/api/*"]` runs a small Worker only for API paths. The Worker forwards to Render, so the browser sees one origin and the cookie is first-party.

Static files remain free and unlimited. Worker invocations, i.e. API calls only, count against Cloudflare's free daily request allowance.

The Worker also locks the API:
- It adds `X-Fitness-Proxy-Auth: <PROXY_SECRET>` and `X-Fitness-Client-Ip: <CF-Connecting-IP>` after removing any client-sent copies (and `X-Forwarded-For`, `X-Real-IP`, `Forwarded`, `True-Client-IP`, `Host`).
- In production the API answers **403 to every request without the secret**, except `GET /api/health` (Render's health check).
- The secret is compared as SHA-256 digests with `timingSafeEqual`.
- The Worker forwards only to `API_ORIGIN`, which must be `https:` (`http://localhost` is allowed for development). The request contributes only path and query.
- It caps request bodies at 1 MB (the API's own limit is 100 KB) and does not follow redirects.
- When Render is unreachable it returns `502 UPSTREAM_UNAVAILABLE` with `Retry-After: 5`.

### 2.2 Passwords

- **Argon2id**, OWASP parameters (m = 19 MiB, t = 2, p = 1, 16-byte salt) via `argon2`. `needsRehash` upgrades hashes on login if the parameters are raised later.
- **12–128 characters, no composition rules.** Passwords are normalised with **NFKC** (as NIST SP 800-63B recommends), so composed and decomposed accents log in alike. No trimming, case folding or truncation.
- **Unpaired UTF-16 surrogates are refused.** Found during this review: UTF-8 encoding turns any lone surrogate into U+FFFD, so `"…\ud800"`, `"…\udbff"` and `"…�"` hashed identically. A *different* password could authenticate. These characters only arrive through crafted JSON escapes. Registration now rejects them (field error), and login treats them as wrong credentials. Covered by tests.
- The password may not equal the email.
- An unknown email at login still runs a full Argon2id verification against a dummy hash, so response time doesn't reveal which accounts exist. A test checks the timing.

### 2.3 Sessions

- Token: 32 random bytes (base64url). MongoDB stores only its **SHA-256**.
- Cookie: `__Host-fa_session`: `HttpOnly; Secure; SameSite=Strict; Path=/`, no `Domain`, `Max-Age` 14 days. Locally over `http://localhost` it is `fa_session` without `Secure`.
- 14-day absolute expiry. A MongoDB TTL index removes expired sessions, and lookups also check `expiresAt`.
- Login and registration always create a **new** session and delete any session the browser already had (no session fixation).
- **Logout deletes the session server-side**, so a copied cookie stops working. It is idempotent and ends only that device's session.
- Sessions of deleted users are rejected and removed.

### 2.4 CSRF, CORS and credentialed requests (evaluated together)

- **`SameSite=Strict`:** browsers never attach the cookie to cross-site requests.
- **Origin check:** `POST`, `PUT`, `PATCH` and `DELETE` must carry an `Origin` in `CORS_ORIGIN` (the app origin). If a browser omits it, `Sec-Fetch-Site: same-origin` is required. Requests with neither are refused, as are `null` and look-alike origins.
- **JSON-only bodies:** requests with a body must be `application/json`. Form posts (`x-www-form-urlencoded`, `multipart`, `text/plain`) get 415, and cross-origin JSON would need a CORS preflight.
- **CORS is never credentialed** (`credentials: false`) and isn't relied on for security. The app doesn't need it at all, since everything is same-origin.
- **Direct API calls without the proxy secret are refused**, whatever their CORS or Origin headers.

### 2.5 Authorization and data isolation

- `requireAuth` resolves the session to a user. Handlers take the user id **only** from the session (`authenticated(res).userId`) and include it in every query.
- No endpoint accepts a user id. Request bodies must contain exactly the allowed keys, so `id`, `userId`, `role`, `passwordHash`, `_id` and `email` (on profile update) are rejected with 400.
- Public user shape: `{ id, email, name, createdAt }`. The password hash is `select: false` and never serialised.

### 2.6 Rate limiting

| Limit | Key | Counts |
|---|---|---|
| 120 requests/min (all routes, FIT-10) | client IP | all |
| Registration: 5/hour | client IP | all |
| Login: 10/15 min | client IP | failed attempts only |
| Login: 5/15 min | SHA-256 of the normalised email | failed attempts only (slows distributed guessing on one account) |

- **Client IP:** the Worker-supplied value, only when the proxy secret is valid and the value is a well-formed IP. Otherwise it's `req.ip` (governed by `TRUST_PROXY_HOPS`), so forged values never create a fresh quota. IPv6 is grouped by /56.
- **Storage:** counters are in memory, per instance.

### 2.7 Errors, logging, availability

- **Login:** always `401 INVALID_CREDENTIALS`, "Email or password is incorrect.", for unknown emails, wrong passwords and malformed input alike.
- **Registration:** a duplicate email returns `409 EMAIL_TAKEN`. This necessarily reveals that the account exists; it's rate-limited, and avoiding it would need email verification (section 8).
- **Logs:** the logger never receives bodies, headers or cookies. A test drives the full flows plus a forced 500 and checks the log output for passwords, tokens and cookie names.
- **Caching:** all API responses carry `Cache-Control: no-store`. The service worker has no runtime caching (FIT-9).
- **Cold starts:** while MongoDB is disconnected (Render cold start, Atlas reconnect), auth endpoints return `503 SERVICE_UNAVAILABLE` with `Retry-After: 5` instead of hanging. The frontend uses 70-second timeouts for auth calls and shows "Waking up Fitness AI…" after 4 seconds.

### 2.8 Frontend

- `AuthProvider` asks `GET /api/auth/me` on start, so the session survives reloads with nothing stored except the cookie. Status is one of `loading`, `authenticated`, `unauthenticated`, `unavailable`.
- **`unavailable`** (offline, cold start, outage) is not treated as logged out. A "You're offline" or "Can't reach Fitness AI" screen retries with back-off (2 s, 4 s, 8 s, 15 s, 30 s…), immediately when the device comes back online, and when the app returns to the foreground.
- `RequireAuth` protects all app routes and redirects to `/login?redirect=…`. `GuestOnly` sends signed-in users away from the login and registration pages. `safeRedirectPath` accepts only same-app paths (no `//host`, `/\host`, schemes or control characters).
- Login and registration forms use the existing design system. They have client validation matching the server, per-field server errors, focus on the first invalid field, correct `autocomplete` values, double-submit protection, and a cold-start hint.
- The account menu shows the real name and email and has **Log out**. If logout fails, the user stays signed in with an explanation, because the server session still exists. The placeholder profile was removed.

## 3. Endpoints

| Method and path | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/register` | — | `{ email, password, name }` | 201 `{ user }` + cookie | 400 `VALIDATION_FAILED` (+`fields`), 409 `EMAIL_TAKEN`, 429, 503 |
| `POST /api/auth/login` | — | `{ email, password }` | 200 `{ user }` + new cookie | 400 (missing fields), 401 `INVALID_CREDENTIALS`, 429, 503 |
| `POST /api/auth/logout` | optional | — | 204, cookie cleared, session deleted | 403 `CSRF_REJECTED` |
| `GET /api/auth/me` | session | — | 200 `{ user }` | 401 `UNAUTHENTICATED`, 503 |
| `PATCH /api/users/me` | session | `{ name }` | 200 `{ user }` | 400, 401, 503 |

All state-changing requests go through the CSRF checks. In production, every route except `GET /api/health` requires the proxy secret.

## 4. Bugs found during FIT-11 verification (all fixed, all covered by tests)

1. **Lone-surrogate password collision** (section 2.2). This was a real authentication flaw at the encoding layer.
2. **The Worker would not have started on Cloudflare.** Cloudflare's runtime (workerd) treats every named export of the Worker entry module as an entrypoint, and the entry exported constants. The logic moved to `worker/proxy.ts`, and a test asserts the entry exports only `default`. Found by running the real runtime (`wrangler dev`). Unit tests and a dry-run deploy didn't show it.
3. **The service worker would not install on Workers hosting.** The default `html_handling` answers `/index.html` with a 307 to `/`, and Workbox's precache fetch of `/index.html` (the offline shell) then failed. As a result, no offline support and no updates. Fixed with `html_handling: "none"`; the SPA fallback still serves `/` and deep links. A config test pins the setting.
4. **The "120-character password prefix" result was a test bug, not an app bug.** The test's "120-character" passphrase was actually 88 characters, so both "slices" were the same full password. A dedicated suite now proves, at the hashing level and end to end against real MongoDB, that only the exact password authenticates. It covers:
   - 120- and 128-character passwords against their 119/127-character prefixes, a changed last character, an appended character or NUL, a different case, and a leading space
   - the 72/73-byte boundary where bcrypt truncates
   - embedded NUL bytes
   - half an emoji
   - NFC vs NFD text
   - lone surrogates

## 5. Test results (exact)

### Automated suites

| Suite | Result |
|---|---|
| Backend (`backend/`, Vitest, real `mongod` via `mongodb-memory-server-core`) | **214 / 214** in 13 files, 3 consecutive runs (FIT-10: 103). Includes 19 password-integrity tests |
| Frontend + Worker + config (root, Vitest/jsdom) | **397 / 397** in 35 files (FIT-10: 298). Includes 29 Worker/config tests |
| Typecheck (frontend `tsc -b`, backend `tsc`), ESLint (both) | Pass |
| Production builds (frontend `vite build`, backend `tsc`) + `npm run verify:pwa` | Pass (17 precached files; CSP `connect-src 'self'`) |
| `npm audit` (frontend, backend) | 0 vulnerabilities |

**Backend tests cover:**
- **Registration and login:** cookie attributes, Argon2id storage, token hashing, validation and mass-assignment rejection, and the duplicate-email race (5 concurrent registrations give exactly 1 account).
- **Login security:** same response for wrong password and unknown email, the timing check, and session rotation and fixation.
- **Sessions:** persistence across client reloads and an API restart; forged, malformed, expired and deleted-user sessions rejected.
- **Logout and server-side invalidation:** a copied cookie stops working; only the current device's session ends.
- **Isolation, CSRF and CORS:** cross-user isolation; CSRF (foreign, look-alike and `null` Origin, cross-site and same-site fetch metadata, form content types); CORS never credentialed.
- **Proxy gate:** exact health exemption, exact secret, forged and malformed client-IP values; rate limits per IP, per email and failures-only.
- **Availability and logs:** 503 while MongoDB is disconnected; nothing secret in logs.

**Frontend tests cover:**
- **Auth service:** endpoint calls, error-to-copy mapping, server text never shown.
- **AuthProvider:**
  - session restored on reload
  - outage treated as unavailable, with back-off retry
  - reconnect on `online`
  - cold-start hint
  - fail-closed on malformed data
  - logout failure keeps the session
  - nothing written to web storage; `document.cookie` empty
- **Guards:** redirects and safe `?redirect=`; the offline screen instead of the login page.
- **Forms:** validation, server errors, rate limit and network messages, double-submit, slow hint.
- **Account menu:** shows the user; logout success and failure.
- **Worker:**
  - secret and client-IP injection with forged headers removed
  - paths stay on the API origin
  - multiple `Set-Cookie` headers pass through
  - 502 on unreachable API, 413 on large bodies
  - refuses `http://` origins and missing configuration
  - entry exports only `default`
  - `wrangler.jsonc` settings pinned

### Production-like integration (local)

**Setup:**
- `wrangler dev` (Cloudflare's workerd runtime) serving the production build with the real Worker, `_headers` and SPA fallback.
- The real Express app with production cookie settings (`__Host-`, `Secure`) and `PROXY_SECRET`.
- A real `mongod` 8.3.
- Google Chrome via Playwright.

**Results:**
- **Auth, security and PWA: 36 / 36.**
  - **Redirects:** to login with `?redirect`; registration returns to the requested page.
  - **Cookie:** `__Host-` / `HttpOnly` / `Secure` / `SameSite=Strict`, host-only; invisible to JavaScript; empty web storage.
  - **Database:** Argon2id hash and token hash.
  - **Session use:** account menu; reload persistence; `/api/auth/me` via the Worker with `no-store`.
  - **Attacks rejected:** cross-origin logout (403); form body (415); stolen cookie used against the API directly (403).
  - **Service worker and offline:** service worker active with no `/api` in Cache Storage; offline shows the offline screen, not the login page; automatic reconnect.
  - **Two users:** isolation; duplicate email; logout clears the cookie and the token is rejected afterwards; the other user stays signed in; same message for unknown email; correct login.
  - **Static assets:** served directly; unknown `/api` paths are answered by the API (JSON 404), never by the SPA fallback; precache of 17 files including `/index.html`; signed-out offline start shows the offline screen.
  - **Console:** no CSP violations or page errors.
- **PWA update flow on Workers: 7 / 7.**
  - **Detection:** a new build is detected and the notice shown; v1 keeps running; a plain reload doesn't switch.
  - **Update:** "Reload to update" activates v2; v1 files are removed from the cache; no `/api` entries; notice gone.

**Notes:**
- A missing static file fetched by script receives `index.html` with 200. That's Cloudflare's documented single-page-application fallback, the same as Cloudflare Pages in FIT-10, not a regression.
- The FIT-9 preview suite (41 checks against an API stub without auth endpoints) was not re-run. Its offline-deep-link expectations predate authentication; the two suites above replace it with real-auth equivalents.

## 6. Environment variables

| Where | Name | Notes |
|---|---|---|
| Render | `NODE_ENV=production`, `TRUST_PROXY_HOPS=1` | in `render.yaml` |
| Render | `CORS_ORIGIN` | the Worker origin, `https://fitness-ai.mhmod-2004-2006.workers.dev` (CORS + CSRF allowlist) |
| Render | `MONGODB_URI` | **secret**, least-privilege Atlas user (FIT-10) |
| Render | `PROXY_SECRET` | **secret**, ≥ 32 chars, identical to the Worker secret |
| Cloudflare Worker | `API_ORIGIN` | public, `wrangler.jsonc` `vars`: `https://fitness-ai-api-5te2.onrender.com` |
| Cloudflare Worker | `PROXY_SECRET` | **secret**, runtime (dashboard → Settings → Variables and Secrets → Add → type Secret, or `npx wrangler secret put PROXY_SECRET`); listed in `wrangler.jsonc` `secrets.required`, so `wrangler deploy` fails until it is set |
| Cloudflare build | `VITE_API_BASE_URL=/api` | public; committed in `.env.production`. Do not set it as a build variable: Workers Builds (`WORKERS_CI=1`) fails on any other value (`deploy/build-guard.ts`) |

No session secret is needed: tokens are random and looked up by hash, not signed.

## 7. Deployment instructions (not performed)

1. **Generate the shared secret** locally with a cryptographic RNG: `openssl rand -base64 48`, or in PowerShell (copies to the clipboard without printing it):
   `$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) | Set-Clipboard`.
   Do not use `Get-Random` (not cryptographically secure). Store it in a password manager.
2. **Render:** set `PROXY_SECRET` and change `CORS_ORIGIN` to the Worker origin. The Blueprint lists `PROXY_SECRET` with `sync: false`.
3. **Cloudflare:**
   - The Worker's name must match `name` in `wrangler.jsonc` (`fitness-ai`); `workers_dev: true` keeps `https://fitness-ai.mhmod-2004-2006.workers.dev`.
   - `API_ORIGIN` in `wrangler.jsonc` is `https://fitness-ai-api-5te2.onrender.com`.
   - Add the `PROXY_SECRET` runtime secret **before pushing** (`secrets.required` makes the deploy fail without it). Do not add `API_ORIGIN` in the dashboard: `vars` replace dashboard variables on every deploy, while secrets are kept.
   - Build settings: root directory empty, build command `npm run build`, deploy command `npx wrangler deploy` (no extra flags; the pinned devDependency `wrangler` is used). Remove any `VITE_API_BASE_URL` build variable.
4. Push, then let both services deploy.
5. **Verify live:**
   - `GET https://<render>/api/auth/me` returns **403**, and `/api/health` returns 200.
   - Through the Worker, `/api/auth/me` returns **401**.
   - Register, reload, log out and log in on the Worker URL.
   - In devtools, check the cookie is `__Host-fa_session` with HttpOnly/Secure/Strict, and that the service worker is active.
6. **Rollback:** Cloudflare deployments → Rollback; Render → Rollback (FIT-10 section 12).

Rotate `PROXY_SECRET` by setting a new value on both sides. Requests fail with 403 in the moment between the two changes.

## 8. Remaining limitations and unverified behaviour

**Not verified (no deployment, no devices):**
- **iPhone/Safari:** login and the first-party `__Host-` cookie in Safari and in the installed Home-Screen app are expected to work (same-origin, `SameSite=Strict`) but were **not tested on an iPhone**. All browser tests used Chrome. Android was not tested on a device either.
- **The Cloudflare edge.** Only the local Workers runtime was tested. Specifically, that real `CF-Connecting-IP` values arrive and that Render receives the secret header unchanged.
- **Render behaviour:** the proxy hop count (`TRUST_PROXY_HOPS=1`), cold-start timing (~1 minute) and the 503/502 retry path against a real cold start.
- **Atlas:** `createIndexes` on start-up with the least-privilege `readWrite@fitness_ai` user (expected to be allowed by that role).
- **Argon2 on Render:** the native module (prebuilt for Linux x64) building and running there, and the hashing latency on a free 0.1-CPU instance.
- **Backend DB tests on Windows:** they need the one-time `mongod` download by `mongodb-memory-server-core` (about 100 MB) on the first run.
- **Session-time CORS/CSRF in production:** they depend on `CORS_ORIGIN` being exactly the Worker origin. If it's wrong, every login returns 403 `CSRF_REJECTED`.

**Functional limitations (by design for FIT-11):**
- No email verification, password reset, password change, "log out everywhere", account deletion or MFA. The registration endpoint therefore reveals whether an email is registered (rate-limited).
- No breached-password check (e.g. Have I Been Pwned range API). Only length, NFKC and the email check apply.
- Sessions have a fixed 14-day lifetime with no idle timeout.
- Rate-limit counters are in memory per instance and reset on restart. A shared store is needed when scaling out.
- If a session expires while the app is open, the user only notices on the next session check (reload or returning from offline). No screen fetches user data yet.
- Signed-in users who open the installed app offline see "You're offline" instead of cached pages. There is no offline user data by design.
- The Worker adds one network hop. Its requests count against Cloudflare's free daily Worker allowance; static files don't.
