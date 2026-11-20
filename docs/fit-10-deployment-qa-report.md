# FIT-10 — Public Deployment, HTTPS & Production Security: QA Report

Date: 2026-11-20 · Base commit: `a6a7270` (FIT-9)

> **Status: implementation complete and verified locally; live deployment pending.**
> Deploying needs the account owner: signing in to Cloudflare and Render with GitHub, entering the database
> secret, approving Atlas network access, and pushing the reviewed commit. Sections marked **(pending)** are
> filled in only after the deployment has been checked over real HTTPS. No public URL in this report is claimed
> to work until it has been tested.

> **Public preview, not a production fitness platform.**
> - There is no authentication and no user accounts.
> - The only API endpoint is `GET /api/health`.
> - No screen collects or stores personal or fitness data. Login and Register are labelled placeholders, and the account menu shows a placeholder profile.
>
> Nothing in this deployment protects user data, because none exists yet. Authentication and authorization must be designed and reviewed before any personal data is accepted.

## 1. Hosting architecture

```
Browser / installed PWA
   │  https://<project>.pages.dev            (static: HTML, JS, CSS, fonts, icons, sw.js, _headers)
   ├──────────────► Cloudflare Pages (global CDN, TLS, SPA fallback)
   │
   │  https://<service>.onrender.com/api/…   (cross-origin fetch, CORS allowlist = the Pages origin)
   └──────────────► Render web service (Node 22, Express 5, Frankfurt)
                         │  mongodb+srv:// (TLS), dedicated readWrite@fitness_ai user
                         └──────────────► MongoDB Atlas M0 (existing cluster)
```

- **Separate origins.** Cloudflare Pages `_redirects` cannot proxy external domains, so a same-origin `/api` would need a paid or Functions-based proxy. Separate origins also let the API see each client's real IP for rate limiting.
- **CORS allows exactly one origin:** the production Pages origin. Preview deployments (`<hash>.<project>.pages.dev`) are blocked by CORS on purpose.
- **The service worker never handles API requests.** They go to another origin, and the FIT-9 rules (no runtime caching, `/api` network-only) still apply.

## 2. Providers and rationale

Checked against official docs on 2026-11-20.

| | Cloudflare Pages (chosen, frontend) | Netlify Free (rejected) | Render Free web service (chosen, API) |
|---|---|---|---|
| Cost | $0 | $0 | $0 (Hobby workspace, `plan: free`) |
| Card required | No | No | No |
| Limits | Unlimited static requests and bandwidth; 500 builds/month; 1 concurrent build; 20 min build timeout | 300 credits/month hard cap; 15 credits per production deploy (≈ 20 deploys); bandwidth 20 credits/GB; projects **pause** when credits run out | 750 instance hours/month (one service all month); spins down after 15 min idle; ~1 min wake-up; may be restarted at any time |
| HTTPS | Automatic (`*.pages.dev`) | Automatic | Automatic (`*.onrender.com`) |
| Env vars / Git deploys | Build env vars; GitHub integration | Same | Dashboard env vars, Blueprint (`render.yaml`); GitHub integration |
| Fit | Static SPA with `_headers` and SPA fallback | A same-origin proxy would spend credits on every API call | Native Node runtime; works with Atlas over TLS |

**Atlas network access.**
- Render sends outbound traffic from per-region IP ranges, shown under the service's *Connect → Outbound* tab. These ranges are shared with all Render services in the region.
- Dedicated IPs need a paid Pro workspace.
- Render's docs don't say whether free instances show these ranges; check this during setup (section 7, step 4).

## 3. Public frontend URL — (pending)

## 4. Public API URL — (pending)

## 5. Costs and free-tier limitations

The verified monthly cost is **$0**. Nothing was purchased or enabled for billing.

- **Render Free:**
  - The API spins down after 15 minutes without traffic.
  - The first request after that takes about a minute. The health check returns 503 until MongoDB is connected.
  - 750 instance hours a month is enough for exactly one always-available free service.
  - Render may restart free services at any time, and the in-memory rate-limit counters reset when it does.
- **Cloudflare Pages Free:** 500 builds a month, one at a time. Static requests are unlimited.
- **Atlas M0:** free shared cluster, limited storage and throughput (unchanged from FIT-8).

## 6. Environment variables (names only)

| Where | Variable | Value | Secret |
|---|---|---|---|
| Cloudflare Pages build | `VITE_API_BASE_URL` | `https://<service>.onrender.com/api` | No: public, embedded in the bundle and the CSP |
| Render | `NODE_ENV` | `production` (in `render.yaml`) | No |
| Render | `TRUST_PROXY_HOPS` | `1` (in `render.yaml`) | No |
| Render | `CORS_ORIGIN` | `https://<project>.pages.dev` (dashboard) | No |
| Render | `MONGODB_URI` | dedicated user's `mongodb+srv://` string (dashboard) | **Yes:** only in Render, never in Git, chat or logs |
| Render | `PORT` | set by Render | No |

