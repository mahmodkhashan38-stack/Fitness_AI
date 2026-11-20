# Fitness AI — Sprint 1 QA Report (FIT-7)

- **Date:** 2026-11-20
- **Scope:** frontend foundation built in FIT-1 – FIT-6
- **Audited commit:** `6d49bdf` (FIT-6), plus the FIT-7 fixes described below

Throughout this report, **Verified** means a check that was executed and observed. **Assumption / not executed** marks anything that wasn't.

---

## 1. Executive summary

The Sprint 1 foundation is stable and ready for Sprint 2 (Authentication), once the FIT-7 fixes are committed.

| | Result |
|---|---|
| Automated tests | 208 passed, 0 failed (baseline 158; +50). Line coverage 74.7 % → 96.6 % |
| Browser checks (Chromium) | 1,458 checks across 7 widths × 2 themes, 0 failures. 154 axe-core runs, 0 violations. FIT-2 suite 47/47, FIT-3 suite 48/48 |
| Production build | typecheck, lint, test and build all exit 0. Reproducible (two builds byte-identical). Preview routing correct; no console errors; no failed requests |
| Security | `npm audit`: 0 known vulnerabilities. No tracked secrets. No unsafe sinks or console logging in shipped code |
| Defects found | 4 real defects (1 High, 2 Medium, 1 Low), all fixed. 3 apparent failures investigated and shown not to be defects |
| Open items | No Critical or High. Medium/Low technical debt listed in §10 |

**Recommendation:** Sprint 1 can be closed after the FIT-7 changes are reviewed and committed.

## 2. Scope reviewed

- **Project setup:** structure, `package.json`, TypeScript (strict), Vite 8, ESLint 10 (including the import-boundary rules) and Vitest 5 configuration.
- **App structure:** routing (`src/app/router.tsx`), providers (`AppProviders`, `ThemeProvider`), and the layouts (AppShell, PublicLayout, Sidebar, BottomNavigation, AppHeader, AccountMenu).
- **Design system:** tokens and the FIT-2 components (Button, IconButton, Card, Badge, Avatar, Input, Textarea, Select, Checkbox, Switch, Tabs, Tooltip, Alert, ProgressBar, Spinner, Skeleton, EmptyState, Dialog, ThemeToggle).
- **API and async:** API client, configuration and errors (FIT-5); error boundaries, error feedback, loading states and `useAsyncTask` (FIT-6).
- **Documentation:** `README.md` and `docs/architecture.md`.

## 3. Test environment

| Item | Value |
|---|---|
| Node / npm (audit runs) | Node 22.23.5, npm 10.9.9 (Linux) |
| Install | `npm ci` in clean, isolated copies of the audited commit. Your project's `node_modules` was not modified |
| Unit / integration | Vitest 5.1.1 + jsdom 31.0.1 + React Testing Library 16.3.3 |
| Browser | Chromium (Playwright, headless). Phone widths use mobile emulation (touch, DPR 2) |
| Accessibility | axe-core (WCAG 2.0 / 2.1 / 2.2 A and AA rules, plus best-practice) |
| Coverage (audit only) | `@vitest/coverage-v8` 5.1.1, installed with `--no-save`. Not added to the project |
| Widths | 320, 375, 390, 768, 1024, 1440, 1920 px |
| Themes | Light and Dark (OS-emulated), plus System switching |

**Not executed:**
- **Node 24.11.1:** running the suite under your Windows Node version was blocked in this environment (the sandbox refused to download that Node binary). See §7.
- **Other browsers:** no Firefox or WebKit/Safari run, and no physical devices.
- **Screen readers:** no NVDA, VoiceOver or TalkBack testing.

## 4. Automated test results

`npm test`: **21 files, 208 tests, 208 passed, 0 failed.**

