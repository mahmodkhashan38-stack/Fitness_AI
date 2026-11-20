import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ROUTES } from '@/constants/routes'
import { toAuthFormError } from '@/services/api/auth'
import type { AuthField, AuthFormError } from '@/types/auth'
import { safeRedirectPath } from '@/utils/safe-redirect'

/** Show the cold-start hint when a submit takes longer than this. */
const SLOW_SUBMIT_MS = 4_000

const NO_ERROR: AuthFormError = { message: null, fields: {} }

/**
 * Shared submit logic for the login and registration forms: client-side validation,
 * server error mapping, slow-server hint, and the redirect after success.
 */
export function useAuthForm<T>({
  validate,
  submit,
}: {
  validate: () => AuthFormError['fields']
  submit: () => Promise<T>
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<AuthFormError>(NO_ERROR)
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)
  const fieldRefs = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>({})
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const focusFirstInvalid = (fields: AuthFormError['fields']) => {
    const first = (['name', 'email', 'password'] as const).find((field) => fields[field])
    if (first) fieldRefs.current[first]?.focus()
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const fields = validate()
    if (Object.keys(fields).length > 0) {
      setError({ message: null, fields })
      focusFirstInvalid(fields)
      return
    }

    setError(NO_ERROR)
    setSubmitting(true)
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_SUBMIT_MS)
    try {
      await submit()
      navigate(safeRedirectPath(searchParams.get('redirect')) ?? ROUTES.dashboard, { replace: true })
    } catch (caught) {
      const mapped = toAuthFormError(caught)
      if (mapped && mounted.current) {
        setError(mapped)
        focusFirstInvalid(mapped.fields)
      }
    } finally {
      window.clearTimeout(slowTimer)
      if (mounted.current) {
        setSubmitting(false)
        setSlow(false)
      }
    }
  }

  /** Ref callback for a field, so validation errors can move focus to it. */
  const fieldRef = (field: AuthField) => (element: HTMLInputElement | null) => {
    fieldRefs.current[field] = element
  }

  /** Clears a field's error as soon as the user edits it. */
  const clearFieldError = (field: AuthField) => {
    setError((current) => (current.fields[field] ? { ...current, fields: { ...current.fields, [field]: undefined } } : current))
  }

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
    fieldRef,
    linkWithRedirect,
    loginPath: ROUTES.login,
    registerPath: ROUTES.register,
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128
export const NAME_MAX_LENGTH = 60
