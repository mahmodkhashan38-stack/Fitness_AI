import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import OnboardingForm from '@/features/account/OnboardingForm'
import type { AuthContextValue } from '@/hooks/useAuth'
import { ApiError } from '@/services/api/errors'
import { createAuthValue, TEST_USER, TestAuthProvider } from '@/test/auth'

const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const choose = (group: RegExp, option: string) =>
  act(async () => within(screen.getByRole('group', { name: group })).getByRole('radio', { name: option }).click())
const httpError = (status: number, body: unknown) => new ApiError({ kind: 'http', status, body, message: 'x' })

async function fillProfile() {
  await choose(/^Sex/, 'Male')
  type('Birth year', '1982')
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
      'Enter your birth year.',
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
    expect(complete).toHaveBeenCalledWith({ sex: 'male', birthYear: 1982, heightCm: 181, weightKg: 90.5, goal: 'general_fitness', trainingDaysPerWeek: 0 })
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
