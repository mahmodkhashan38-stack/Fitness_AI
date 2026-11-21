import { ArrowLeft, ArrowRight, Pencil, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BodyMetricsFields, GoalFields } from '@/components/fitness/FitnessProfileFields'
import { Button, Input } from '@/components/ui'
import { PROFILE_FIELD_LABELS, PROFILE_FIELDS } from '@/constants/fitness-profile'
import AuthFormStatus from '@/features/auth/AuthFormStatus'
import RegistrationProgress from '@/features/auth/RegistrationProgress'
import { EMAIL_PATTERN, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, useAuthForm } from '@/features/auth/useAuthForm'
import { useAuth } from '@/hooks/useAuth'
import type { AuthField, AuthFormError, RegistrationField } from '@/types/auth'
import type { FitnessProfileErrors, FitnessProfileField, FitnessProfileFormValues } from '@/types/fitness-profile'
import { validateDisplayName } from '@/utils/account'
import { describeProfile, EMPTY_PROFILE_FORM, toProfileInput, validateProfileForm } from '@/utils/fitness-profile'

type Errors = AuthFormError<RegistrationField>['fields']

interface Step {
  title: string
  heading: string
  description: string
  fields: readonly RegistrationField[]
}

const REGISTRATION_STEPS: readonly Step[] = [
  { title: 'Account', heading: 'Your account', description: 'You’ll use these details to log in.', fields: ['name', 'email', 'password'] },
  {
    title: 'Body',
    heading: 'About you',
    description: 'Used to personalise your training and targets. Only you can see it.',
    fields: ['sex', 'birthYear', 'heightCm', 'weightKg'],
  },
  {
    title: 'Goals',
    heading: 'Your goals',
    description: 'What you want to achieve and how often you train.',
    fields: ['goal', 'trainingDaysPerWeek'],
  },
  { title: 'Review', heading: 'Check your details', description: 'Your account is created when you confirm.', fields: [] },
]

const FIELD_ORDER: readonly RegistrationField[] = REGISTRATION_STEPS.flatMap((step) => step.fields)
const LAST_STEP = REGISTRATION_STEPS.length - 1
const stepOf = (field: RegistrationField) => REGISTRATION_STEPS.findIndex((step) => step.fields.includes(field))

/**
 * Multi-step registration (FIT-12): account → body → goals → review. Values live in this
 * component's state, so Back/Next keep everything entered. Each step is validated before moving
 * on, everything again before submitting, and the server once more; the account is created
 * (with its fitness profile, atomically) only by the final submit.
 */
