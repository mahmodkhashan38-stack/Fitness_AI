import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileHero } from '@/features/account/ProfileHeader'
import ProfileView from '@/features/account/ProfileView'
import type { AuthContextValue } from '@/hooks/useAuth'
import { ThemeContext, type ThemeContextValue } from '@/hooks/useTheme'
import { ApiError } from '@/services/api/errors'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'
import { birthYearFor, LEGACY_PROFILE, TEST_PROFILE } from '@/test/fitness-profile'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', '/api')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const theme: ThemeContextValue = { preference: 'system', resolvedTheme: 'light', setPreference: vi.fn(), toggleTheme: vi.fn() }

const json = (body: unknown, status = 200) => Response.json(body, { status })
const profileResponse = (profile = TEST_PROFILE) => json({ profile })

async function renderProfile(auth: AuthContextValue = createAuthValue(), { settle = true } = {}) {
  const router = createMemoryRouter(
    [
      { path: '/profile', element: <ProfileView /> },
      { path: '/login', element: <h1>Log in</h1> },
    ],
    { initialEntries: ['/profile'] },
  )
  render(
    <ThemeContext.Provider value={theme}>
      <TestAuthProvider value={auth}>
        <RouterProvider router={router} />
      </TestAuthProvider>
    </ThemeContext.Provider>,
  )
  if (settle) await act(async () => {})
  return router
}

const card = (title: string) => screen.getByRole('region', { name: title })
const stats = () => screen.getByLabelText('Your statistics')
const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement
const click = (element: HTMLElement) => act(async () => element.click())
const patchCalls = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')

describe('Profile page: header', () => {
  it('shows the name, a silhouette avatar, the goal and exactly three real statistics', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeTruthy()
    expect(screen.getByText(TEST_USER.name, { selector: 'p' })).toBeTruthy()

    const avatar = screen.getByRole('img', { name: `Profile picture of ${TEST_USER.name}` })
    expect(avatar.querySelector('svg')).toBeTruthy()
    expect(avatar.textContent).toBe('')

    expect(screen.getByText('Main goal:').parentElement!.textContent).toBe('Main goal:Muscle Gain')
    const list = stats()
    expect(within(list).getAllByRole('term').map((term) => term.textContent)).toEqual(['Weight', 'Height', 'Training'])
    expect(within(list).getAllByRole('definition').map((value) => value.textContent)).toEqual(['61.5 kg', '168 cm', '4 days / week'])
  })

  it('invents nothing: no experience level, workouts, streaks, achievements or records', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    const text = document.body.textContent ?? ''
    for (const word of [/beginner/i, /intermediate/i, /advanced/i, /experience/i, /workouts? completed/i, /streak/i, /achievement/i, /personal record/i, /\bPR\b/]) {
      expect(text).not.toMatch(word)
    }
  })

  it('uses the theme placeholder banner until the licensed image exists, and an object-fit cover image once given', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    const hero = screen.getByTestId('profile-hero')
    expect(hero.getAttribute('aria-hidden')).toBe('true')
    expect(hero.querySelector('img')).toBeNull()

    render(<ProfileHero imageSrc="/assets/profile-hero.jpg" />)
    const img = screen.getAllByTestId('profile-hero')[1]!.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.className).toContain('object-cover')
  })

  it('shows skeletons (and no statistics or goal) while loading', async () => {
    fetchMock.mockReturnValueOnce(new Promise(() => {}))
    await renderProfile()
    expect(screen.getByText('Loading your fitness profile…').getAttribute('role')).toBe('status')
    expect(screen.queryByLabelText('Your statistics')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Body Information' })).toBeNull()
    // Account data is already known and stays usable.
    expect(card('Personal Information')).toBeTruthy()
    expect(card('Account Settings')).toBeTruthy()
  })
})

