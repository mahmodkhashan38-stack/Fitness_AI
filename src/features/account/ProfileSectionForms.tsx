import { Save } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import type { FitnessProfileFieldsProps } from '@/components/fitness/FitnessProfileFields'
import { Alert, Button, Input } from '@/components/ui'
import { useProfileForm } from '@/features/account/useProfileForm'
import { useAuth } from '@/hooks/useAuth'
import { toAuthFormError } from '@/services/api/auth'
import { updateFitnessProfile } from '@/services/api/fitness-profile'
import type { FitnessProfile } from '@/types/fitness-profile'
import { NAME_MAX_LENGTH, validateDisplayName } from '@/utils/account'
import { changedProfileFields, toProfileFormValues } from '@/utils/fitness-profile'

/** Moves focus to the first field when an edit form opens. */
function useFocusFirstField() {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    // For a radio group, focus the selected option (where arrow keys continue), not the first one.
    const inputs = [...(ref.current?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    inputs.find((input) => input.type !== 'radio' || input.checked)?.focus()
  }, [])
  return ref
}

function FormActions({ submitting, onCancel }: { submitting: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" loading={submitting} loadingText="Saving…" leftIcon={<Save aria-hidden="true" />}>
        Save
      </Button>
    </div>
  )
}

function EditForm({ onSubmit, busy, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; children: ReactNode }) {
  const ref = useFocusFirstField()
  return (
    <form ref={ref} noValidate aria-busy={busy} onSubmit={onSubmit} className="flex flex-col gap-5">
      {children}
    </form>
  )
}

/** Display name (PATCH /api/users/me through the auth context, so the account menu updates too). */
export function PersonalInfoForm({ onDone }: { onDone: (saved: boolean) => void }) {
  const { user, updateName } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [error, setError] = useState<string | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    const problem = validateDisplayName(name)
    if (problem) {
      setError(problem)
      inputRef.current?.focus()
      return
    }
    const normalised = name.normalize('NFC').trim().replace(/\s+/g, ' ')
    if (normalised === user?.name) {
      onDone(false)
      return
    }
    inFlight.current = true
    setSubmitting(true)
    setMessage(null)
    try {
      await updateName(normalised)
      onDone(true)
    } catch (caught) {
      const mapped = toAuthFormError(caught, ['name'] as const)
      setMessage(mapped?.message ?? null)
      setError(mapped?.fields.name)
      if (mapped?.fields.name) inputRef.current?.focus()
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <EditForm onSubmit={(event) => void submit(event)} busy={submitting}>
      {message && (
        <Alert variant="danger" live>
          {message}
        </Alert>
      )}
      <Input
        ref={inputRef}
        label="Name"
        name="name"
        autoComplete="name"
        required
        maxLength={NAME_MAX_LENGTH}
        disabled={submitting}
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setError(undefined)
        }}
        error={error}
      />
      <p className="text-caption text-foreground-muted">Your email address can’t be changed here.</p>
      <FormActions submitting={submitting} onCancel={() => onDone(false)} />
    </EditForm>
  )
}

/**
 * Edits part of the fitness profile with the FIT-12 fields and rules. The form holds every value
 * (the other fields come from the stored profile and are valid), shows only this card's fields,
 * and sends only what changed.
 */
export function FitnessSectionForm({
  profile,
  fields: Fields,
  onSaved,
  onCancel,
}: {
  profile: FitnessProfile
  fields: ComponentType<FitnessProfileFieldsProps>
  /** Called with the updated profile, or null when nothing changed (no request is sent). */
  onSaved: (profile: FitnessProfile | null) => void
  onCancel: () => void
}) {
  const form = useProfileForm({
    initialValues: toProfileFormValues(profile),
    save: async (input) => {
      const changes = changedProfileFields(profile, input)
      onSaved(Object.keys(changes).length === 0 ? null : await updateFitnessProfile(changes))
    },
  })

  return (
    <EditForm
      busy={form.submitting}
      onSubmit={(event) => {
        event.preventDefault()
        void form.submit()
      }}
    >
      {form.message && (
        <Alert variant="danger" live>
          {form.message}
        </Alert>
      )}
      <Fields values={form.values} errors={form.errors} onChange={form.onChange} fieldRef={form.fieldRef} disabled={form.submitting} />
      <FormActions submitting={form.submitting} onCancel={onCancel} />
    </EditForm>
  )
}