Only `VITE_API_BASE_URL` uses the `VITE_` prefix. The build output was checked to contain no backend variable names or connection strings (section 9).

## 7. Deployment procedure

Prerequisite: the FIT-10 commit pushed to `main` on GitHub. Render and Cloudflare deploy from GitHub.

1. **Atlas: dedicated production user** (Atlas → Database Access → Add New Database User):
   - Password authentication, username e.g. `fitness-ai-api`, **Autogenerate Secure Password**. Store the password in your password manager.
   - Under *Database User Privileges*, choose *Specific Privileges*: role `readWrite`, database `fitness_ai`. Do not grant *Atlas admin* or *readWriteAnyDatabase*.
   - Optionally restrict it to `Cluster0`.
2. **Render: create the API from the Blueprint.**
   - Dashboard → **New → Blueprint** → connect GitHub → select `Fitness_AI` → Render reads `render.yaml`.
   - When prompted, enter `MONGODB_URI` (the new user's `mongodb+srv://…/fitness_ai?retryWrites=true&w=majority` string) and `CORS_ORIGIN` (the planned Pages origin, e.g. `https://fitness-ai.pages.dev`; it can be corrected later).
   - Apply. Confirm the plan shows **Free**.
3. **Note the API URL** shown on the service page (e.g. `https://fitness-ai-api.onrender.com`).
4. **Atlas: network access.**
   - On the Render service, open **Connect → Outbound** and add each listed CIDR in Atlas → Network Access → *Add IP Address*.
   - If Render shows no outbound ranges for a free service, the only remaining option is `0.0.0.0/0`. That needs the owner's explicit approval (see risk R1).
   - Then **Manual Deploy → Deploy latest commit** on Render, so the health check passes.
5. **Cloudflare Pages: create the frontend.**
   - Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → select `Fitness_AI`.
   - Project name `fitness-ai`; production branch `main`; framework preset *None*.
   - Build command `npm run build`; build output `dist`; root directory empty.
   - Environment variable `VITE_API_BASE_URL=https://<service>.onrender.com/api`.
   - Save and deploy.
6. If the Pages URL differs from the planned `CORS_ORIGIN`, update `CORS_ORIGIN` in Render (*Environment*) and let it redeploy.
7. Run the live checks in section 9.

## 8. Security measures

| Area | Measure | Verified |
|---|---|---|
| Transport | HTTPS from both hosts; HSTS (`max-age=31536000; includeSubDomains`) from frontend and API; CSP `upgrade-insecure-requests` | Locally (headers); live (pending) |
| Frontend CSP | Generated at build (`deploy/security-headers.ts` → `dist/_headers`): `default-src 'self'`; scripts from the site plus the SHA-256 of the inline theme script (no `unsafe-inline`/`unsafe-eval`); `connect-src` only the site and the API origin; `frame-ancestors 'none'`; `object-src 'none'`; same-origin worker/manifest/form/base | Unit tests + `verify:pwa` + Chrome run with zero violations |
| Other frontend headers | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` denying camera, microphone, geolocation, payment, USB | Unit tests |
| Caching | `sw.js`, `index.html`, manifest `no-cache`; hashed `/assets/*` immutable for 1 year; service worker as in FIT-9 (no API caching) | Unit tests, `verify:pwa`, 41-check PWA suite |
| API headers | Helmet with an API-only CSP (`default-src 'none'`), HSTS, `nosniff`, frame protection; no `X-Powered-By` | Backend tests |
| CORS | Exact allowlist from `CORS_ORIGIN`; `*` rejected at start-up; https-only in production; no credentials | Backend tests; local cross-origin browser run |
| Rate limiting | 120 requests/min per client IP on all routes; JSON 429 with `Retry-After` | Backend tests |
| IP spoofing | `TRUST_PROXY_HOPS=1` as an Express hop count (never `true`): only the Render-appended address counts; client-sent `X-Forwarded-For` values are ignored | Backend tests for 0 and 1 hop; live (pending) |
| Input/body | 100 KB JSON limit, strict JSON, 400/413/415 without parser details, unknown routes 404 without echoing the path, request id validated | Backend tests (FIT-8) |
| Errors and logs | No stack traces or internal messages in responses in any environment; logs redact credentials in URLs and `password=`/`token=` values; no query strings, bodies or headers logged | Backend tests (FIT-8) |
| Configuration | Start-up refuses: missing `MONGODB_URI`, `CORS_ORIGIN` or `TRUST_PROXY_HOPS` in production, http/`*` origins, non-TLS MongoDB in production, weakened TLS options anywhere | Backend tests |
| Database | Dedicated least-privilege user (`readWrite@fitness_ai`), TLS (`mongodb+srv`), credentials only in Render env, never in the browser | Config tests; Atlas setup is a manual step |
| Secrets | `.env`/`.env.*` ignored (only `.env.example` files tracked, placeholders only); `render.yaml` has no secret values (`sync: false`); staged diff scanned | Section 9 |
| Incomplete features | No auth or data endpoints exist; nothing to disable. The only route is the read-only health check | Code audit |

## 9. Test results

### Code checks (this commit)

| Check | Result |
|---|---|
| Frontend typecheck, lint | Pass |
| Frontend tests | **298 / 298** (FIT-9: 277; +21 for the security-header generator) |
| Frontend production build + `npm run verify:pwa` (now also checks `_headers`) | Pass |
| Backend typecheck, lint, build | Pass |
| Backend tests | **103 / 103** (FIT-8/9: 75; +28 for rate limiting, client IP, TLS and proxy configuration) |
| `npm audit` (frontend, backend) | 0 vulnerabilities |
| FIT-9 PWA browser suite (production preview) | 41 / 41 |
| Local production-topology run | **11 / 11**: static server applying the generated `_headers` on one origin, the real Express app (CORS) on another, Chrome. Checked: CSP served; inline theme script, CSS, Inter font and service worker all work under the CSP; cross-origin API call allowed (CORS + `connect-src`) with `RateLimit`/`X-Request-Id` readable; other origins blocked by `connect-src`; account menu works; framing blocked; no CSP violations |

### Live checks (pending)

To run against the deployed URLs:
- **Frontend:** returns 200 over HTTPS, HTTP redirects to HTTPS, SPA routes work after refresh, security headers present, no secrets in assets.
- **API:**
  - Health returns 200 with `database: connected`.
  - Unknown route returns 404, malformed JSON 400, oversized body 413.
  - CORS allows the Pages origin and rejects others.
  - Rate-limit headers present.
  - Spoofed `X-Forwarded-For` doesn't reset the quota. This check stays low-volume, with no load testing.
- **Frontend to API:** the request succeeds from the deployed origin.

## 10. PWA verification on the deployed URL — (pending)

Planned checks:
- manifest, icons and iOS meta tags
- service-worker registration and scope
- Chrome installability
- offline shell
- no API caching
- update detection and old-cache clean-up

Physical iPhone and Android installation is **not verified** by these checks. It needs a real device (section 13/14).

## 11. Known risks and limitations

- **R1: Atlas network access.**
  - Render's outbound ranges are shared with all Render customers in the region.
  - If free services don't expose them, Atlas would need `0.0.0.0/0`. That makes the database password the only barrier.
  - Do this only with explicit approval, a strong generated password, the least-privilege user, and Atlas alerts on.
- **R2: Cold starts.** The first request after 15 minutes idle takes about a minute. The API client's default timeouts (15 s; 5 s for `fetchApiHealth`) will report a timeout during a cold start, and a retry succeeds.
- **R3: Rate limiting.**
  - It's in-memory and per instance, and resets on restart. That's fine for one free instance.
  - It needs a shared store when scaling out.
  - It's IP-based only, so users behind one NAT share a quota. With no logins, there is no better identity yet.
- **R4: Proxy trust.** `TRUST_PROXY_HOPS=1` assumes Render has one proxy hop in front of the app. This is confirmed by the live spoofing check (section 9), and must be re-checked if Render changes its edge or a custom domain/CDN is added.
- **R5: No authentication.** This is a public preview. Anyone can open the app and call `/api/health`. Do not add data endpoints before authentication and authorization exist.
- **R6: Preview deployments.** Cloudflare Pages builds every branch to a public preview URL. They can't call the API (CORS), but their content is public.
- **R7:** The PWA limitations from the FIT-9 report (iOS install is manual, no background sync, storage eviction, theme colour) still apply.

## 12. Rollback

- **Frontend:** Cloudflare → Workers & Pages → project → *Deployments* → choose an earlier deployment → **Rollback**. Users get the earlier version through the normal service-worker update flow ("Reload to update").
- **API:** Render → service → *Events* → earlier deploy → **Rollback**. Or temporarily **Suspend** the service.
- **Code:** `git revert <commit>` and push. Both hosts redeploy `main`.
- **Database access:** Atlas → Database Access → delete or disable the `fitness-ai-api` user, and remove the Network Access entries. The API then fails its health check, and Render stops routing to it.

## 13. Manual iPhone installation

1. Open the HTTPS frontend URL in **Safari**.
2. Tap **Share** (in the toolbar or the "⋯" menu).
3. Tap **Add to Home Screen**.
4. Keep **Open as Web App** on, then tap **Add**.
5. Start Fitness AI from the Home Screen.

## 14. Manual Android installation

1. Open the HTTPS frontend URL in **Chrome**.
2. Tap **⋮ → Install app** (or *Add to Home screen → Install*).
3. Start Fitness AI from the launcher.