| Area | Coverage (lines) | Notes |
|---|---|---|
| All source (excluding tests and dev showcase) | 96.6 % (branches 93.0 %) | Baseline 74.7 % (branches 63.3 %) |
| API client / config / error mapping | 98.8 % / 100 % / 95.7 % | Includes the 17 FIT-5 cases and production-mode config |
| `useAsyncTask` | 100 % | Includes stale results from tasks that ignore `AbortSignal` |
| Storage / persistence / theme | 94 % / 100 % / 96 % | |
| Error boundaries and feedback | 100 % | Includes the repeated-failure escape tests |
| Form controls, Dialog, Tabs, Tooltip | 100 % (each) | **New in FIT-7.** Previously 0–12 %, verified only by external browser scripts |
| AccountMenu | 100 % | **New in FIT-7.** Covers the native popover and the fallback |

**Gaps found and closed in FIT-7** (50 new tests):

| File | Tests | Why |
|---|---|---|
| `components/ui/form-controls.test.tsx` | 13 | Label, description, `aria-invalid`, required and disabled contracts for Input, Textarea, Select, Checkbox and Switch. Sprint 2's login and register forms depend on them |
| `components/ui/Dialog.test.tsx` | 5 | Open, close, Escape, backdrop clicks (including drag protection), `alertdialog`, scroll lock and `data-autofocus` |
| `components/ui/Tabs.test.tsx` | 5 | WAI-ARIA wiring, roving tabindex, arrows, Home and End, disabled skip, controlled mode |
| `components/ui/Tooltip.test.tsx` | 4 | `aria-describedby` merge, focus, hover and Escape (WCAG 1.4.13) |
| `app/navigation.test.tsx` | 16 | Real route tree: direct navigation, active links, document titles, Back and Forward, public routes without app navigation, mobile order, account pages on mobile |
| `components/layout/AccountMenu.test.tsx` | 7 | Popover path and fallback path (see BUG-1) |

**Test quality.** Key behaviours were checked by deliberately introducing defects, then confirming the tests fail ("mutation checks"). All were caught:
- FIT-5: 4 defects.
- FIT-6: 7 defects.
- FIT-7: 3 account-menu defects (removing the fallback fails 7 tests, removing Escape handling fails 2, closing on inside clicks fails 1).

## 5. Browser and responsive test results (Verified, Chromium)

**Main sweep:** 14 configurations (7 widths × 2 themes) × 11 routes, plus page-level checks. **1,458 checks, 0 failures.**

| Check | Result |
|---|---|
| Correct `h1`, header title and document title on every route | Pass |
| No horizontal overflow (all routes, all widths) | Pass |
| No clipped interactive controls | Pass |
| Touch targets ≥ 24 × 24 px (WCAG 2.5.8) | Pass. Two inline text links are covered by the inline exception (see LOW-3) |
| Navigation mode by width | Pass: < 768 bottom bar; 768–1023 icon rail (96 px); 1024–1535 sidebar (256 px); ≥ 1536 sidebar (280 px) |
| Active link accuracy (Dashboard active only on `/`) | Pass |
| Mobile order: Progress \| Workouts \| Dashboard \| Nutrition \| AI Coach | Pass at 320, 375 and 390 px |
| Dashboard centred | Pass (offset < 0.5 px at every phone width) |
| Content not hidden behind the bottom bar | Pass (all phone widths, all routes) |
| Header, sidebar and bottom bar stay pinned while scrolling | Pass (all widths) |
| Dialog fits the screen; bottom sheet on phones; actions ≥ 44 px | Pass (all widths, including 320) |
| Account pages reachable on mobile (header menu → Settings) | Pass (native popover at 320, 375 and 390; fallback at 375) |
| Back, Forward, deep-link reload | Pass |
| Public routes (`/login`, `/register`) show no app navigation | Pass |
| Safe-area CSS (`env(safe-area-inset-*)`, `viewport-fit=cover`) | Present in the shipped CSS. **Not verified on a notched device** |

**Regression suites:**
- **FIT-3 layout suite:** 48/48.
- **FIT-2 design-system suite:** 47/47, after correcting outdated expectations (see §8, "Not defects").

**Production preview** (`vite build` + `vite preview`, 390 px dark and 1440 px light):
- all 11 routes load directly and after a reload;
- `/design-system` shows Not Found;
- the Inter font loads;
- the saved theme is applied;
- no console errors or warnings;
- no HTTP responses ≥ 400.

