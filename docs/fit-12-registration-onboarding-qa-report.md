# FIT-12 — Mandatory fitness onboarding during registration: QA report

Status: implemented and verified locally. **Not deployed** (no push, no Cloudflare/Render/Atlas changes).

## 1. Summary

- Registration is a four-step, mobile-first form: **Account → Body → Goals → Review**. Sex, age, height (cm),
  weight (kg), main goal and training days per week are mandatory.
- The account and its fitness profile are created by **one request** and written in **one MongoDB transaction**:
  an account never exists without its profile, and a failed registration leaves nothing behind.
- Accounts created before FIT-12 keep working. They are sent to `/onboarding` before any fitness page, can log
  out from there, and complete their profile exactly once.
- `/api/users/me/fitness-profile` (`GET`, `POST`, `PATCH`) gives each signed-in user access to **their own**
  profile only. No endpoint accepts a user id.
- FIT-11 authentication, sessions, cookies, CSRF protection, the proxy gate and rate limits are unchanged.

## 2. Architecture decisions

| Decision | Why | Trade-off |
|---|---|---|
| Separate `fitnessprofiles` collection, unique `userId` | Future modules (workouts, nutrition, progress, AI coach) read fitness data without loading authentication data; one profile per user is enforced by the database. | One extra indexed lookup when resolving a session (`exists`, run in parallel with the user lookup). |
| A profile is only created complete; its existence = onboarding complete | No partially filled profiles to handle; `onboardingCompleted` is derived, never out of sync. `onboardingCompletedAt` records when. | Optional profile fields added later need defaults or their own flow. |
| Registration in one request + one transaction | "No account until all data is valid and the final submit succeeds" and "no orphans" hold even if the server fails between the two writes. Transient errors (write conflicts) are retried by the driver (`withTransaction`). | Requires a replica set. |
| API refuses to start without transaction support | A misconfigured database fails loudly at start-up instead of at the first registration. | A plain local `mongod` must be started as a replica set (`--replSet rs0`, `rs.initiate()`). |
| Session created **after** the commit | The login session is not part of the account's consistency; if creating it fails, the complete account exists and the user can log in (tested). | That user sees an error once and has to log in. |
| Endpoints under `/api/users/me/…` | Matches the existing `PATCH /api/users/me`; "me" makes ownership structural. | — |
| Values validated as JSON numbers, never coerced | `"70"`, `null`, `NaN` are refused rather than guessed. The client parses typed text (a decimal comma is accepted, for iOS regional keypads) and sends numbers. | — |
| Height/weight stored to 0.1 | Self-reported values; more precision is noise. | Rounding, not rejection, of e.g. `72.449` → `72.4`. |
| Minimum age 16 | Plans and future nutrition targets are designed for adults and older teens; avoids collecting minors' data. | Product decision, one constant on each side (`PROFILE_LIMITS`). |
| Whole app shell gated for accounts without a profile | Every current page is part of the fitness app; a single gate is simple and loop-free. | Settings (theme) is unavailable until onboarding is done; the theme toggle stays in the header. |

### Considered and rejected

- **Create the user, then the profile, delete the user on failure** (compensation without transactions): a crash
  between the steps leaves an orphan that blocks the email. Atlas supports transactions, so they were used.
- **Embedding the profile in `users`**: simpler reads, but couples fitness data to authentication data and to
  every query on users.
- **A two-request flow (register, then onboarding)**: would create accounts that are not yet valid.

## 3. Database changes

New collection `fitnessprofiles`:

| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → `users` | required, immutable, **unique index** |
| `sex` | string | `male` \| `female` |
| `age` | number | integer, 16–100 |
| `heightCm` | number | 100–250, stored to 0.1 |
| `weightKg` | number | 30–300, stored to 0.1 |
| `goal` | string | `muscle_gain` \| `fat_loss` \| `maintenance` \| `general_fitness` |
| `trainingDaysPerWeek` | number | integer, 0–7 |
| `onboardingCompletedAt` | Date | required, immutable |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Schema validation is defence in depth behind request validation; its messages never contain the submitted value
(so a validation error that reached a log contains no personal data). `strict: 'throw'` rejects unknown paths.

