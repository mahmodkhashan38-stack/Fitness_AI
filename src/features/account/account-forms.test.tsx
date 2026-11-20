import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FitnessProfileSection from '@/features/account/FitnessProfileSection'
import OnboardingForm from '@/features/account/OnboardingForm'
import type { AuthContextValue } from '@/hooks/useAuth'
import { ApiError } from '@/services/api/errors'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'
import { TEST_PROFILE } from '@/test/fitness-profile'

const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const choose = (group: RegExp, option: string) =>
  act(async () => within(screen.getByRole('group', { name: group })).getByRole('radio', { name: option }).click())
const httpError = (status: number, body: unknown) => new ApiError({ kind: 'http', status, body, message: 'x' })

async function fillProfile() {
  await choose(/^Sex/, 'Male')
  type('Age', '44')
  type('Height', '181')
  type('Weight', '90,5')
  await choose(/^Main goal/, 'General Fitness / Endurance')
  await choose(/^Training days per week/, '0')
}

function renderOnboarding(completeOnboarding: AuthContextValue['completeOnboarding']) {
  const router = createMemoryRouter([{ path: '/onboarding', element: <OnboardingForm /> }], { initialEntries: ['/onboarding'] })
  render(
    <TestAuthProvider value={createAuthValue({ user: { ...TEST_USER, onboardingCompleted: false }, completeOnboarding })}>
      <RouterProvider router={router} />
    </TestAuthProvider>,
  )
  return router
}

const submitOnboarding = () => act(async () => screen.getByRole('button', { name: 'Save and continue' }).click())

describe('OnboardingForm (existing accounts)', () => {
  it('requires every field and focuses the first problem', async () => {
    const complete = vi.fn(async () => {})
    renderOnboarding(complete)
    await submitOnboarding()
    for (const message of [
      'Select your sex.',
      'Enter your age.',
      'Enter your height in centimeters.',
      'Enter your weight in kilograms.',
      'Choose your main goal.',
      'Choose how many days a week you train.',
    ]) {
      expect(screen.getByText(message)).toBeTruthy()
    }
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Male' }))
    expect(complete).not.toHaveBeenCalled()
  })

  it('saves the validated profile (navigation afterwards is covered in app/onboarding-routes.test.tsx)', async () => {
    const complete = vi.fn(async () => {})
    renderOnboarding(complete)
    await fillProfile()
    await submitOnboarding()
    expect(complete).toHaveBeenCalledWith({ sex: 'male', age: 44, heightCm: 181, weightKg: 90.5, goal: 'general_fitness', trainingDaysPerWeek: 0 })
  })

  it('shows server field errors next to the field', async () => {
    const complete = vi.fn(async () =>
      Promise.reject(httpError(400, { error: { code: 'VALIDATION_FAILED', fields: { heightCm: 'Height must be between 100 and 250 cm.' } } })),
    )
    const router = renderOnboarding(complete)
    await fillProfile()
    await submitOnboarding()
    expect(screen.getByText('Height must be between 100 and 250 cm.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Height'))
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('explains network failures and keeps the entered values', async () => {
    renderOnboarding(vi.fn(async () => Promise.reject(new ApiError({ kind: 'network', message: 'x' }))))
    await fillProfile()
    await submitOnboarding()
    expect(screen.getByRole('alert').textContent).toMatch(/Can’t reach Fitness AI/)
    expect(field('Weight').value).toBe('90,5')
  })

  it('blocks double submits while saving', async () => {
    let resolve: () => void = () => {}
    const complete = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    renderOnboarding(complete)
    await fillProfile()
    await submitOnboarding()
    const button = screen.getByRole('button', { name: /Saving/ })
    await act(async () => button.click())
    await act(async () => fireEvent.submit(button.closest('form')!))
    expect(complete).toHaveBeenCalledTimes(1)
    await act(async () => resolve())
  })
})

describe('FitnessProfileSection (profile page)', () => {
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

  const renderSection = async () => {
    render(<FitnessProfileSection />)
    await act(async () => {})
  }

  it('loads the profile into the form', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ profile: TEST_PROFILE }))
    await renderSection()
    expect(field('Age').value).toBe('29')
    expect(field('Weight').value).toBe('61.5')
    expect((screen.getByRole('radio', { name: 'Female' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: 'Muscle Gain' }) as HTMLInputElement).checked).toBe(true)
  })

  it('sends only the changed fields and confirms the save', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ profile: TEST_PROFILE }))
    await renderSection()
    type('Weight', '63')
    await choose(/^Training days per week/, '5')
    fetchMock.mockResolvedValueOnce(Response.json({ profile: { ...TEST_PROFILE, weightKg: 63, trainingDaysPerWeek: 5 } }))
    await act(async () => screen.getByRole('button', { name: 'Save changes' }).click())
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect([url, init.method, JSON.parse(init.body as string)]).toEqual(['/api/users/me/fitness-profile', 'PATCH', { weightKg: 63, trainingDaysPerWeek: 5 }])
    expect(screen.getByText('Your fitness profile is saved.')).toBeTruthy()
  })

  it('does not call the API when nothing changed', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ profile: TEST_PROFILE }))
    await renderSection()
    await act(async () => screen.getByRole('button', { name: 'Save changes' }).click())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('validates before saving', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ profile: TEST_PROFILE }))
    await renderSection()
    type('Age', '')
    await act(async () => screen.getByRole('button', { name: 'Save changes' }).click())
    expect(screen.getByText('Enter your age.')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when loading fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await renderSection()
    expect(screen.getByRole('heading', { name: 'Couldn’t load your fitness profile' })).toBeTruthy()
    fetchMock.mockResolvedValueOnce(Response.json({ profile: TEST_PROFILE }))
    await act(async () => screen.getByRole('button', { name: /Try again/ }).click())
    expect(field('Age').value).toBe('29')
  })
})
