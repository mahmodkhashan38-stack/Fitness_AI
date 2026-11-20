import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import ErrorFallback from '@/components/feedback/ErrorFallback'
import LoadingState from '@/components/feedback/LoadingState'
import { BodyMetricsFields, GoalFields } from '@/components/fitness/FitnessProfileFields'
import { Alert, Button, Card, Divider } from '@/components/ui'
import { useProfileForm } from '@/features/account/useProfileForm'
import { useAsyncTask } from '@/hooks/useAsyncTask'
import { getErrorFeedback } from '@/services/api/error-feedback'
import { getFitnessProfile, updateFitnessProfile } from '@/services/api/fitness-profile'
import type { FitnessProfile } from '@/types/fitness-profile'
import { changedProfileFields, toProfileFormValues } from '@/utils/fitness-profile'

/** The signed-in user's fitness profile on the Profile page: view and edit (PATCH of changed fields only). */
function FitnessProfileSection() {
  const load = useAsyncTask((signal) => getFitnessProfile({ signal }))
  const { run } = load

  useEffect(() => {
    void run()
  }, [run])

  if (load.state.status === 'idle' || load.state.status === 'loading') {
    return <LoadingState label="Loading your fitness profile…" />
  }
  if (load.state.status === 'error') {
    const feedback = getErrorFeedback(load.state.error)
    return (
      <ErrorFallback
        title="Couldn’t load your fitness profile"
        description={feedback?.message}
        onRetry={() => void load.retry()}
        headingLevel="h2"
      />
    )
  }
  // The app only shows this page after onboarding, so a missing profile means it changed meanwhile.
  if (!load.state.data) {
    return <Alert variant="warning">Your fitness profile isn’t set up yet. Reload the page to complete it.</Alert>
  }
  return <ProfileEditor key={load.state.data.updatedAt} stored={load.state.data} />
}

function ProfileEditor({ stored: initial }: { stored: FitnessProfile }) {
  const [stored, setStored] = useState(initial)
  const [saved, setSaved] = useState(false)
  const form = useProfileForm({
    initialValues: toProfileFormValues(initial),
    save: async (input) => {
      const changes = changedProfileFields(stored, input)
      if (Object.keys(changes).length === 0) return
      const updated = await updateFitnessProfile(changes)
      setStored(updated)
      form.setValues(toProfileFormValues(updated))
    },
  })

  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-h3 text-foreground">Fitness profile</h2>
        <p className="text-body-sm text-foreground-muted">
          Used to personalise your training and targets. Self-reported and private to your account.
        </p>
      </div>
      <form
        noValidate
        className="flex flex-col gap-6"
        aria-busy={form.submitting}
        onSubmit={async (event) => {
          event.preventDefault()
          setSaved(false)
          if (await form.submit()) setSaved(true)
        }}
      >
        {form.message && (
          <Alert variant="danger" live>
            {form.message}
          </Alert>
        )}
        <BodyMetricsFields
          values={form.values}
          errors={form.errors}
          onChange={(field, value) => {
            setSaved(false)
            form.onChange(field, value)
          }}
          fieldRef={form.fieldRef}
          disabled={form.submitting}
        />
        <Divider />
        <GoalFields
          values={form.values}
          errors={form.errors}
          onChange={(field, value) => {
            setSaved(false)
            form.onChange(field, value)
          }}
          fieldRef={form.fieldRef}
          disabled={form.submitting}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" loading={form.submitting} loadingText="Saving…" leftIcon={<Save aria-hidden="true" />}>
            Save changes
          </Button>
          <p role="status" className="text-body-sm text-success empty:hidden">
            {saved ? 'Your fitness profile is saved.' : ''}
          </p>
        </div>
      </form>
    </Card>
  )
}

export default FitnessProfileSection
