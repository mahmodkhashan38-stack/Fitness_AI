import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, LONG_EMAIL, mockApi, type MockAccount } from './support/mock-api'

/**
 * Horizontal-overflow regression tests: no page or state may be wider than the viewport.
 *
 * The measurement is the real document width (`document.documentElement.scrollWidth`) against the
 * viewport width set for the test. `window.innerWidth` is deliberately not used: with mobile
 * emulation it grows to the overflowing width, which hides the problem (how the FIT-13 Profile
 * overflow at 320 px was missed).
 *
 * Each project (see playwright.config.ts) sets the theme and phone or desktop emulation, and lists
 * the widths every scenario is measured at.
 */

interface Scenario {
  name: string
  account: MockAccount | null
  path: string
  /** Waits until the state to measure is on screen (so a broken page can't pass by being empty). */
  ready: (page: Page) => Promise<void>
}

const heading = (page: Page, name: string | RegExp) => expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
const region = (page: Page, name: string) => page.getByRole('region', { name })

async function openCard(page: Page, card: string, button: string) {
  await expect(region(page, 'Body Information')).toBeVisible()
  await region(page, card).getByRole('button', { name: button }).click()
  await expect(region(page, card).getByRole('button', { name: 'Save' })).toBeVisible()
}

async function registerUntil(page: Page, step: 'body' | 'goals' | 'review') {
  await page.getByLabel('Name').fill('Alex Rivera')
  await page.getByLabel('Email').fill(LONG_EMAIL)
  await page.getByLabel('Password').fill('a long and private passphrase')
  await page.getByRole('button', { name: 'Next' }).click()
  if (step === 'body') {
    // Submitting the empty step shows every field error: the widest state of the step.
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Enter your birth year.')).toBeVisible()
    return
  }
  await page.getByText('Female', { exact: true }).click()
  await page.getByLabel('Birth year').fill('1997')
  await page.getByLabel('Height').fill('168')
  await page.getByLabel('Weight').fill('61.5')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Muscle Gain', { exact: true })).toBeVisible()
  if (step === 'goals') return
  await page.getByText('Muscle Gain', { exact: true }).click()
  await page.getByRole('group', { name: 'Training days per week' }).getByText('4', { exact: true }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
}

const { standard, longDetails, legacy, onboarding } = ACCOUNTS

const SCENARIOS: Scenario[] = [
  // Public pages
  { name: 'login', account: null, path: '/login', ready: (page) => heading(page, 'Log in') },
  { name: 'register: account step', account: null, path: '/register', ready: (page) => expect(page.getByLabel('Password')).toBeVisible() },
  { name: 'register: body step with errors', account: null, path: '/register', ready: (page) => registerUntil(page, 'body') },
  { name: 'register: goals step', account: null, path: '/register', ready: (page) => registerUntil(page, 'goals') },
  { name: 'register: review step', account: null, path: '/register', ready: (page) => registerUntil(page, 'review') },

  // App pages
  ...(
    [
      ['dashboard', '/', 'Dashboard'],
      ['workouts', '/workouts', 'Workouts'],
      ['nutrition', '/nutrition', 'Nutrition'],
      ['AI coach', '/ai-coach', /AI Coach/],
      ['progress', '/progress', 'Progress'],
      ['settings', '/settings', 'Settings'],
    ] as const
  ).map(([name, path, title]): Scenario => ({ name, account: standard, path, ready: (page) => heading(page, title) })),
  { name: 'not found', account: standard, path: '/no-such-page', ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible() },
  {
    name: 'account menu open',
    account: longDetails,
    path: '/',
    ready: async (page) => {
      await page.getByRole('button', { name: /Account menu for/ }).click()
      await expect(page.getByText(LONG_EMAIL).first()).toBeVisible()
    },
  },

  // Profile (FIT-13 / FIT-14)
  { name: 'profile', account: standard, path: '/profile', ready: (page) => expect(region(page, 'Account Settings')).toBeVisible() },
  { name: 'profile: long name and email', account: longDetails, path: '/profile', ready: (page) => expect(region(page, 'Account Settings').getByText(LONG_EMAIL)).toBeVisible() },
  { name: 'profile: personal form open', account: longDetails, path: '/profile', ready: (page) => openCard(page, 'Personal Information', 'Edit personal information') },
  { name: 'profile: body form open', account: standard, path: '/profile', ready: (page) => openCard(page, 'Body Information', 'Edit body information') },
  { name: 'profile: goals form open', account: standard, path: '/profile', ready: (page) => openCard(page, 'Fitness Goals', 'Edit fitness goals') },
  { name: 'profile: training form open', account: standard, path: '/profile', ready: (page) => openCard(page, 'Training Preferences', 'Edit training preferences') },
  { name: 'profile: add-birth-year prompt', account: legacy, path: '/profile', ready: (page) => expect(region(page, 'Body Information').getByText('Add your birth year')).toBeVisible() },
  {
    name: 'profile: add-birth-year form open',
    account: legacy,
    path: '/profile',
    ready: async (page) => {
      await region(page, 'Body Information').getByRole('button', { name: 'Add birth year' }).click()
      await expect(page.getByLabel('Birth year')).toBeFocused()
    },
  },

  // Onboarding (accounts created before FIT-12), with a long email next to Log out
  { name: 'onboarding: long email', account: onboarding, path: '/onboarding', ready: (page) => expect(page.getByText(`Signed in as ${LONG_EMAIL}`)).toBeVisible() },
  {
    name: 'onboarding: with errors',
    account: onboarding,
    path: '/onboarding',
    ready: async (page) => {
      await page.getByRole('button', { name: 'Save and continue' }).click()
      await expect(page.getByText('Enter your birth year.')).toBeVisible()
    },
  },
]

/** How far the document extends past the viewport (0 when it fits), and the elements that stick out. */
async function measureOverflow(page: Page, viewportWidth: number) {
  // Let the layout settle after a resize.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return page.evaluate((width) => {
    const outside = [...document.body.querySelectorAll<HTMLElement>('*')].filter((element) => {
      const style = getComputedStyle(element)
      return style.position !== 'fixed' && element.getBoundingClientRect().right > width + 0.5
    })
    // Report the innermost offenders: the elements whose own content sticks out.
    const innermost = outside.filter((element) => !outside.some((other) => other !== element && element.contains(other)))
    return {
      overflow: document.documentElement.scrollWidth - width,
      offenders: innermost.slice(0, 5).map((element) => {
        const label = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)
        return `<${element.tagName.toLowerCase()}> "${label}" right=${Math.round(element.getBoundingClientRect().right)}`
      }),
    }
  }, viewportWidth)
}

for (const scenario of SCENARIOS) {
  test(`no horizontal overflow: ${scenario.name}`, async ({ page }, testInfo) => {
    const widths = testInfo.project.metadata.widths as readonly number[]
    const height = page.viewportSize()?.height ?? 800
    const unexpected = await mockApi(page, scenario.account)

    // Start at the narrowest width, so the state is set up the way a phone user would see it.
    await page.setViewportSize({ width: widths[0]!, height })
    await page.goto(scenario.path)
    await scenario.ready(page)

    for (const width of widths) {
      await page.setViewportSize({ width, height })
      const { overflow, offenders } = await measureOverflow(page, width)
      expect.soft(overflow, `${width} px: document is ${overflow} px wider than the viewport. Widest content: ${offenders.join('; ')}`).toBeLessThanOrEqual(0)
    }
    expect(unexpected, 'API calls the test did not expect').toEqual([])
  })
}