## 6. Accessibility findings

**Automated:** 154 axe-core runs (11 routes × 7 widths × 2 themes), **0 violations**. FIT-2 and FIT-3 suites also ran axe on the design-system page, the open account menu and the error fallback: 0 violations.

**Keyboard and other manual checks (scripted in Chromium):**
- **Focus:** the skip link comes first and moves focus to `<main>`; sidebar tab order is logical; every focused control shows a solid focus ring.
- **Components:** Tabs follow the WAI-ARIA pattern; the Tooltip shows on focus and closes on Escape.
- **Dialog:** focus moves inside and is trapped, Escape closes it, and focus returns to the trigger.
- **Account menu:** Escape closes it and returns focus to its button.
- **Error and loading states:**
  - route and app error fallbacks receive focus and provide the page's `h1`;
  - `ErrorAlert` uses `role="alert"`;
  - loading uses a single polite `role="status"` with `aria-busy` on the region.
- **Reduced motion:** spinner and skeleton animations drop to 0.01 ms.
- **Colour contrast:** token pairs were verified numerically in FIT-2 (text ≥ 4.5:1, UI ≥ 3:1). axe found no contrast violations in rendered states.

**Fixed in FIT-7:** BUG-3 (skip-link size), BUG-4 (prohibited `aria-label`).

**Limitations (not claimed as compliant):**
- No testing with real screen readers (NVDA, JAWS, VoiceOver, TalkBack). Announcement wording and order are assumed from correct semantics, not observed.
- Only Chromium was tested. Firefox and Safari rendering, focus behaviour and the Popover API fallback were not run in those engines.
- Hover and active colour contrast was not exhaustively measured. axe checks the rendered default and focus states it sees.
- Automated tools cover only part of WCAG 2.2 AA. **This audit does not claim full WCAG compliance.**

## 7. Security and dependency findings

