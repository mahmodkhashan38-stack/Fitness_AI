# FIT-14 — Personal and Body Information Management: QA report

Status: implemented and verified locally. **Not deployed** (no push, no Cloudflare, Render or Atlas changes).

## 1. Summary

- The fitness profile stores a **birth year** instead of an age, so the age no longer goes stale. Registration,
  onboarding and the Profile page's Body Information card ask for **Birth year** (numeric keypad, `bday-year`
  autofill).
- **Existing profiles are not migrated by guessing.** A profile saved before FIT-14 keeps the age the user
  entered until they add a birth year. The Body Information card asks for it with a notice and an
  **Add birth year** button. For these users the field is optional, so other edits never need it. Saving a birth
  year removes the stored age.
- Name editing (FIT-13) and the read-only email are unchanged. No email-change flow was specified.
- The API stays compatible with installed apps that haven't reloaded yet. Responses keep `age`, and requests may
  still send `age`.

## 2. Decisions

| Decision | Why | Trade-off |
|---|---|---|
| Birth year, not a full date of birth | Keeps the age current while collecting less personal data. | The exact age within the year is unknown; the UI says "29 this year". |
| Range: the user turns 16–100 **this calendar year** | Same rule as FIT-12's age limits, expressed for a year. | Someone who is 15 and turns 16 later this year is accepted, which is also true of any year-only rule. |
| UTC year on client and server | Both apply the same rule. | Around New Year, a user's local year can differ from UTC for a few hours. |
| Ask existing users; don't estimate | No invented data. The product owner chose this. | Their age stays as entered until they add the birth year. |
| Prompt in the Body Information card, not a modal | Asks without blocking or nagging, and is visible where the data lives. | It shows on every visit until answered. There is no "dismiss", by design, because it is not a modal. |
| Birth year optional only for profiles without one | Existing users can keep editing other fields. | A stored birth year can be changed but not removed. |
| Responses keep `age`, add `birthYear` (`number \| null`) | An installed app that hasn't reloaded (PWA update prompt) parses `age` and must keep working. | `age` remains in the contract. |
| Requests still accept `age` (never together with `birthYear`), but only while the profile has no birth year | Old clients can still register, onboard and edit. A confirmed birth year is never overwritten: the request is refused with a message on the `age` field, which old clients show next to their Age input. The check is in the update's filter, so it also holds against concurrent requests. | Old clients can't change the age of a profile that has a birth year; the message asks them to reload. Remove `age` input after installed apps have updated (open item, e.g. FIT-17). |
| No database script | The change is additive: old documents are valid as they are. | Two shapes in one collection until every user has added a birth year. |

## 3. Database

`fitnessprofiles` gains an optional `birthYear` (integer, coarse bounds 1900–2100; the exact range is checked
per request). `age` becomes optional. A validation hook requires **exactly one** of the two on created documents.
Updates keep the invariant: `$set: { birthYear }` comes with `$unset: { age }`. An old client's `age` is applied
only by an update whose filter requires the birth year to be absent (`{ userId, birthYear: null }`); otherwise
nothing is written and the API answers `400` on `age`. Existing documents are untouched.

## 4. API contract changes (`/api/users/me/fitness-profile`, and `profile` in `POST /api/auth/register`)

- Input: `birthYear` — JSON integer within `[currentYear − 100, currentYear − 16]`. Errors:
  - `Enter your birth year.` (missing, `null`, or not a number, e.g. `"1990"`)
  - `Enter your birth year as a 4-digit year.` (not an integer)
  - `Birth year must be between {min} and {max}.`
- Legacy input: `age` (FIT-12 rules) instead of `birthYear`. Sending both gives
  `400` with `birthYear: "Send a birth year or an age, not both."`. On `PATCH`, `age` for a profile that already
  has a birth year gives `400 VALIDATION_FAILED` with
  `age: "Your birth year is already saved, so your age updates automatically. Reload Fitness AI to see it."`,
  and nothing in the request is applied.
- Output adds `birthYear: number | null`. `age` is always a number: `currentYear − birthYear`, or the stored age
  when `birthYear` is null.
- Unknown keys are still rejected. Ownership is unchanged: no endpoint accepts a user id.

## 5. Deployment

Two stages from two commits, backend first: [fit-14-deployment-runbook.md](fit-14-deployment-runbook.md) (commands,
platform controls, verification and recovery, including how birth-year-only profiles are preserved).

## 6. Tests

| Suite | Result |
|---|---|
| Backend (Vitest, MongoDB replica set) | 338 passed (FIT-13 baseline 315; +23). Birth-year range and its movement with the year, legacy `age` input, both together refused, the exactly-one schema rule, derived and legacy ages in responses, stale age removed on update, old-client compatibility (register, onboard, edit), **an old client's `age` never overwriting a confirmed birth year (also under concurrent requests, with no partial write)**, ownership, CSRF, and no birth year in logs. |
| Frontend + Worker (Vitest) | 622 passed (baseline 600; +22). Validation mirror, optional birth year for legacy profiles, change detection (blank birth year never sent), response parsing, registration, onboarding (including the signed-in email describing Log out), Body card, prompt, focus and locking. |
| Lint, typecheck, builds | Pass: frontend (`tsc -b` incl. the Playwright tests, Vite, PWA verification) and backend (`tsc`). |
| End to end, FIT-14 frontend (Chromium, real stack: Worker → API → replica set) | FIT-14 (incl. axe on onboarding): 61/61. FIT-12, FIT-13 and auth-resilience scripts adapted to the birth-year field: 42/42, 38/38, 17/17. |
| Stage-1 compatibility: **production FIT-13 frontend bundle** (`index-B9x5z6un.js`, rebuilt from `91295f5`) against the FIT-14 API | Unmodified FIT-12, FIT-13 and auth-resilience scripts: 42/42, 38/38, 17/17. Old-client script (registration, age edits, refusal shown next to Age with no partial write, weight edit keeping the birth year, onboarding): 10/10. |
| Recovery drill (FIT-13 API on birth-year-only data, backfill, roll forward, cleanup) | 9/9 |
| Horizontal overflow, in the repository (`npm run test:e2e`, Playwright) | 23 pages and states × 9 widths (320–1440 px) × light and dark, real `scrollWidth` against the viewport width: 92/92 tests. Without the fixes they fail (Profile 6 px at 320 px; onboarding with a long email 300–394 px at 320–414 px). |
| Accessibility (axe, WCAG 2.2 AA) | No violations: registration error state, profile with a birth year, prompt and open form at 320, 390, 768 and 1440 px, light and dark. |

## 7. Known limitations

- **Fixed:** the Profile page was 6 px wider than a 320 px screen (FIT-13): the Account Settings theme toggle needed
  310 px. Below 640 px the toggle now fills its own row and its three options share the width; from 640 px it
  is unchanged. Other uses of the toggle are unchanged.
- **Fixed:** with a long email address, the onboarding page (accounts created before FIT-12) was wider than
  phone screens: the "Log out (email)" button didn't wrap. The email is now shown above a plain "Log out"
  button as "Signed in as …", which wraps anywhere; the button is described by it (`aria-describedby`), so
  screen readers still hear which account is signed in.
- Not verified on a real iPhone, Android device or Safari (Chromium emulation only).
- The Personal Information card is unchanged from FIT-13. Email changes need a verified flow that hasn't been
  specified.
