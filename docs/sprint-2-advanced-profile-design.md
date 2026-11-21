# Sprint 2 — Advanced Profile: design requirements

Status: **FIT-13 and FIT-14 implemented** (see their implementation notes below); FIT-15 to FIT-17 not started. Sprint 2 builds on FIT-11 (authentication) and FIT-12
(mandatory fitness profile). Every ticket must keep FIT-11 and FIT-12 behaviour, data and tests intact.

| Ticket | Title | Status |
|---|---|---|
| FIT-13 | Advanced Profile page (hero, avatar, summary, statistics, section cards) | Implemented (placeholder hero until the licensed image arrives) |
| FIT-14 | Personal and Body Information Management | Implemented (birth year instead of a stored age) |
| FIT-15 | Fitness Goals and Training Preferences | Outline, to be detailed |
| FIT-16 | Body Weight History and Account Security | Outline, to be detailed |
| FIT-17 | QA and Deployment | Outline, to be detailed |

Principles for the whole sprint:

- **Only real data.** Everything shown comes from the signed-in user's stored data. No fake workout statistics,
  achievements, streaks, personal records or placeholder numbers. If a value doesn't exist yet, the UI says so.
- **Existing design system.** Theme tokens, `Card`, `Button`, `Avatar`, form components, light and dark themes,
  existing breakpoints and layered architecture. No new UI or icon libraries.
- **Privacy.** Profile data is visible only to its owner (FIT-11/12 server-side ownership rules). Values are
  self-reported, not medical information.

---

## FIT-13 — Advanced Profile page

### 1. Hero banner

| Requirement | Decision |
|---|---|
| Final image | The approved dark gym-equipment image (3D-rendered gym station on a black backdrop), **full-resolution licensed file** supplied by the product owner. No generated or substitute image. |
| Until it arrives | A **temporary placeholder** built only from theme tokens (e.g. a dark gradient from `--color-surface-elevated` to `--color-background` with a faint accent glow), so the layout, sizes and overlap are final and only the image source changes later. |
| Not allowed | The 640 × 359 px Pngtree preview received earlier must **not** be committed or used in production. |
| Location (final) | `src/assets/images/profile-hero.jpg`, stored byte-for-byte as supplied, imported by the hero component. Vite emits it under `/assets/` with a content hash, so it gets the existing `Cache-Control: … immutable` rule and passes the CSP (`img-src 'self'`). Optional `srcset` variants may be generated from the original without changing its aspect ratio. |
| Display | Full width of the Profile content area; responsive height (guide: ~160 px on phones, 220–260 px on desktop); `object-fit: cover`; `object-position` on the equipment (start around 45% / 55%), tuned at 375, 390, 768 and 1440 px once the final file is available. |
| Overlay | None unless needed. If the avatar ring or nearby text lacks contrast, add a subtle bottom gradient to the page background colour, only as strong as WCAG AA requires. |
| Accessibility | Decorative: `alt=""`. |
| Offline (PWA) | Workbox precaches `html, js, css, woff2, svg, png` only. When the final file arrives, decide from its size whether to add `jpg` to the precache; otherwise the placeholder colours show offline. |
| Licence | Before release, confirm the licence terms; if attribution is required, add it (e.g. a small caption or an About/credits entry). |

### 2. Default avatar

- Circular, overlapping the bottom edge of the banner (about half its height), left-aligned with the content,
  with a ring in the page background colour. Size about 80 px on phones and 96–112 px on desktop.
