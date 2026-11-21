import { Check } from 'lucide-react'
import { BodyMetricsFields, GoalFields } from '@/components/fitness/FitnessProfileFields'
import { Alert, Button, Divider } from '@/components/ui'
import { useProfileForm } from '@/features/account/useProfileForm'
import { useAuth } from '@/hooks/useAuth'
import { EMPTY_PROFILE_FORM, toProfileInput } from '@/utils/fitness-profile'

/**
 * Fitness onboarding for accounts created before FIT-12. On success the auth state reports
 * onboarding as complete and the onboarding route sends the user on (see OnboardingOnly).
 */
function OnboardingForm() {
  const { completeOnboarding } = useAuth()
  const form = useProfileForm({ initialValues: EMPTY_PROFILE_FORM, save: (values) => completeOnboarding(toProfileInput(values)) })

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      aria-busy={form.submitting}
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
      <section className="flex flex-col gap-4" aria-labelledby="onboarding-body">
        <h2 id="onboarding-body" className="text-h3 text-foreground">
          About you
        </h2>
        <BodyMetricsFields values={form.values} errors={form.errors} onChange={form.onChange} fieldRef={form.fieldRef} disabled={form.submitting} />
      </section>
      <Divider />
      <section className="flex flex-col gap-4" aria-labelledby="onboarding-goals">
        <h2 id="onboarding-goals" className="text-h3 text-foreground">
          Your goals
        </h2>
        <GoalFields values={form.values} errors={form.errors} onChange={form.onChange} fieldRef={form.fieldRef} disabled={form.submitting} />
      </section>
      <p className="text-caption text-foreground-muted">
        Self-reported, private to your account and used only to personalise Fitness AI. Not medical advice.
      </p>
      <Button type="submit" size="lg" fullWidth loading={form.submitting} loadingText="Saving…" leftIcon={<Check aria-hidden="true" />}>
        Save and continue
      </Button>
    </form>
  )
}

export default OnboardingForm
