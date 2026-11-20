/**
 * Accessibility contracts of the FIT-2 form controls (labels, descriptions,
 * error state, disabled state). Sprint 2 forms (login/register) depend on these.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Checkbox from '@/components/ui/Checkbox'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Switch from '@/components/ui/Switch'
import Textarea from '@/components/ui/Textarea'

const describedText = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')

describe('Input', () => {
  it('is named by its visible label and linked to helper text', () => {
    render(<Input label="Body weight" helperText="Weigh in the morning." suffix="kg" />)
    const input = screen.getByRole('textbox', { name: 'Body weight' })
    expect(describedText(input)).toBe('Weigh in the morning.')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByText('kg').getAttribute('aria-hidden')).toBe('true')
  })

  it('error: sets aria-invalid and describes the field with the error (not colour alone)', () => {
    render(<Input label="Reps" helperText="Hidden while there is an error" error="Enter at least 1 rep." />)
    const input = screen.getByRole('textbox', { name: 'Reps' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(describedText(input)).toBe('Enter at least 1 rep.')
    expect(screen.queryByText('Hidden while there is an error')).toBeNull()
  })

  it('required: native required attribute; the visual asterisk is hidden from screen readers', () => {
    render(<Input label="Email" type="email" required />)
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveProperty('required', true)
    expect(screen.getByText('*').getAttribute('aria-hidden')).toBe('true')
  })

  it('hideLabel keeps the accessible name', () => {
    render(<Input label="Search exercises" hideLabel />)
    expect(screen.getByRole('textbox', { name: 'Search exercises' })).toBeTruthy()
    expect(screen.getByText('Search exercises').className).toContain('sr-only')
  })

  it('uses a caller-provided id for the label association', () => {
    render(<Input id="login-email" label="Email" />)
    expect(screen.getByLabelText('Email').id).toBe('login-email')
  })

  it('disabled fields cannot be edited', () => {
    render(<Input label="Calorie target" disabled defaultValue="2600" />)
    expect(screen.getByRole('textbox', { name: 'Calorie target' })).toHaveProperty('disabled', true)
  })
})

describe('Textarea', () => {
  it('is labelled, described and marks errors', () => {
    render(<Textarea label="Notes" error="Keep notes under 500 characters." />)
    const textarea = screen.getByRole('textbox', { name: 'Notes' })
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
    expect(describedText(textarea)).toBe('Keep notes under 500 characters.')
  })
})

describe('Select', () => {
  const options = [
    { value: 'chest', label: 'Chest' },
    { value: 'back', label: 'Back', disabled: true },
  ]

  it('native select with a non-selectable placeholder', () => {
    render(<Select label="Muscle group" options={options} placeholder="Choose a muscle group" />)
    const select = screen.getByRole('combobox', { name: 'Muscle group' }) as HTMLSelectElement
    expect(select.value).toBe('')
    const placeholder = screen.getByRole('option', { name: 'Choose a muscle group' }) as HTMLOptionElement
    expect(placeholder.disabled).toBe(true)
    expect((screen.getByRole('option', { name: 'Back' }) as HTMLOptionElement).disabled).toBe(true)
    fireEvent.change(select, { target: { value: 'chest' } })
    expect(select.value).toBe('chest')
  })

  it('marks errors and links the message', () => {
    render(<Select label="Goal" options={options} error="Choose a goal." />)
    const select = screen.getByRole('combobox', { name: 'Goal' })
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(describedText(select)).toBe('Choose a goal.')
  })
})

describe('Checkbox', () => {
  it('toggles via its label and links helper text', () => {
    render(<Checkbox label="Mark as a personal record" helperText="Shown on your progress page." />)
    const checkbox = screen.getByRole('checkbox', { name: 'Mark as a personal record' })
    expect(describedText(checkbox)).toBe('Shown on your progress page.')
    fireEvent.click(screen.getByText('Mark as a personal record'))
    expect(checkbox).toHaveProperty('checked', true)
  })

  it('disabled checkboxes do not toggle', () => {
    render(<Checkbox label="Unavailable" disabled />)
    const checkbox = screen.getByRole('checkbox', { name: 'Unavailable' })
    expect(checkbox).toHaveProperty('disabled', true)
    // element.click() honours `disabled` like a real user click. (fireEvent.click dispatches a
    // synthetic event that browsers let through on disabled inputs; users cannot trigger it.)
    checkbox.click()
    screen.getByText('Unavailable').click()
    expect(checkbox).toHaveProperty('checked', false)
  })
})

describe('Switch', () => {
  it('exposes switch semantics, its name, description and on/off state', () => {
    render(<Switch label="Rest timer reminders" description="Vibrate when rest ends." />)
    const toggle = screen.getByRole('switch', { name: 'Rest timer reminders' })
    expect(describedText(toggle)).toBe('Vibrate when rest ends.')
    expect(toggle).toHaveProperty('checked', false)
    fireEvent.click(toggle)
    expect(toggle).toHaveProperty('checked', true)
  })

  it('disabled switches do not toggle', () => {
    render(<Switch label="Health sync" disabled />)
    const toggle = screen.getByRole('switch', { name: 'Health sync' })
    expect(toggle).toHaveProperty('disabled', true)
    toggle.click() // see the checkbox test for why click() rather than fireEvent.click
    screen.getByText('Health sync').click()
    expect(toggle).toHaveProperty('checked', false)
  })
})
