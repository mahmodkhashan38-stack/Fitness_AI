import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from '@/components/feedback/ErrorBoundary'

let shouldThrow = true
const SECRET = 'token=abc123 at /internal/db/users'

function Unstable({ label = 'Widget' }: { label?: string }) {
  if (shouldThrow) throw new Error(`Render failed: ${SECRET}`)
  return <p>{label} works</p>
}

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count {count}
    </button>
  )
}

beforeEach(() => {
  shouldThrow = true
  // React reports caught errors via console.error; keep test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe('ErrorBoundary', () => {
  it('catches a render error and shows the default fallback as an alert', () => {
    render(
      <ErrorBoundary>
        <Unstable />
      </ErrorBoundary>,
    )
    const alert = screen.getByRole('alert', { name: 'Something went wrong' })
    expect(alert).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByText('Widget works')).toBeNull()
  })

  it('"Try again" resets the boundary and renders the children again', () => {
    render(
      <ErrorBoundary>
        <Unstable />
      </ErrorBoundary>,
    )
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Widget works')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the fallback again if the retry fails too', () => {
    render(
      <ErrorBoundary>
        <Unstable />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('resets automatically when a reset key changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['/workouts']}>
        <Unstable />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    shouldThrow = false
    rerender(
      <ErrorBoundary resetKeys={['/nutrition']}>
        <Unstable />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Widget works')).toBeTruthy()
  })

  it('supports a custom fallback element', () => {
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <Unstable />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom fallback')).toBeTruthy()
  })

  it('supports a custom fallback render function with error and reset', () => {
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <button type="button" onClick={reset}>
            Reset ({error instanceof Error ? 'Error' : 'unknown'})
          </button>
        )}
      >
        <Unstable />
      </ErrorBoundary>,
    )
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reset (Error)' }))
    expect(screen.getByText('Widget works')).toBeTruthy()
  })

  it('persistent failure: no automatic retry loop; each click causes one bounded re-attempt', async () => {
    let attempts = 0
    function AlwaysFails(): never {
      attempts += 1
      throw new Error('always fails')
    }
    render(
      <ErrorBoundary>
        <AlwaysFails />
      </ErrorBoundary>,
    )
    const afterMount = attempts
    expect(afterMount).toBeGreaterThan(0)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(attempts).toBe(afterMount) // nothing re-renders on its own

    const perClick: number[] = []
    for (let click = 0; click < 5; click += 1) {
      const before = attempts
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      perClick.push(attempts - before)
      expect(screen.getByRole('alert')).toBeTruthy() // fallback stays usable after every failure
    }
    // React may re-attempt a failed render once internally; the cost per click must stay constant.
    expect(new Set(perClick).size).toBe(1)
    expect(perClick[0]).toBeGreaterThanOrEqual(1)
    expect(perClick[0]).toBeLessThanOrEqual(2)
  })

  it('a reset key that changes on every render with the same values does not cause a reset loop', () => {
    let attempts = 0
    function AlwaysFails(): never {
      attempts += 1
      throw new Error('always fails')
    }
    function Parent({ path }: { path: string }) {
      return (
        <ErrorBoundary resetKeys={[path]}>
          <AlwaysFails />
        </ErrorBoundary>
      )
    }
    const { rerender } = render(<Parent path="/workouts" />)
    const afterMount = attempts
    rerender(<Parent path="/workouts" />) // new array, same values
    rerender(<Parent path="/workouts" />)
    expect(attempts).toBe(afterMount)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('reports the error through onError and onReset', () => {
    const onError = vi.fn()
    const onReset = vi.fn()
    render(
      <ErrorBoundary onError={onError} onReset={onReset}>
        <Unstable />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('isolation: a failing section does not affect a sibling section', () => {
    render(
      <>
        <ErrorBoundary>
          <Unstable label="Charts" />
        </ErrorBoundary>
        <ErrorBoundary>
          <Counter />
        </ErrorBoundary>
      </>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Count 0' }))
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy()
  })

  it('production: never shows the error message or stack', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('PROD', true)
    const { container } = render(
      <ErrorBoundary>
        <Unstable />
      </ErrorBoundary>,
    )
    expect(container.textContent).not.toContain('token=abc123')
    expect(container.textContent).not.toContain('Render failed')
    expect(container.querySelector('details')).toBeNull()
  })

  it('development: shows only the error name and message, in a collapsed details panel', () => {
    const { container } = render(
      <ErrorBoundary>
        <Unstable />
      </ErrorBoundary>,
    )
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details!.open).toBe(false)
    expect(details!.textContent).toContain('Error: Render failed')
    expect(details!.textContent).not.toMatch(/\bat \w+ \(/) // no stack frames
  })

  it('does not catch errors thrown in event handlers (documented limitation)', () => {
    function ThrowsOnClick() {
      return (
        <button
          type="button"
          onClick={() => {
            throw new Error('handler error')
          }}
        >
          Click
        </button>
      )
    }
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ThrowsOnClick />
      </ErrorBoundary>,
    )
    // Handler errors are reported to window, not to the boundary.
    const swallow = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', swallow)
    act(() => {
      try {
        fireEvent.click(screen.getByRole('button', { name: 'Click' }))
      } catch {
        // jsdom may rethrow; either way the boundary must not catch it
      }
    })
    window.removeEventListener('error', swallow)
    expect(onError).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