| Check | Result | Evidence |
|---|---|---|
| Known vulnerabilities | **0** (all dependencies and runtime-only) | `npm audit`, `npm audit --omit=dev`. Covers known advisories only; not proof of security |
| Runtime dependencies | 5, unchanged since FIT-2: react, react-dom, react-router, lucide-react, @fontsource-variable/inter | `npm ls --omit=dev` |
| Lockfile | Consistent. `npm ci` accepts it; root matches `package.json`; all entries come from registry.npmjs.org with integrity hashes (6 bundled sub-packages of `@tailwindcss/oxide-wasm32-wasi` are covered by their parent's hash) | Lockfile analysis |
| Tracked secrets | None. The only tracked env file is `.env.example` (empty value). No key or token patterns | `git ls-files` + pattern scan |
| `.gitignore` | Ignores `.env`, `.env.*` (keeps `.env.example`), `*.local`, `dist`, `node_modules`, `coverage`, logs, editor folders | `git check-ignore` |
| External URLs in source | One documentation example (`https://api.example.com/v1`). The API client rejects absolute request paths, credentials in URLs and plain `http` in production | Source scan + FIT-5 tests |
| Unsafe sinks | No `eval`, `new Function`, `dangerouslySetInnerHTML` or `target="_blank"` | Source scan |
| Sensitive logging | No `console.*` in shipped source. User-facing errors never include messages, URLs, status codes or bodies (tested). React logs caught render errors to the developer console | Scan + tests |

**Node.js engines.** Verified from declared `engines` in the lockfile:

| Package | Declared Node range | Scope |
|---|---|---|
| `jsdom` 31, `w3c-xmlserializer` | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | Tests (dev) |
| `react-router` 8 | `>=22.22.0` | App dependency |
| `vitest` 5 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | Tests (dev) |
| `undici` | `>=22.19.0` | Dev |

- **Supported:** Node 22.22.2+ (22.x) or 24.15.0+ (24.x). Node 23 and 25 are unsupported. This is now documented in the README.
- **Your Windows machine:** Node 24.11.1 is below `jsdom`'s declared minimum, which explains the `EBADENGINE` warnings. **Not executed:** whether `npm test` still works on 24.11.1 couldn't be tried here.
- **Recommended:** upgrade to the latest Node 24 LTS (≥ 24.15.0), then run `npm ci && npm test`.

## 8. Bugs discovered

| ID | Severity | Summary | Evidence |
|---|---|---|---|
| **BUG-1** | **High** | Account menu broken in browsers the build targets but which lack the Popover API: Safari/iOS 16.4–16.x, Firefox 114–124, Chrome/Edge 111–113. The unknown `popover` attribute left the panel permanently visible over the page; the button couldn't open or close it; links threw on `hidePopover()`. On phones this menu is the only route to Profile and Settings | Vite 8 default target (`chrome111, edge111, firefox114, safari16.4, ios16.4`) vs Popover API support (Chrome 114, Firefox 125, Safari 17). Reproduced in jsdom (no Popover API: the Settings link failed to navigate) and in Chromium with the Popover API removed |
| **BUG-2** | Medium | At 320 px the account menu's Light/Dark/System options overflowed the menu ("System" clipped) | Browser sweep: options extend past the menu's right edge at 320 px |
| **BUG-3** | Medium (a11y) | The focused skip link was only 18 px tall: `focus:not-sr-only` resets padding to 0, so the visible link fell below the 24 px target size and looked cramped | Browser sweep: focused size 138 × 18 px |
| **BUG-4** | Low (a11y) | The account menu panel (a generic `<div>`) carried `aria-label="Account"`. ARIA 1.2 prohibits naming generic elements, and the name duplicated the sidebar's "Account" navigation | Found by the new navigation test (two elements named "Account") |

**Not defects** (investigated, evidence recorded):

| Item | Finding |
|---|---|
| The 8 outdated FIT-2 browser expectations | Each failing line combined three things. (1)–(2) Expected headings "Login" and "Register": changed deliberately to "Log in" and "Create account" in the approved FIT-3 commit `0170b4e` (confirmed with `git show`), so **genuinely outdated**. (3) "Skip to main content 32 × 16": the skip link didn't exist in FIT-2; the script measured it while visually hidden (clipped), which isn't a visible target, so this was a **measurement artefact**. Investigating it exposed **BUG-3** (its focused state). The `overflow=-15` text was the scrollbar width, never a failure. Expectations updated only after this verification; the suite now passes 47/47 |
| Disabled Checkbox and Switch "toggle on click" (jsdom) | In Chromium, real pointer clicks, label clicks, keyboard Space and `element.click()` all leave disabled controls unchanged. Only a synthetic `dispatchEvent('click')` toggles them, which is standard browser behaviour users can't trigger. The tests now use `element.click()` (documented in `docs/architecture.md`) |
| Account menu → Settings "not navigating" (browser script) | The URL changes a moment before React renders the new page; after the render, the Settings page is shown and the menu is closed. The script now waits for the render |

## 9. Bugs fixed

| ID | Fix | Files | Verification |
|---|---|---|---|
| BUG-1 | Feature-detect the Popover API. Where it's missing, the menu becomes a disclosure (`aria-expanded`/`aria-controls`, `hidden`) that closes on Escape (from anywhere), on an outside click and after navigation, matching native popover behaviour. Browsers with the API keep using it | `components/layout/AccountMenu.tsx`, `styles/base.css` | 7 unit tests (both paths); browser fallback test in Chromium with the Popover API removed (hidden initially, opens visibly within the screen, Escape and outside click close it, Settings navigates, no page errors); mutation checks |
| BUG-2 | In the menu only, theme options show the icon above the label, so all three fit at 320 px | `AccountMenu.tsx` | Browser sweep at 320 px (options inside the menu); screenshot reviewed |
| BUG-3 | Size and padding apply in the focused state (`focus:inline-flex focus:min-h-11 focus:px-4`); the link is now 44 px tall | `components/layout/AppShell.tsx` | Browser: focused skip link ≥ 24 px with a visible focus ring; screenshot reviewed |
| BUG-4 | Removed the prohibited `aria-label`. The panel is identified through the button's `aria-controls` / `popovertarget` | `AccountMenu.tsx` | Unit tests; axe 0 violations with the menu open |

While building BUG-1's fallback, Escape at first only worked with focus inside the panel. The browser sweep caught this, and it was fixed before delivery (Escape is now handled document-wide while the menu is open). It's covered by its own test.

## 10. Remaining technical debt

| ID | Severity | Item | Recommendation | When |
|---|---|---|---|---|
| MED-1 | Medium | The browser checks behind this report (Playwright scripts) live outside the repository, so they can't be rerun by others or in CI | Add `@playwright/test` (dev only) with a small smoke suite: routes, nav modes at 375/768/1440, axe, account menu. Add CI running `npm ci`, lint, typecheck, test and build | Early Sprint 2 (before auth flows grow) |
| MED-2 | Medium | No `engines` field or `.nvmrc`; the supported Node range is only documented | Add `"engines": { "node": "^22.22.2 \|\| >=24.15.0" }` and an `.nvmrc`. This changes the lockfile's root entry, so do it as its own reviewed change | Sprint 2 kickoff |
| MED-3 | Medium | Windows lockfile churn (FIT-5): a mixed-platform `node_modules` rewrote `package-lock.json` | On Windows, delete `node_modules`, run `npm ci`, confirm `git status` is clean | Now (your action) |
| LOW-1 | Low | Button-style link CSS repeated in 3 files (NotFoundPage, RouteContentBoundary, RouteErrorFallback) | Small shared `ButtonLink` when a 4th use appears | Defer |
| LOW-2 | Low | `cn()` doesn't resolve conflicting Tailwind classes; this caused two FIT-3 bugs (fixed then) | Keep wrapping elements for responsive visibility; revisit if conflicts recur | Defer |
| LOW-3 | Low | "Create an account" / "Log in" text links on public pages are ~20 px tall (the WCAG 2.5.8 inline exception applies) | Larger tap targets when the real auth forms are built | Sprint 2 (auth UI) |
| LOW-4 | Low | Storage serializer type assertions (sound, documented in FIT-4) | Generic serializer factories | Defer |
| LOW-5 | Low | Theme storage key duplicated in the `index.html` no-flash script and `constants/theme.ts` (documented) | Keep the comment; add a test if the key ever changes | Defer |
| LOW-6 | Low | Domain models in `types/models/` are not yet used (intentional preliminary contracts) | Adopt or adjust as Sprint 2+ features land | Sprint 2+ |

## 11. Known limitations

- **No backend:** the API client is tested only with mocked `fetch`.
- **Engines and devices:** only Chromium was tested (no Firefox, Safari or real devices). The Popover fallback was exercised by removing the API in Chromium, not in Safari 16.
- **jsdom:** it implements neither `<dialog>.showModal()` nor the Popover API. Unit tests stub them and test component logic; native behaviour was verified in the browser.
- **Screen readers:** no manual testing; no claim of full WCAG conformance.
- **Safe areas:** CSS presence verified; behaviour on notched devices not observed.
- **Node 24.11.1:** test run not executed here (see §7).
- **Console output:** React still logs caught render errors to the developer console. No monitoring service is connected.

## 12. Sprint 2 readiness assessment

**Ready**, with no Critical or High issues open.

- **Routing:** the router, layouts and error boundaries are in place. Public routes (`/login`, `/register`) already use the separate layout auth will need. Authentication guards are intentionally absent.
- **Form controls:** their accessibility contracts are now covered by tests, so the auth forms can build on them safely.
- **API and async:** the client allows explicit `Authorization` headers and has no global token handling; `useAsyncTask` and `getErrorFeedback`/`ErrorAlert` give auth calls consistent loading, error, retry and cancellation behaviour. 401 already maps to "Please sign in again".
- **Before writing auth code, decide:**
  - token vs cookie strategy;
  - where credentials are stored (never in localStorage, per `docs/architecture.md`);
  - route-guard design;
  - MED-1 (CI and an in-repo browser smoke suite).