**Migration:** none needed. Existing users and sessions are untouched. The unique `userId` index is created at
API start-up (`FitnessProfileModel.createIndexes()`, idempotent, needs only `readWrite`), like the FIT-11 indexes.

## 4. API contracts

Every route: same-origin through the Worker, proxy gate, per-IP rate limit, CSRF origin check and JSON-only bodies
for unsafe methods, `Cache-Control: no-store`, standard error body `{ error: { code, message, fields?, requestId } }`.

### `POST /api/auth/register` (changed)

```json
{
  "name": "Maya", "email": "maya@example.com", "password": "…",
  "profile": { "sex": "female", "age": 31, "heightCm": 167.5, "weightKg": 59.2, "goal": "fat_loss", "trainingDaysPerWeek": 3 }
}
```

- `201 { user }`: user and profile committed together; session cookie set.
- `400 VALIDATION_FAILED`: `fields` lists every problem, account and profile fields together (`email`, `name`,
  `password`, `sex`, `age`, `heightCm`, `weightKg`, `goal`, `trainingDaysPerWeek`). Unknown keys (in the body or in
  `profile`, e.g. `userId`) are refused. Nothing is written.
- `409 EMAIL_TAKEN`: nothing is written.

### User payload (`/auth/me`, `/auth/login`, `/auth/register`, `PATCH /users/me`)

`{ id, email, name, createdAt, onboardingCompleted }`. **New:** `onboardingCompleted` (boolean).

### `GET /api/users/me/fitness-profile`

- `200 { profile: { sex, age, heightCm, weightKg, goal, trainingDaysPerWeek, onboardingCompleted: true, onboardingCompletedAt, updatedAt } }`
  (no `userId`, `_id` or account data).
- `404 FITNESS_PROFILE_NOT_FOUND`: onboarding not completed yet.

### `POST /api/users/me/fitness-profile` (complete onboarding)

Body: all six fields. `201 { profile }`. `400 VALIDATION_FAILED`. `409 ONBOARDING_ALREADY_COMPLETED`
(the unique index makes concurrent requests safe: exactly one wins).

### `PATCH /api/users/me/fitness-profile`