function RegisterForm() {
  const { register } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profile, setProfile] = useState<FitnessProfileFormValues>(EMPTY_PROFILE_FORM)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)

  const validateAccount = (): Partial<Record<AuthField, string>> => {
    const fields: Partial<Record<AuthField, string>> = {}
    const nameError = validateDisplayName(name)
    if (nameError) fields.name = nameError
    if (!email.trim()) fields.email = 'Enter your email address.'
    else if (!EMAIL_PATTERN.test(email.trim())) fields.email = 'Enter a valid email address.'
    // Same rule as the server, which counts characters after NFKC normalisation.
    const passwordLength = password.normalize('NFKC').length
    if (!password) fields.password = 'Create a password.'
    else if (passwordLength < PASSWORD_MIN_LENGTH) fields.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
    else if (passwordLength > PASSWORD_MAX_LENGTH) fields.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`
    else if (password.trim().toLowerCase() === email.trim().toLowerCase()) fields.password = 'Your password can’t be your email address.'
    return fields
  }

  const validateAll = (): Errors => ({ ...validateAccount(), ...validateProfileForm(profile) })

  const form = useAuthForm<unknown, RegistrationField>({
    validate: validateAll,
    submit: () => register({ name: name.trim(), email: email.trim(), password, profile: toProfileInput(profile) }),
    fieldOrder: FIELD_ORDER,
    // Client or server errors: show the step containing the first problem (e.g. "email taken" → step 1).
    onErrors: (fields) => {
      const first = FIELD_ORDER.find((field) => fields[field])
      if (first) setStep(stepOf(first))
    },
  })

  // Move focus to the new step's heading after Back/Next, so screen readers announce it
  // and keyboard users continue from the top of the step.
  useEffect(() => {
    if (focusHeading.current) {
      focusHeading.current = false
      headingRef.current?.focus()
    }
  }, [step])

  const goTo = (next: number) => {
    focusHeading.current = true
    setStep(next)
  }

  const next = () => {
    const all = validateAll()
    const stepErrors: Errors = {}
    for (const field of REGISTRATION_STEPS[step]!.fields) if (all[field]) stepErrors[field] = all[field]
    if (Object.keys(stepErrors).length > 0) form.reportErrors(stepErrors)
    else goTo(step + 1)
  }

  const setProfileField = <F extends FitnessProfileField>(field: F, value: FitnessProfileFormValues[F]) => {
    setProfile((current) => ({ ...current, [field]: value }))
    form.clearFieldError(field)
  }

  const current = REGISTRATION_STEPS[step]!
  const errors = form.error.fields
  const profileErrors: FitnessProfileErrors = {}
  for (const field of PROFILE_FIELDS) if (errors[field]) profileErrors[field] = errors[field]
  const summary = step === LAST_STEP && Object.keys(validateProfileForm(profile)).length === 0 ? describeProfile(toProfileInput(profile)) : null

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        // Enter in a field moves on; only the last step creates the account.
        if (step < LAST_STEP) next()
        else void form.onSubmit()
      }}
      className="flex flex-col gap-6"
      aria-busy={form.submitting}
    >
      <RegistrationProgress steps={REGISTRATION_STEPS.map((s) => s.title)} current={step} />

      <div className="flex flex-col gap-1.5">
        <h2 ref={headingRef} tabIndex={-1} className="text-h3 text-foreground outline-none">
          {current.heading}
        </h2>
        <p className="text-body-sm text-foreground-muted">{current.description}</p>
      </div>

      <AuthFormStatus message={form.error.message} slow={form.slow} />

      {step === 0 && (
        <div className="flex flex-col gap-5">
          <Input
            ref={form.fieldRef('name')}
            label="Name"
            name="name"
            autoComplete="name"
            required
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              form.clearFieldError('name')
            }}
            error={errors.name}
          />
          <Input
            ref={form.fieldRef('email')}
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              form.clearFieldError('email')
            }}
            error={
              errors.email ? (
                <>
                  {errors.email}{' '}
                  {errors.email.includes('already exists') && (
                    <Link to={form.linkWithRedirect(form.loginPath)} className="font-semibold underline underline-offset-4">
                      Go to log in
                    </Link>
                  )}
                </>
              ) : undefined
            }
          />
          <Input
            ref={form.fieldRef('password')}
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            helperText={`At least ${PASSWORD_MIN_LENGTH} characters. A few random words make a strong, memorable password.`}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              form.clearFieldError('password')
            }}
            error={errors.password}
          />
        </div>
      )}

      {step === 1 && (
        <BodyMetricsFields values={profile} errors={profileErrors} onChange={setProfileField} fieldRef={form.fieldRef} />
      )}

      {step === 2 && <GoalFields values={profile} errors={profileErrors} onChange={setProfileField} fieldRef={form.fieldRef} />}

      {step === LAST_STEP && (
        <div className="flex flex-col gap-4">
          <ReviewSection title="Account" onEdit={() => goTo(0)} disabled={form.submitting}>
            <ReviewRow label="Name" value={name.trim()} />
            <ReviewRow label="Email" value={email.trim()} />
          </ReviewSection>
          {summary && (
            <>
              <ReviewSection title="Body" onEdit={() => goTo(1)} disabled={form.submitting}>
                {(['sex', 'birthYear', 'heightCm', 'weightKg'] as const).map((field) => (
                  <ReviewRow key={field} label={PROFILE_FIELD_LABELS[field]} value={summary[field]} />
                ))}
              </ReviewSection>
              <ReviewSection title="Goals" onEdit={() => goTo(2)} disabled={form.submitting}>
                <ReviewRow label={PROFILE_FIELD_LABELS.goal} value={summary.goal} />
                <ReviewRow label={PROFILE_FIELD_LABELS.trainingDaysPerWeek} value={summary.trainingDaysPerWeek} />
              </ReviewSection>
            </>
          )}
          <p className="text-caption text-foreground-muted">
            These details are self-reported, private to your account and used only to personalise Fitness AI. They are not
            medical advice. You can change them later on your profile page.
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {step > 0 && (
          <Button
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            leftIcon={<ArrowLeft aria-hidden="true" />}
            disabled={form.submitting}
            onClick={() => goTo(step - 1)}
          >
            Back
          </Button>
        )}
        {step < LAST_STEP ? (
          <Button type="submit" size="lg" className="sm:flex-1" fullWidth rightIcon={<ArrowRight aria-hidden="true" />}>
            Next
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            className="sm:flex-1"
            fullWidth
            loading={form.submitting}
            loadingText="Creating account…"
            leftIcon={<UserPlus aria-hidden="true" />}
          >
            Create account
          </Button>
        )}
      </div>

      <p className="text-body-sm text-foreground-muted">
        Already have an account?{' '}
        <Link
          to={form.linkWithRedirect(form.loginPath)}
          className="focus-ring rounded-xs font-semibold text-accent underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  )
}

function ReviewSection({
  title,
  onEdit,
  disabled,
  children,
}: {
  title: string
  onEdit: () => void
  disabled: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-card border border-border bg-surface-elevated/40 p-4" aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-label text-foreground">{title}</h3>
        <Button variant="ghost" size="sm" leftIcon={<Pencil aria-hidden="true" />} onClick={onEdit} disabled={disabled} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body-sm">{children}</dl>
    </section>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-foreground">{value}</dd>
    </>
  )
}

export default RegisterForm
