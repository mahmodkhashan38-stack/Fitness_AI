/**
 * jsdom does not implement <dialog>.showModal(); the methods are stubbed so the
 * component's own logic can be tested. Native behaviour (focus trap, inert
 * background, focus return) is verified in a real browser — see docs/sprint-1-qa-report.md.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'

const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void; close?: () => void }
const original = { showModal: proto.showModal, close: proto.close }

beforeEach(() => {
  proto.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  proto.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
})
afterEach(() => {
  proto.showModal = original.showModal
  proto.close = original.close
  document.documentElement.style.overflow = ''
})

function Harness({ closeOnBackdropClick, alert }: { closeOnBackdropClick?: boolean; alert?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Log body weight</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Log body weight"
        description="Weigh in at the same time each day."
        closeOnBackdropClick={closeOnBackdropClick}
        alert={alert}
        footer={<Button onClick={() => setOpen(false)}>Cancel</Button>}
      >
        <input aria-label="Weight" data-autofocus />
      </Dialog>
    </>
  )
}

const dialog = () => document.querySelector('dialog')!

describe('Dialog', () => {
  it('opens as a modal, labelled and described, and focuses the data-autofocus element', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Log body weight' }))
    expect(proto.showModal).toHaveBeenCalledTimes(1)
    expect(dialog().hasAttribute('open')).toBe(true)
    const labelledBy = document.getElementById(dialog().getAttribute('aria-labelledby')!)
    const describedBy = document.getElementById(dialog().getAttribute('aria-describedby')!)
    expect(labelledBy?.textContent).toBe('Log body weight')
    expect(describedBy?.textContent).toBe('Weigh in at the same time each day.')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Weight' }))
  })

  it('locks page scroll while open and restores it when closed', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Log body weight' }))
    expect(document.documentElement.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(proto.close).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('Escape (native cancel event) closes it through onClose', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Log body weight' }))
    const cancel = new Event('cancel', { cancelable: true })
    act(() => {
      dialog().dispatchEvent(cancel)
    })
    expect(cancel.defaultPrevented).toBe(true) // React state stays the source of truth
    expect(dialog().hasAttribute('open')).toBe(false)
  })

  it('backdrop click closes it, but a drag that starts inside the content does not', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Log body weight' }))
    const content = screen.getByRole('textbox', { name: 'Weight' })
    fireEvent.mouseDown(content)
    fireEvent.click(dialog())
    expect(dialog().hasAttribute('open')).toBe(true)
    fireEvent.mouseDown(dialog())
    fireEvent.click(dialog())
    expect(dialog().hasAttribute('open')).toBe(false)
  })

  it('confirmation dialogs can require an explicit answer (no backdrop close, alertdialog role)', () => {
    render(<Harness closeOnBackdropClick={false} alert />)
    fireEvent.click(screen.getByRole('button', { name: 'Log body weight' }))
    expect(dialog().getAttribute('role')).toBe('alertdialog')
    fireEvent.mouseDown(dialog())
    fireEvent.click(dialog())
    expect(dialog().hasAttribute('open')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))
    expect(dialog().hasAttribute('open')).toBe(false)
  })
})
