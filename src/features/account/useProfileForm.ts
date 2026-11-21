import { useEffect, useRef, useState } from 'react'
import { PROFILE_FIELDS } from '@/constants/fitness-profile'
import { toFitnessProfileFormError } from '@/services/api/fitness-profile'
import type { FitnessProfileErrors, FitnessProfileField, FitnessProfileFormValues } from '@/types/fitness-profile'
import { validateProfileForm, type ProfileValidationOptions } from '@/utils/fitness-profile'

/**
 * State and submit logic shared by the onboarding and profile forms: values, client-side
 * validation, server error mapping, focus on the first invalid field, and a double-submit guard.
 */
export function useProfileForm({
  initialValues,
  save,
  validation,
}: {
  initialValues: FitnessProfileFormValues
  /** Receives the values once they pass validation; resolves when saved. Errors are mapped for display. */
  save: (values: FitnessProfileFormValues) => Promise<void>
  validation?: ProfileValidationOptions
}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FitnessProfileErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: FitnessProfileField } | null>(null)
  const refs = useRef<Partial<Record<FitnessProfileField, HTMLInputElement | null>>>({})
  const inFlight = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (focusRequest) refs.current[focusRequest.field]?.focus()
  }, [focusRequest])

  const showFieldErrors = (next: FitnessProfileErrors) => {
    setErrors(next)
    const first = PROFILE_FIELDS.find((field) => next[field])
    if (first) setFocusRequest({ field: first })
  }

  const onChange = <F extends FitnessProfileField>(field: F, value: FitnessProfileFormValues[F]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }

  const submit = async (): Promise<boolean> => {
    if (inFlight.current) return false
    const found = validateProfileForm(values, undefined, validation)
    if (Object.keys(found).length > 0) {
      setMessage(null)
      showFieldErrors(found)
      return false
    }
    inFlight.current = true
    setSubmitting(true)
    setMessage(null)
    setErrors({})
    try {
      await save(values)
      return true
    } catch (caught) {
      const mapped = toFitnessProfileFormError(caught)
      if (mapped && mounted.current) {
        setMessage(mapped.message)
        showFieldErrors(mapped.fields)
      }
      return false
    } finally {
      inFlight.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  const fieldRef = (field: FitnessProfileField) => (element: HTMLInputElement | null) => {
    refs.current[field] = element
  }

  return { values, setValues, errors, message, submitting, onChange, submit, fieldRef }
}
