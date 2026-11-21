import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Avatar from '@/components/ui/Avatar'

describe('Avatar', () => {
  it('falls back to initials by default (unchanged behaviour)', () => {
    render(<Avatar name="Maya Levi" />)
    const avatar = screen.getByRole('img', { name: 'Maya Levi' })
    expect(avatar.textContent).toBe('ML')
    expect(avatar.querySelector('svg')).toBeNull()
  })

  it('can fall back to a neutral silhouette instead of initials', () => {
    render(<Avatar name="Profile picture of Maya" fallback="silhouette" />)
    const avatar = screen.getByRole('img', { name: 'Profile picture of Maya' })
    expect(avatar.textContent).toBe('')
    expect(avatar.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the silhouette when a photo fails to load', () => {
    render(<Avatar name="Maya" src="/missing.jpg" fallback="silhouette" />)
    fireEvent.error(screen.getByRole('img', { name: 'Maya' }))
    expect(screen.getByRole('img', { name: 'Maya' }).querySelector('svg')).toBeTruthy()
  })
})