Body: any non-empty subset of the six fields; each is fully validated; `null` is refused. Updated with `$set` of
the validated fields only (`userId`, `onboardingCompletedAt`, timestamps can't be changed).
`200 { profile }`. `400 VALIDATION_FAILED`. `409 ONBOARDING_REQUIRED` if there is no profile yet.

All three: `401 UNAUTHENTICATED` without a valid session, `503` while the database is unavailable. `PUT` and
`DELETE` don't exist (404).

## 5. Validation rules

Identical on client (`src/utils/fitness-profile.ts`) and server (`backend/src/fitness/validation.ts`, authoritative).

| Field | Rule | Messages |
|---|---|---|
| Sex | `male` or `female` | Select your sex. |
| Age | whole number, 16–100 | Enter your age. / Enter your age in whole years. / Age must be between 16 and 100. |
| Height | number, 100–250 cm | Enter your height in centimeters. / Height must be between 100 and 250 cm. |
| Weight | number, 30–300 kg | Enter your weight in kilograms. / Weight must be between 30 and 300 kg. |
| Main goal | one of the four goals | Choose your main goal. |
| Training days | whole number, 0–7 | Choose how many days a week you train. / Choose a whole number of days. / Choose between 0 and 7 days. |

Account fields keep the FIT-11 rules and messages. The UI explains that the data is self-reported, private, used
only for personalisation and not medical advice. No other personal data is collected.

## 6. Frontend behaviour

- **Wizard:** progress bar ("Step 2 of 4: Body") plus named steps with `aria-current="step"` (on narrow phones only
  the current step's name is shown). Next validates the current step; Back keeps everything. Enter in a field
  moves to the next step; only the review step's **Create account** submits. Focus moves to the step heading on
  Next/Back and to the first invalid field on errors. Server errors jump to the step that contains the field
  (e.g. email taken → step 1 with a "Go to log in" link). Double submits are blocked; Back and Edit are disabled
  while creating the account; the slow-server hint appears after 4 s.
- **Inputs:** text inputs with numeric keypads (`inputMode`), unit suffixes, range hints; choices are native radio
  inputs styled as cards (keyboard and screen-reader behaviour of radios).
- **Existing accounts:** `RequireOnboarding` wraps the app shell and sends users without a profile to
  `/onboarding?redirect=<where they were going>`. `/onboarding` sits outside that gate, shows a log-out button,
  and `OnboardingOnly` sends completed users on. `/onboarding` is excluded as a redirect target, so the gates can't loop.
- **Profile page:** loads the profile, edits it with the same fields, sends only changed fields, confirms the save.

## 7. Test results

Run on the final code (2026-11-20).

| Suite | Result |
|---|---|
| Backend (Vitest, real `mongod` single-node **replica set**) | **312 / 312** passed (15 files; FIT-11: 214) |
| Frontend + Worker (Vitest, jsdom) | **517 / 517** passed (40 files; before: 414) |
| Typecheck (frontend `tsc -b`, backend `tsc`) | pass |
| ESLint (frontend incl. import boundaries, backend) | pass |
| Backend build | pass |
| Production build as on Cloudflare (`WORKERS_CI=1`) + `verify:pwa` | pass (17 precached files, 3 icons) |
| `npm audit --omit=dev` (backend) | 0 vulnerabilities |
| End-to-end, real stack (see below) | **42 / 42** checks passed |

### New backend tests

- `fitness-validation.test.ts` (unit): every field, boundaries, rounding, no coercion of strings/null/NaN, unknown
  keys (`userId`, `_id`, `onboardingCompletedAt`), partial updates, schema messages without values.
- `fitness-profile.test.ts` (integration):
  - Registration with a profile: user and profile stored and linked; public shape without ids.
  - Missing or invalid profile values (12 cases): `400` with the field and nothing written; messages don't echo values.
  - Duplicate email: `409`, still one user and one profile, the original profile unchanged. Five concurrent
    registrations: exactly one account and one profile.
  - **Failure recovery:** profile write fails inside the transaction → `500`, **no user, no profile, no session**,
    the error is logged without email, password or profile values, and a retry succeeds.
  - A transient transaction error is retried and commits exactly once.
  - A failure after the commit (session creation) leaves a complete account that can log in.
  - Existing accounts: login works with `onboardingCompleted: false`; `GET` 404; `PATCH` 409; onboarding once
    (second → 409, profile unchanged); five concurrent onboarding requests → one profile; other sessions stay
    valid and see the new state.
  - Updates: only submitted fields change, `onboardingCompletedAt` kept; invalid or protected fields refused with
    no change; no `PUT`/`DELETE`.
  - Unauthorized (no, forged or ended session) → 401; CSRF (foreign or missing Origin → 403, non-JSON → 415).
  - **Cross-user isolation:** a user id in the query, body or path is never used; one user's update never touches
    another's profile; onboarding can't attach a profile to another account.
  - Sessions: a new login sees the same profile; renaming the account keeps the flag.
- `startup.test.ts`: the real server refuses to start on a standalone MongoDB with a clear message.
- FIT-11 suites (auth, security, password integrity, rate limits, CORS, …) pass unchanged in intent; their
  registration bodies now include a valid profile.

### New frontend tests

- Registration wizard (25): progress and `aria-current`, FIT-11 account rules, focus management, every body/goal
  rule, value preservation across Back/Next, Enter = Next, review content (no password), exact API payload
  (decimal comma → number), Edit returns to a step, server errors jump to their step, network error, double-submit
  and Back blocked while submitting.
- Gates (10 + 11 with real routes): every app route sends a pending account to `/onboarding` (with redirect,
  without app navigation), logout works (and reports failure), completed users never see onboarding, no loops for
  `redirect=/onboarding`, after saving the user continues to the original page inside the app.
- Onboarding and profile forms, `AuthProvider.completeOnboarding` (incl. "already completed" and failures),
  API service (paths, methods, payload validation, error mapping), validation and conversion utilities,
  `safeRedirectPath` excludes `/onboarding`, `parseAuthUser` requires the flag.

### End-to-end (real stack)

Built frontend served by `wrangler dev` (the production Worker: static assets + `/api` proxy with `PROXY_SECRET`)
→ the compiled API (`node dist/server.js`) → a local MongoDB 8.3 replica set. Chromium with iPhone 13 emulation
(390 px, touch) and a 1280 px desktop pass. Checked: the four-step registration including validation, focus,
Back, the review, "no account before the final submit", landing on the redirect target; the stored profile; the
cookie flags; persistence across reload; editing on the profile page (PATCH contains only the change); refusal of
a `userId` and of a second onboarding through the Worker; duplicate email back on step 1; logout; a pre-FIT-12
account sent to onboarding from two different pages (no app navigation, logout visible, API 404/409), completing it
and continuing to the requested page; `/onboarding` leaving for completed users; service worker active; **axe
(WCAG 2.2 AA): 0 violations** on every wizard step, the onboarding page and the profile page; no horizontal
overflow at 390 px; no CSP violations or script errors. Database afterwards: 2 users, 2 profiles, no orphans.
The API log contained no email, password or profile values.

## 8. Known limitations and unverified behaviour

- **Not verified on a real iPhone / iOS Safari** (WebKit could not be installed here; Chromium emulation only):
  numeric keypads, the decimal comma, focus scrolling and safe areas should be checked on a device.
- **Not verified against the production Atlas cluster.** Atlas clusters, including the free tier, are replica sets,
  so transactions are expected to work; the API checks this at start-up and refuses to start otherwise.
- **Age is stored as entered** and does not increase over time. If future modules need the current age, store a
  birth year instead (a schema change plus a one-time prompt).
- Sex is limited to male/female, as specified; it is used only for future calculations.
- When onboarding is completed in one tab, other open tabs notice on reload (submitting there again is treated as
  done, not as an error).
- Browsers with an **old cached app version** (PWA before the update prompt is accepted) can still log in, but
  registering fails with "Check your details", and that version doesn't send accounts without a profile to
  onboarding, until the app updates. No fitness API exists yet, so nothing is exposed; future fitness endpoints
  must check for the profile server-side (`409 ONBOARDING_REQUIRED`).
- No account deletion exists yet; when it is added it must delete the profile too.

## 9. Deployment requirements

No new environment variables, secrets or manual database steps.

1. **Atlas:** the database user needs `readWrite` on `fitness_ai` (unchanged). Transactions and the new index need
   nothing more.
2. **Order and window:** pushing deploys Render (backend changed) and Cloudflare at the same time. Until **both**
   are live, the old API rejects the new registration body (`profile`), and the new app refuses user payloads
   without `onboardingCompleted` (it fails closed and shows the login page). Expect a few minutes in which
   registration and sign-in fail. To avoid it, deploy Render first (for example by pausing Cloudflare builds until
   Render is live).
3. **After deployment, check:**
   - The Render log shows `API listening` (no "does not support transactions").
   - `GET /api/auth/me` through the Worker → 401; after login, the user includes `onboardingCompleted`.
   - Register a new account through the wizard; the Profile page shows the entered values.
   - Log in with an account created before FIT-12: it lands on "Complete your profile"; after saving it continues
     into the app.
   - On an iPhone in Safari: the wizard keypads, the review step and the onboarding page.
4. **Rollback:** Cloudflare and Render rollbacks restore FIT-11 behaviour. Profiles created meanwhile stay in
   `fitnessprofiles` and are ignored by the FIT-11 code; no data needs to be removed.