- Uses the **existing `Avatar` component**, extended with a **silhouette fallback** (a user icon from
  `lucide-react`, e.g. `UserRound`, in theme colours) instead of initials. The fallback is opt-in, so other uses
  (the account menu's initials) don't change.
- No photos, stock portraits, random avatars, and no avatar derived from sex or any other profile field.
- Decorative next to the visible name (`aria-hidden`), or labelled "Profile picture of <name>" when shown alone.
- No upload, no image storage, no new database field in Sprint 2.

### 3. Identity summary

- **Name** from the authenticated user (`/api/auth/me`).
- **Fitness goal** from the fitness profile, shown with its label (e.g. "Fat Loss").
- **Experience level:** not stored today. Shown **only when available** (it is proposed for FIT-15); until then
  the line is omitted. No placeholder text such as "Beginner" is invented.

### 4. Statistics (three real values)

| Statistic | Source | Format |
|---|---|---|
| Current weight | `fitnessProfile.weightKg` | `72.4 kg` |
| Height | `fitnessProfile.heightCm` | `175 cm` |
| Weekly training days | `fitnessProfile.trainingDaysPerWeek` | `4 days / week` (`1 day / week`, `0 days / week`) |

- Exactly these three. No workout counts, streaks, calories, achievements or personal records.
- Formatted with the existing `describeProfile` / `Intl.NumberFormat` helpers (one decimal at most).
- Values come from the same request as the cards (no duplicate fetch) and update immediately after an edit.

### 5. Profile section cards

Rounded cards (`Card`, `rounded-card`) in this order. Each card has a heading, a summary of its stored values and
an **Edit** action. Editing happens inside the card (expand to a form, Save / Cancel) on phones and desktop alike,
so the user never loses their place. Only one card is in edit mode at a time.

| Card | Shows (FIT-13) | Editing in FIT-13 | Extended by |
|---|---|---|---|
| Personal Information | Name, email (read-only), member since | Name, via the existing `PATCH /api/users/me` | FIT-14 |
| Body Information | Sex, birth year, age (derived), height, weight | FIT-12 fields with birth year (FIT-14) and `PATCH /api/users/me/fitness-profile` | FIT-16 (weight history) |
| Fitness Goals | Main goal | Existing FIT-12 field and PATCH | FIT-15 |
| Training Preferences | Training days per week | Existing FIT-12 field and PATCH | FIT-15 (experience level and other preferences) |
| Account Settings | Email, theme, log out | No new account operations; links to the existing Settings page for theme | FIT-16 (password, sessions) |

- **FIT-12 functionality is preserved:** the same validation rules and messages, the same API calls, PATCH of
  changed fields only, the success message, focus on the first invalid field, and double-submit protection. The
  FIT-12 shared field components (`BodyMetricsFields`, `GoalFields`) are reused (split per card where needed),
  not rewritten.
- Interactive states: hover and press feedback, visible focus rings, keyboard operation, `aria-expanded` on the
  Edit toggle, focus moves into the form when editing starts and back to the Edit button on Cancel/Save.

### 6. Layout

- **Mobile first** (inspired by the product owner's UI reference): hero → overlapping avatar → name, goal (and
  experience level when available) → three statistics in one row → section cards stacked full width.
- **Desktop (≥ 1024 px):** hero across the content width; avatar and identity on the left of a row with the
  statistics; cards in a two-column grid (Personal and Body on the left, Goals, Training and Account on the right),
  with a readable maximum width.
- Works inside the existing app shell (sidebar, mobile bottom navigation, safe areas). No horizontal overflow from
  320 to 1920 px. Touch targets at least 44 px.

### 7. States

| State | Behaviour |
|---|---|
| Loading | Skeletons in the shape of the identity line, statistics and cards (existing skeleton/loading styles); hero and avatar placeholders render immediately. |
| Error | Section-level error with a Retry button (existing `ErrorFallback`); network, server and session-expiry messages from the existing error mapping; the rest of the app keeps working. |
| Empty / missing profile | Can't normally happen (the onboarding gate ensures a profile exists). If the API returns no profile, show an explanation and a link to complete it, never empty or zero statistics. |
| Saving | Card-level loading button, inputs disabled, double submits ignored. |
| Save error | Field errors next to fields, form-level message for other errors, entered values kept. |
| Saved | Card returns to view mode with the new values and a polite status message. |

### 8. Compatibility and constraints

- No new API endpoints or database fields for FIT-13; it uses `GET /api/auth/me`,
  `GET`/`PATCH /api/users/me/fitness-profile` and `PATCH /api/users/me`.
- No new dependencies. Light and dark themes. CSP unchanged.
- The low-resolution preview image is not committed anywhere.

### 9. Acceptance criteria (FIT-13)

1. The Profile page shows the hero (placeholder until the licensed image is provided), the overlapping
   silhouette avatar, the user's name and goal, and the three statistics from the user's stored profile.
2. The experience level appears only if a stored value exists (none in FIT-13).
3. The five cards show the stored values; Personal, Body, Goals and Training values can be edited with the
   FIT-12 rules, and the statistics update after saving.
4. No fake or placeholder statistics, achievements or records anywhere.
5. Loading, error, empty, saving and save-error states behave as in section 7.
6. Phone (375/390 px) and desktop (1280/1440 px) layouts match section 6; no overflow; keyboard and
   screen-reader operable; axe WCAG 2.2 AA: 0 violations; no CSP violations.
7. All FIT-11 and FIT-12 tests pass, plus new tests for the hero, avatar fallback, statistics, cards and states;
   production build and PWA verification pass.

### 10. FIT-13 implementation notes

- **Modules:** `features/account/ProfileView.tsx` (page, states, cards), `ProfileHeader.tsx` (hero, avatar,
  identity, statistics), `ProfileSectionCard.tsx` (card + disclosure), `ProfileSectionForms.tsx` (name and
  fitness card forms); `components/ui/Avatar.tsx` (`fallback="silhouette"`); `components/fitness/FitnessProfileFields.tsx`
  (`GoalField` and `TrainingDaysField` split out; `GoalFields` unchanged for registration and onboarding);
  `utils/account.ts` (name rules shared with registration); `services/api/auth.ts` `updateName` and
  `AuthProvider.updateName` (the account menu updates too). The FIT-12 `FitnessProfileSection` was replaced by the
  Body, Fitness Goals and Training Preferences cards.
- **Hero:** `ProfileHero` takes an optional `imageSrc`; it is not set yet, so the theme placeholder shows. When
  the licensed file arrives: add it as `src/assets/images/profile-hero.jpg`, import it, pass it as `imageSrc`, tune
  `object-position`, and decide the precache question (section 1).
- **Deviations from the text above:**
  - Account Settings contains the existing theme control directly, because the Settings page doesn't have one
    yet.
  - Each Edit button is labelled "Edit <section>" / "Close <section>" with `aria-expanded` and `aria-controls`.
  - Cards other than the one being edited are locked, so unsaved changes are never lost by switching cards.
- **Layout reference:** the Profile UI reference image had not been received when FIT-13 was built; the layout
  follows section 6 and should be compared with the reference when it arrives.

---

## FIT-14 — Personal and Body Information Management

Goal: complete management of the Personal Information and Body Information cards.

- Edit name (existing endpoint) and body data (sex, birth year, height, weight) with the FIT-12 rules.
- **Decision (product owner):** replace the stored **age** with a **birth year**, and **ask existing users** for
  it instead of estimating one.
- Email stays read-only unless a verified email-change flow is specified.
- Tests: validation, ownership, partial updates, UI states.

### FIT-14 implementation notes

Details, contract and test results: [fit-14-birth-year-qa-report.md](fit-14-birth-year-qa-report.md).

- **Birth year, not date of birth.** Only the year is collected (less personal data). The accepted range keeps
  the FIT-12 age rule: the user turns 16–100 during the current calendar year (UTC on both client and server).
  The age shown is the age reached this year ("29 this year"), because the birthday itself is unknown.
- **Existing profiles are not migrated by guessing.** A profile saved before FIT-14 keeps its stored `age` until
  the user adds a birth year. The Body Information card shows "Birth year: Not added", the age as entered, and an
  "Add your birth year" notice whose button opens the card's form on that field. For these users the field is
  optional, so other edits never require it. Saving a birth year removes the stored age.
- **API compatibility.** Responses always include `age` (derived, or as entered) and now `birthYear`
  (`number | null`), so an installed app that hasn't reloaded yet keeps working. Requests may still send `age`
  instead of `birthYear` (never both). It is stored as entered only while the profile has no birth year; a
  confirmed birth year is never overwritten by an old client (the request is refused on the `age` field).
- **Deployment:** two stages, backend before frontend, each from its own commit. See
  [fit-14-deployment-runbook.md](fit-14-deployment-runbook.md). No database script is needed; the change is
  additive.
- Name editing (FIT-13, `PATCH /api/users/me`) and the read-only email are unchanged.

## FIT-15 — Fitness Goals and Training Preferences (outline)

Goal: richer goal and training settings that later modules (workout planning, nutrition targets, AI coach)
can use.

- Edit the main goal and weekly training days (existing fields).
- **Experience level** as a new optional profile field (proposed: Beginner / Intermediate / Advanced), shown in
  the FIT-13 identity summary once set.
- Further training preferences to be specified before implementation (for example session length or available
  equipment); each new field needs validation, an API contract, and a migration plan for existing profiles
  (optional, or prompted).

## FIT-16 — Body Weight History and Account Security (outline)

Goal: track real weight changes over time and give users control over account access.

- **Weight history:** a user-owned collection of dated entries (one per user per day, unique
  `{ userId, date }` index), add, edit and delete own entries, and a simple chart or list of real entries only.
  Define how the profile's current weight relates to the latest entry.
- **Account security:** change password (current password required; Argon2id; other sessions revoked), view and
  end other active sessions, and log out everywhere. Rate limits and CSRF rules as in FIT-11.
- Tests: ownership and isolation, validation, session revocation.

## FIT-17 — QA and Deployment (outline)

- Full regression of FIT-11 to FIT-16: unit, integration (replica-set MongoDB), end-to-end through the
  Cloudflare Worker, axe accessibility, CSP, PWA update and offline behaviour.
- **Real-device testing on iPhone Safari** and an Android browser (not done in earlier tickets).
- Final hero image: licence confirmed, attribution if required, focal point and precache decision verified.
- Deployment with backward compatibility: backend first, then frontend (as in the FIT-12 readiness audit), with
  database changes additive and a written rollback order.
- Sprint 2 QA report with results and known limitations.

---

## Open items

| Item | Owner | Status |
|---|---|---|
| Profile UI design reference image | Product owner | Not received yet; FIT-13 follows section 6 and needs a visual comparison once it arrives |
| Full-resolution licensed hero image | Product owner | Pending; placeholder until then |
| Hero image licence and attribution terms | Product owner | To confirm before release |
| Detailed requirements for FIT-15 to FIT-17 | Product owner | Outlines above, to be confirmed |
| Remove the pre-FIT-14 `age` input from the API | Engineering | After installed apps have updated (e.g. with FIT-17); responses keep `age` |
