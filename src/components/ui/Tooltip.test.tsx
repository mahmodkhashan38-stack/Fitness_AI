import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Tooltip from '@/components/ui/Tooltip'

const isShown = (tooltip: HTMLElement) => tooltip.className.includes('visible') && !tooltip.className.includes('invisible')

describe('Tooltip', () => {
  it('describes its trigger and keeps an existing aria-describedby', () => {
    render(
      <>
        <p id="extra">Extra help</p>
        <Tooltip content="Add exercise">
          <button type="button" aria-label="Add" aria-describedby="extra" />
        </Tooltip>
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'Add' })
    const tooltip = screen.getByRole('tooltip', { hidden: true })
    expect(trigger.getAttribute('aria-describedby')!.split(' ')).toEqual(['extra', tooltip.id])
  })

  it('shows on keyboard focus and hides on blur', () => {
    render(
      <Tooltip content="Share progress">
        <button type="button">Share</button>
      </Tooltip>,
    )
    const tooltip = screen.getByRole('tooltip', { hidden: true })
    expect(isShown(tooltip)).toBe(false)
    act(() => screen.getByRole('button').focus())
    expect(isShown(tooltip)).toBe(true)
    act(() => screen.getByRole('button').blur())
    expect(isShown(tooltip)).toBe(false)
  })

  it('shows on pointer hover and hides on leave', () => {
    const { container } = render(
      <Tooltip content="Delete workout">
        <button type="button">Delete</button>
      </Tooltip>,
    )
    const wrapper = container.firstElementChild!
    fireEvent.pointerEnter(wrapper)
    expect(isShown(screen.getByRole('tooltip', { hidden: true }))).toBe(true)
    fireEvent.pointerLeave(wrapper)
    expect(isShown(screen.getByRole('tooltip', { hidden: true }))).toBe(false)
  })

  it('Escape dismisses it while focus stays on the trigger (WCAG 1.4.13)', () => {
    render(
      <Tooltip content="About calorie estimates">
        <button type="button">Info</button>
      </Tooltip>,
    )
    const button = screen.getByRole('button')
    act(() => button.focus())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(isShown(screen.getByRole('tooltip', { hidden: true }))).toBe(false)
    expect(document.activeElement).toBe(button)
  })
})