describe('Profile page: states', () => {
  it('offers a retry when loading fails, without showing statistics', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await renderProfile()
    expect(screen.getByRole('heading', { name: 'Couldn’t load your fitness profile' })).toBeTruthy()
    expect(screen.queryByLabelText('Your statistics')).toBeNull()
    expect(card('Personal Information')).toBeTruthy()

    fetchMock.mockResolvedValueOnce(profileResponse())
    await click(screen.getByRole('button', { name: /Try again/ }))
    expect(within(stats()).getAllByRole('definition')).toHaveLength(3)
  })

  it('explains a missing profile and re-checks the session to start onboarding', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'FITNESS_PROFILE_NOT_FOUND' } }, 404))
    const auth = createAuthValue()
    await renderProfile(auth)
    expect(screen.getByRole('heading', { name: 'Your fitness profile isn’t set up' })).toBeTruthy()
    expect(screen.queryByLabelText('Your statistics')).toBeNull()
    await click(screen.getByRole('button', { name: 'Set up fitness profile' }))
    expect(auth.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('Profile page: section cards', () => {
  it('shows the five sections with the stored values', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Personal Information', 'Body Information', 'Fitness Goals', 'Training Preferences', 'Account Settings'])
    expect(within(card('Personal Information')).getByText(TEST_USER.email)).toBeTruthy()
    expect(within(card('Personal Information')).getByText('November 2026')).toBeTruthy()
    const body = within(card('Body Information'))
    expect(body.getAllByRole('term').map((term) => term.textContent)).toEqual(['Sex', 'Birth year', 'Age', 'Height', 'Weight'])
    expect(body.getAllByRole('definition').map((value) => value.textContent)).toEqual(['Female', String(birthYearFor(29)), '29 this year', '168 cm', '61.5 kg'])
    // A complete profile isn't asked for anything.
    expect(body.queryByRole('button', { name: 'Add birth year' })).toBeNull()
    expect(within(card('Fitness Goals')).getByText('Build strength and muscle size.')).toBeTruthy()
    expect(within(card('Training Preferences')).getByText('4 days per week')).toBeTruthy()
  })

  it('edits body information with the FIT-12 rules and sends only the change', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    const edit = within(card('Body Information')).getByRole('button', { name: 'Edit body information' })
    expect(edit.getAttribute('aria-expanded')).toBe('false')
    await click(edit)
    expect(edit.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Female' }))

    fireEvent.change(field('Weight'), { target: { value: '63,4' } })
    fetchMock.mockResolvedValueOnce(profileResponse({ ...TEST_PROFILE, weightKg: 63.4, updatedAt: '2026-11-21T00:00:00.000Z' }))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))

    const [[url, init]] = patchCalls() as [[string, RequestInit]]
    expect([url, JSON.parse(init.body as string)]).toEqual(['/api/users/me/fitness-profile', { weightKg: 63.4 }])
    expect(within(card('Body Information')).getByText('63.4 kg')).toBeTruthy()
    expect(within(stats()).getAllByRole('definition')[0]!.textContent).toBe('63.4 kg')
    expect(within(card('Body Information')).getByRole('status').textContent).toBe('Saved.')
    expect(document.activeElement).toBe(edit)
  })

  it('validates before saving and keeps the form open', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    fireEvent.change(field('Birth year'), { target: { value: String(birthYearFor(12)) } })
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText(`Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`)).toBeTruthy()
    expect(document.activeElement).toBe(field('Birth year'))
    expect(patchCalls()).toHaveLength(0)
  })

  it('requires the birth year once it is stored: it can be changed but not removed', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    expect(field('Birth year').required).toBe(true)
    fireEvent.change(field('Birth year'), { target: { value: '' } })
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter your birth year.')).toBeTruthy()
    expect(patchCalls()).toHaveLength(0)

    fireEvent.change(field('Birth year'), { target: { value: String(birthYearFor(30)) } })
    fetchMock.mockResolvedValueOnce(profileResponse({ ...TEST_PROFILE, birthYear: birthYearFor(30), age: 30 }))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse((patchCalls()[0]![1] as RequestInit).body as string)).toEqual({ birthYear: birthYearFor(30) })
    expect(within(card('Body Information')).getByText('30 this year')).toBeTruthy()
  })

  it('shows server field errors and keeps the entered values', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    fireEvent.change(field('Height'), { target: { value: '170' } })
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'VALIDATION_FAILED', fields: { heightCm: 'Height must be between 100 and 250 cm.' } } }, 400))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Height must be between 100 and 250 cm.')).toBeTruthy()
    expect(field('Height').value).toBe('170')
  })

  it('saving without changes closes the card without a request', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(patchCalls()).toHaveLength(0)
    expect(within(card('Body Information')).getByText('61.5 kg')).toBeTruthy()
    expect(within(card('Body Information')).getByRole('status').textContent).toBe('')
  })

  it('Cancel discards edits; only one card can be edited at a time', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    expect((within(card('Fitness Goals')).getByRole('button', { name: 'Edit fitness goals' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(card('Personal Information')).getByRole('button', { name: 'Edit personal information' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field('Weight'), { target: { value: '99' } })
    await click(within(card('Body Information')).getByRole('button', { name: 'Cancel' }))
    expect(within(card('Body Information')).getByText('61.5 kg')).toBeTruthy()
    expect((within(card('Fitness Goals')).getByRole('button', { name: 'Edit fitness goals' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('edits the goal and updates the header badge', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Fitness Goals')).getByRole('button', { name: 'Edit fitness goals' }))
    await click(screen.getByRole('radio', { name: 'Fat Loss' }))
    fetchMock.mockResolvedValueOnce(profileResponse({ ...TEST_PROFILE, goal: 'fat_loss' }))
    await click(within(card('Fitness Goals')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse((patchCalls()[0]![1] as RequestInit).body as string)).toEqual({ goal: 'fat_loss' })
    expect(within(card('Fitness Goals')).getByText('Fat Loss')).toBeTruthy()
    expect(screen.getByText('Main goal:').parentElement!.textContent).toBe('Main goal:Fat Loss')
  })

  it('edits training days and updates the statistic', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Training Preferences')).getByRole('button', { name: 'Edit training preferences' }))
    await click(screen.getByRole('radio', { name: '6' }))
    fetchMock.mockResolvedValueOnce(profileResponse({ ...TEST_PROFILE, trainingDaysPerWeek: 6 }))
    await click(within(card('Training Preferences')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse((patchCalls()[0]![1] as RequestInit).body as string)).toEqual({ trainingDaysPerWeek: 6 })
    expect(within(stats()).getAllByRole('definition')[2]!.textContent).toBe('6 days / week')
  })

  it('ignores double submits while saving', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    fireEvent.change(field('Weight'), { target: { value: '70' } })
    let resolve: (response: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
    const save = within(card('Body Information')).getByRole('button', { name: 'Save' })
    await click(save)
    await act(async () => fireEvent.submit(save.closest('form')!))
    expect(patchCalls()).toHaveLength(1)
    await act(async () => resolve(profileResponse({ ...TEST_PROFILE, weightKg: 70 })))
  })
})

describe('Profile page: profiles saved before FIT-14 (no birth year yet)', () => {
  it('shows the age as entered and asks for the birth year, without guessing one', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    const body = within(card('Body Information'))
    expect(body.getAllByRole('definition').map((value) => value.textContent)).toEqual(['Female', 'Not added', '41 years', '168 cm', '61.5 kg'])
    expect(body.getByText('Add your birth year')).toBeTruthy()
    expect(body.getByText(/saved as you entered it \(41\) and doesn’t update/)).toBeTruthy()
  })

  it('“Add birth year” opens the body form on the birth year, which may stay blank', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Add birth year' }))
    expect(within(card('Body Information')).getByRole('button', { name: 'Close body information' }).getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(field('Birth year'))
    expect(field('Birth year').value).toBe('')
    expect(field('Birth year').required).toBe(false)
    expect(screen.getByText(/Your saved age is 41\./)).toBeTruthy()
    // The other cards are locked while this one is open.
    expect((within(card('Fitness Goals')).getByRole('button', { name: 'Edit fitness goals' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('adding the birth year sends only it, then shows the derived age and stops asking', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Add birth year' }))
    fireEvent.change(field('Birth year'), { target: { value: String(birthYearFor(42)) } })
    fetchMock.mockResolvedValueOnce(profileResponse({ ...LEGACY_PROFILE, birthYear: birthYearFor(42), age: 42 }))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))

    expect(JSON.parse((patchCalls()[0]![1] as RequestInit).body as string)).toEqual({ birthYear: birthYearFor(42) })
    const body = within(card('Body Information'))
    expect(body.getByText('42 this year')).toBeTruthy()
    expect(body.queryByRole('button', { name: 'Add birth year' })).toBeNull()
    expect(body.getByRole('status').textContent).toBe('Saved.')
    // Focus returns to the card's Edit button (the prompt that opened the form is gone).
    expect(document.activeElement).toBe(body.getByRole('button', { name: 'Edit body information' }))
  })

  it('other edits work without a birth year and keep the stored age', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Edit body information' }))
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Female' }))
    fireEvent.change(field('Weight'), { target: { value: '70' } })
    fetchMock.mockResolvedValueOnce(profileResponse({ ...LEGACY_PROFILE, weightKg: 70 }))
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse((patchCalls()[0]![1] as RequestInit).body as string)).toEqual({ weightKg: 70 })

    await click(within(card('Fitness Goals')).getByRole('button', { name: 'Edit fitness goals' }))
    await click(screen.getByRole('radio', { name: 'Fat Loss' }))
    fetchMock.mockResolvedValueOnce(profileResponse({ ...LEGACY_PROFILE, weightKg: 70, goal: 'fat_loss' }))
    await click(within(card('Fitness Goals')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse((patchCalls()[1]![1] as RequestInit).body as string)).toEqual({ goal: 'fat_loss' })
    expect(within(card('Body Information')).getByText('Add your birth year')).toBeTruthy()
  })

  it('still validates a birth year that is typed', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    await click(within(card('Body Information')).getByRole('button', { name: 'Add birth year' }))
    fireEvent.change(field('Birth year'), { target: { value: '85' } })
    await click(within(card('Body Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText(`Birth year must be between ${birthYearFor(100)} and ${birthYearFor(16)}.`)).toBeTruthy()
    expect(patchCalls()).toHaveLength(0)
  })

  it('the prompt is disabled while another card is being edited', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse(LEGACY_PROFILE))
    await renderProfile()
    await click(within(card('Personal Information')).getByRole('button', { name: 'Edit personal information' }))
    expect((within(card('Body Information')).getByRole('button', { name: 'Add birth year' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Profile page: personal information and account settings', () => {
  it('changes the name through the auth context (normalised), so the whole app updates', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    const auth = createAuthValue()
    await renderProfile(auth)
    await click(within(card('Personal Information')).getByRole('button', { name: 'Edit personal information' }))
    expect(document.activeElement).toBe(field('Name'))
    fireEvent.change(field('Name'), { target: { value: '  Alex   Rivera ' } })
    await click(within(card('Personal Information')).getByRole('button', { name: 'Save' }))
    expect(auth.updateName).toHaveBeenCalledWith('Alex Rivera')
    expect(within(card('Personal Information')).getByRole('status').textContent).toBe('Saved.')
  })

  it('validates the name and maps server errors', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    const auth = createAuthValue({
      updateName: vi.fn(async () =>
        Promise.reject(new ApiError({ kind: 'http', status: 400, message: 'x', body: { error: { code: 'VALIDATION_FAILED', fields: { name: 'Remove unsupported characters.' } } } })),
      ),
    })
    await renderProfile(auth)
    await click(within(card('Personal Information')).getByRole('button', { name: 'Edit personal information' }))
    fireEvent.change(field('Name'), { target: { value: '   ' } })
    await click(within(card('Personal Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(auth.updateName).not.toHaveBeenCalled()

    fireEvent.change(field('Name'), { target: { value: 'Alex B' } })
    await click(within(card('Personal Information')).getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Remove unsupported characters.')).toBeTruthy()
    expect(field('Name').value).toBe('Alex B')
  })

  it('an unchanged name closes without a request', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    const auth = createAuthValue()
    await renderProfile(auth)
    await click(within(card('Personal Information')).getByRole('button', { name: 'Edit personal information' }))
    await click(within(card('Personal Information')).getByRole('button', { name: 'Save' }))
    expect(auth.updateName).not.toHaveBeenCalled()
    expect(within(card('Personal Information')).getByText(TEST_USER.email)).toBeTruthy()
  })

  it('account settings: email, theme control and log out', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    const auth = createAuthValue()
    const router = await renderProfile(auth)
    const account = card('Account Settings')
    expect(within(account).getByText(TEST_USER.email)).toBeTruthy()
    expect(within(account).getByRole('group', { name: 'Theme' })).toBeTruthy()
    expect(within(account).queryByRole('button', { name: /^Edit/ })).toBeNull()
    await click(within(account).getByRole('button', { name: 'Log out' }))
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/login')
  })

  it('reports a failed logout', async () => {
    fetchMock.mockResolvedValueOnce(profileResponse())
    await renderProfile(createAuthValue({ logout: vi.fn(async () => Promise.reject(new Error('offline'))) }))
    await click(within(card('Account Settings')).getByRole('button', { name: 'Log out' }))
    expect(within(card('Account Settings')).getByRole('alert').textContent).toMatch(/Couldn’t log out/)
  })
})
