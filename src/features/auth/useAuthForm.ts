import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '@/constants/routes'
import { toAuthFormError } from '@/services/api/auth'
import type { AuthField, AuthFormError } from '@/types/auth'
import { safeRedirectPath } from '@/utils/safe-redirect'

/** Show the cold-start hint when a submit takes longer than this. */
const SLOW_SUBMIT_MS = 4_000

const AUTH_FIELD_ORDER: readonly AuthField[] = ['name', 'email', 'password']

/**
 * Shared submit logic for the login and registration forms: client-side validation,
 * server error mapping, slow-server hint, and the redirect after success.
 *
 * `fieldOrder` lists the form's fields in display order (focus goes to the first invalid one).
 * `onErrors` runs before focusing, e.g. so the registration wizard can switch to the step that
 * contains the field; focus is applied after that re-render.
 */
export function useAuthForm<T, F extends string = AuthField>({
  validate,
  submit,
  fieldOrder = AUTH_FIELD_ORDER as unknown as readonly F[],
  onErrors,
}: {
  validate: () => AuthFormError<F>['fields']
  submit: () => Promise<T>
  fieldOrder?: readonly F[]
  onErrors?: (fields: AuthFormError<F>['fields']) => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<AuthFormError<F>>({ message: null, fields: {} })
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: F } | null>(null)
  const fieldRefs = useRef<Partial<Record<F, HTMLInputElement | null>>>({})
  const mounted = useRef(true)
  // A ref, not state: a second submit in the same tick (double tap) must already see it.
  const inFlight = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Runs after the render that shows the field (it may be on another wizard step).
  useEffect(() => {
    if (focusRequest) fieldRefs.current[focusRequest.field]?.focus()
  }, [focusRequest])

  const showErrors = (next: AuthFormError<F>) => {
    setError(next)
    const first = fieldOrder.find((field) => next.fields[field])
    if (first) {
      onErrors?.(next.fields)
      setFocusRequest({ field: first })
    }
  }

  const onSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (inFlight.current) return

    const fields = validate()
    if (Object.keys(fields).length > 0) {
      showErrors({ message: null, fields })
      return
    }

    inFlight.current = true
    setError({ message: null, fields: {} })
    setSubmitting(true)
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_SUBMIT_MS)
    try {
      await submit()
      navigate(safeRedirectPath(searchParams.get('redirect')) ?? ROUTES.dashboard, { replace: true })
    } catch (caught) {
      const mapped = toAuthFormError<F>(caught, fieldOrder)
      if (mapped && mounted.current) showErrors(mapped)
    } finally {
      inFlight.current = false
      window.clearTimeout(slowTimer)
      if (mounted.current) {
        setSubmitting(false)
        setSlow(false)
      }
    }
  }

  /** Ref callback for a field, so validation errors can move focus to it. */
  const fieldRef = (field: F) => (element: HTMLInputElement | null) => {
    fieldRefs.current[field] = element
  }

  /** Clears a field's error as soon as the user edits it. */
  const clearFieldError = (field: F) => {
    setError((current) => (current.fields[field] ? { ...current, fields: { ...current.fields, [field]: undefined } } : current))
  }

  /** Shows errors found outside a submit (e.g. per-step validation in the wizard) and focuses the first. */
  const reportErrors = (fields: AuthFormError<F>['fields']) => showErrors({ message: null, fields })

  /** Keeps ?redirect= when switching between login and registration. */
  const linkWithRedirect = (path: string) => {
    const redirect = safeRedirectPath(searchParams.get('redirect'))
    return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path
  }

  return {
    error,
    submitting,
    slow,
    onSubmit,
    clearFieldError,
    reportErrors,
    fieldRef,
    linkWithRedirect,
    loginPath: ROUTES.login,
    registerPath: ROUTES.register,
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export { NAME_MAX_LENGTH } from '@/utils/account'
