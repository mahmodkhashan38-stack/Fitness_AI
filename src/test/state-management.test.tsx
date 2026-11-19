/**
 * Demonstrates the state-management strategy in docs/architecture.md with
 * test-only components (nothing here ships in the app):
 *   1. Local UI state stays in the component (useState / useReducer).
 *   2. Shared client state goes through a small, focused context created with
 *      createStrictContext; only consumers re-render when it changes.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { memo, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createStrictContext } from '@/utils/create-strict-context'

// 1. Local state ----------------------------------------------------------

function RepCounter() {
  const [reps, setReps] = useState(0)
  return (
    <button type="button" onClick={() => setReps((value) => value + 1)}>
      Reps: {reps}
    </button>
  )
}

type TimerState = { status: 'idle' | 'running' | 'paused'; elapsed: number }
type TimerAction = { type: 'start' } | { type: 'tick' } | { type: 'pause' } | { type: 'reset' }

/** useReducer for local state with several related transitions. */
function restTimerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'start':
      return { ...state, status: 'running' }
    case 'tick':
      return state.status === 'running' ? { ...state, elapsed: state.elapsed + 1 } : state
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state
    case 'reset':
      return { status: 'idle', elapsed: 0 }
  }
}

// 2. Shared state ---------------------------------------------------------

interface UnitsContextValue {
  units: 'kg' | 'lb'
  setUnits: (units: 'kg' | 'lb') => void
}
const [UnitsContext, useUnits] = createStrictContext<UnitsContextValue>('Units')

function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnits] = useState<'kg' | 'lb'>('kg')
  const value = useMemo(() => ({ units, setUnits }), [units])
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>
}

/** Calls `onCommit` after every render, so tests can count re-renders. */
function useCommitCounter(onCommit?: () => void) {
  useEffect(() => {
    onCommit?.()
  })
}

function UnitDisplay({ onCommit }: { onCommit?: () => void }) {
  useCommitCounter(onCommit)
  const { units } = useUnits()
  return <p>Weight unit: {units}</p>
}

function UnitSwitch() {
  const { units, setUnits } = useUnits()
  return (
    <button type="button" onClick={() => setUnits(units === 'kg' ? 'lb' : 'kg')}>
      Switch units
    </button>
  )
}

const UnrelatedPanel = memo(function UnrelatedPanel({ onCommit }: { onCommit?: () => void }) {
  useCommitCounter(onCommit)
  return <p>Unrelated</p>
})

// ------------------------------------------------------------------------

describe('state management strategy', () => {
  it('local state: each component instance owns its own state', () => {
    render(
      <>
        <RepCounter />
        <RepCounter />
      </>,
    )
    const [first, second] = screen.getAllByRole('button')
    fireEvent.click(first!)
    fireEvent.click(first!)
    expect(first!.textContent).toBe('Reps: 2')
    expect(second!.textContent).toBe('Reps: 0')
  })

  it('local reducer: transitions are explicit and invalid ones are ignored', () => {
    let state: TimerState = { status: 'idle', elapsed: 0 }
    state = restTimerReducer(state, { type: 'tick' })
    expect(state.elapsed).toBe(0) // not running yet
    state = restTimerReducer(state, { type: 'start' })
    state = restTimerReducer(state, { type: 'tick' })
    state = restTimerReducer(state, { type: 'tick' })
    state = restTimerReducer(state, { type: 'pause' })
    state = restTimerReducer(state, { type: 'tick' })
    expect(state).toEqual({ status: 'paused', elapsed: 2 })
    expect(restTimerReducer(state, { type: 'reset' })).toEqual({ status: 'idle', elapsed: 0 })
  })

  it('local reducer works inside a component via useReducer', () => {
    function RestTimer() {
      const [state, dispatch] = useReducer(restTimerReducer, { status: 'idle', elapsed: 0 })
      return (
        <>
          <p>
            {state.status} {state.elapsed}s
          </p>
          <button type="button" onClick={() => dispatch({ type: 'start' })}>
            Start
          </button>
          <button type="button" onClick={() => dispatch({ type: 'tick' })}>
            Tick
          </button>
        </>
      )
    }
    render(<RestTimer />)
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Tick'))
    expect(screen.getByText('running 1s')).toBeTruthy()
  })

  it('shared state: siblings stay in sync through one focused context', () => {
    render(
      <UnitsProvider>
        <UnitDisplay />
        <UnitSwitch />
      </UnitsProvider>,
    )
    expect(screen.getByText('Weight unit: kg')).toBeTruthy()
    fireEvent.click(screen.getByText('Switch units'))
    expect(screen.getByText('Weight unit: lb')).toBeTruthy()
  })

  it('shared state: components that do not consume the context are not re-rendered', () => {
    const onDisplayRender = vi.fn()
    const onUnrelatedRender = vi.fn()
    render(
      <UnitsProvider>
        <UnitDisplay onCommit={onDisplayRender} />
        <UnitSwitch />
        <UnrelatedPanel onCommit={onUnrelatedRender} />
      </UnitsProvider>,
    )
    const displayBefore = onDisplayRender.mock.calls.length
    const unrelatedBefore = onUnrelatedRender.mock.calls.length
    act(() => fireEvent.click(screen.getByText('Switch units')))
    expect(onDisplayRender.mock.calls.length).toBeGreaterThan(displayBefore)
    expect(onUnrelatedRender.mock.calls.length).toBe(unrelatedBefore)
  })

  it('strict context: using it outside its provider fails loudly', () => {
    expect(() => render(<UnitDisplay />)).toThrow('useUnits must be used inside <UnitsProvider>.')
  })
})
