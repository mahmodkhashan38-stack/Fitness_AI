# FIT-14 deployment runbook (two stages)

FIT-14 changes the API contract (birth year), so the backend must be live before the frontend. The release is
split into two commits so each stage is deployed by its own push:

| Stage | Commit | Touches | Render (API) | Cloudflare Workers Builds (app) |
|---|---|---|---|---|
| 1 | `feat(api): FIT-14 …` | `backend/**`, this runbook | Deploys: the build filter `backend/**` matches | Rebuilds, but the app's files are unchanged, so the result is identical to production (same `index-*.js` asset name) |
| 2 | `feat(web): FIT-14 … [skip render]` | Frontend, docs | Skipped: nothing under `backend/**`, plus the skip phrase | Builds and deploys the new app |

Production: app `https://fitness-ai.mhmod-2004-2006.workers.dev`, API `https://fitness-ai-api-5te2.onrender.com`.
Never paste secrets into commands; none of the steps below need one.

## 0. Before stage 1

1. Confirm the commits: `git fetch origin`, then `git log --oneline origin/main..<STAGE2_SHA>` lists exactly the
   two FIT-14 commits, stage 1 first, and `git merge-base --is-ancestor origin/main <STAGE1_SHA>` succeeds (a
   fast-forward, no force push).
2. Render → service `fitness-ai-api` → **Settings**: Auto-Deploy **On Commit**; Build Filters include `backend/**`.
   Note the currently live deploy (Events) as the rollback target.
3. Cloudflare → Workers & Pages → `fitness-ai` → **Deployments**: note the active version (rollback target).
   **Settings → Builds**: production branch `main`, build `npm run build`, deploy `npx wrangler deploy`,
   variable `VITE_API_BASE_URL=/api`.
4. Data safety: export the `fitnessprofiles` collection (Atlas Data Explorer, or `mongodump` with the connection
   string taken from an environment variable, never typed on the command line). Record the counts from section 4.

## 1. Stage 1: backend only

```powershell
git push origin <STAGE1_SHA>:refs/heads/main
```

Wait for Render's deploy of that SHA to show **Live** (the `/api/health` check gates the switch; the old instance
keeps serving until then) and for the Cloudflare build to finish.

Verify (no accounts are created):

- `GET https://fitness-ai.mhmod-2004-2006.workers.dev/api/health` → 200, `database: "connected"`.
- The app still serves the production bundle `index-B9x5z6un.js` (page source).
- The new API is the one answering: a registration attempt with an invalid birth year is refused **without writing
  anything**:

  ```powershell
  $probe = Join-Path $env:TEMP "fit14-probe.json"
  '{"email":"probe@invalid.example","password":"x","name":"x","profile":{"birthYear":1800}}' | Set-Content -Encoding ascii $probe
  curl.exe -s -X POST "https://fitness-ai.mhmod-2004-2006.workers.dev/api/auth/register" `
    -H "Origin: https://fitness-ai.mhmod-2004-2006.workers.dev" -H "Content-Type: application/json" --data-binary "@$probe"
  Remove-Item $probe
  ```

  FIT-14 answers `400` with a `birthYear` field error ("Birth year must be between …"); the FIT-13 API would
  answer "Unexpected field: birthYear." (It counts towards the registration limit of 5 per hour per IP.)
- With your own account in the current app: log in, open Profile (age shown as before), edit weight, reload, log
  out and in again.

If anything fails: section 3, stage 1.

## 2. Stage 2: frontend

```powershell
git push origin <STAGE2_SHA>:refs/heads/main
```

Render shows no new deploy (or a "skipped" event). Wait for the Cloudflare build to deploy.

Verify:

- The app serves the new `index-*.js` (the hash given in the release report).
- Open tabs show "Reload to update"; after reloading, Registration and Body Information ask for **Birth year**.
- With your own account (created before FIT-14, so it has an age): Profile shows "Birth year: Not added" and the
  "Add your birth year" notice; add it; the age shows "… this year" and the notice disappears; edit weight; reload;
  log out and in.
- Registration with a birth year: only with an account you are willing to keep (there is no account deletion);
  otherwise rely on the local end-to-end results and the stage-1 probe.
- Onboarding: only accounts created before FIT-12 see it; verified locally.
- Data checks (section 4) after the first real birth years are saved.

## 3. Recovery

**Stage 1 fails.** A failed Render build or health check leaves the previous deploy live. If the new API is live
but misbehaving, roll it back: Render → Events → the previous successful deploy → **Rollback**. This is safe during
stage 1: the production app never sends `birthYear`, so no birth-year-only profile exists yet (check: count of
`birthYear` documents is 0). A dashboard rollback **turns Auto-Deploy off**; turn it back on before the next
release. Fix the problem in a new commit; stage 2 waits.

**Stage 2 fails.** Roll back the app only: Cloudflare → `fitness-ai` → Deployments → ⋯ on the previous version →
**Rollback** (or `npx wrangler rollback <version-id>`). **Keep the FIT-14 API.** It serves the previous app
correctly, including for profiles that now have a birth year: they get the derived `age`, and if that app sends an
`age` for them the API refuses it, so the birth year is never lost (verified locally with the production bundle).

**Rolling the API back after stage 2 (avoid).** The FIT-13 API would return birth-year-only profiles without an
`age`, which the FIT-13 app can't load. Fix forward instead. If a rollback is unavoidable:

1. Roll back the app first (as above), then the API.
2. Immediately backfill, keeping the birth year (Atlas Data Explorer or mongosh; replace `<YEAR>` with the current
   UTC year):

   ```js
   db.fitnessprofiles.updateMany(
     { birthYear: { $type: "number" }, age: { $exists: false } },
     [{ $set: { age: { $subtract: [<YEAR>, "$birthYear"] } } }],
   )
   ```

   The FIT-13 API then serves and updates these profiles; it ignores `birthYear`, which stays in the document.
3. When the FIT-14 API is back, the birth year is again the source of the age (the temporary `age` is ignored and
   old clients still can't overwrite it). Then remove the temporary ages:

   ```js
   db.fitnessprofiles.updateMany({ birthYear: { $type: "number" }, age: { $exists: true } }, { $unset: { age: "" } })
   ```

Never delete or `$unset` `birthYear` during recovery. This drill (rollback, backfill, roll forward, cleanup) passes
locally.

## 4. Data checks (read-only)

```js
db.fitnessprofiles.countDocuments({ birthYear: { $exists: true } })                        // grows after stage 2
db.fitnessprofiles.countDocuments({ age: { $exists: true }, birthYear: { $exists: false } }) // profiles still to ask
db.fitnessprofiles.countDocuments({ age: { $exists: true }, birthYear: { $exists: true } })  // 0 (except during recovery)
db.fitnessprofiles.countDocuments({ age: { $exists: false }, birthYear: { $exists: false } }) // must be 0
```
