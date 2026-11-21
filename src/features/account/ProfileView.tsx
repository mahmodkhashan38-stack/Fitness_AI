import { Dumbbell, LogOut, Ruler, Settings2, Target, UserRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import ErrorFallback from '@/components/feedback/ErrorFallback'
import { BodyMetricsFields, GoalField, TrainingDaysField } from '@/components/fitness/FitnessProfileFields'
import { Alert, Button, Card, EmptyState, Skeleton, ThemeToggle } from '@/components/ui'
import { GOAL_OPTIONS, PROFILE_FIELD_LABELS } from '@/constants/fitness-profile'
import { ROUTES } from '@/constants/routes'
import { ProfileHeader } from '@/features/account/ProfileHeader'
import ProfileSectionCard, { SummaryList } from '@/features/account/ProfileSectionCard'
import { FitnessSectionForm, PersonalInfoForm } from '@/features/account/ProfileSectionForms'
import { useAsyncTask } from '@/hooks/useAsyncTask'
import { useAuth } from '@/hooks/useAuth'
import { getErrorFeedback } from '@/services/api/error-feedback'
import { getFitnessProfile } from '@/services/api/fitness-profile'
import type { AuthUser } from '@/types/auth'
import type { FitnessProfile } from '@/types/fitness-profile'
import { describeProfile } from '@/utils/fitness-profile'

type SectionId = 'personal' | 'body' | 'goals' | 'training'

const memberSince = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

/**
 * The Profile page (FIT-13): header with hero, avatar, name, goal and statistics, then five
 * section cards. All values are the signed-in user's stored data; one card is edited at a time.
 */
function ProfileView() {
  const { user } = useAuth()
  const load = useAsyncTask((signal) => getFitnessProfile({ signal }))
  const { run } = load
  // The latest saved profile (after an edit); otherwise the loaded one.
  const [saved, setSaved] = useState<FitnessProfile | null>(null)
  const [editing, setEditing] = useState<SectionId | null>(null)
  const [status, setStatus] = useState<{ section: SectionId; text: string } | null>(null)

  useEffect(() => {
    void run()
  }, [run])

  if (!user) return null

  const loading = load.state.status === 'idle' || load.state.status === 'loading'
  const profile = saved ?? (load.state.status === 'success' ? load.state.data : null)

  const toggle = (section: SectionId) => {
    setStatus(null)
    setEditing((current) => (current === section ? null : section))
  }
  const finish = (section: SectionId, changed: boolean) => {
    setEditing(null)
    setStatus(changed ? { section, text: 'Saved.' } : null)
  }
  const statusFor = (section: SectionId) => (status?.section === section ? status.text : null)
  const cardProps = (section: SectionId) => ({
    editing: editing === section,
    onToggleEdit: () => toggle(section),
    editLocked: editing !== null,
    status: statusFor(section),
  })
  const fitnessCard = (section: Exclude<SectionId, 'personal'>, fields: Parameters<typeof FitnessSectionForm>[0]['fields']) =>
    profile && (
      <FitnessSectionForm
        profile={profile}
        fields={fields}
        onCancel={() => finish(section, false)}
        onSaved={(updated) => {
          if (updated) setSaved(updated)
          finish(section, updated !== null)
        }}
      />
    )

  const personal = (
    <ProfileSectionCard
      title="Personal Information"
      icon={<UserRound />}
      {...cardProps('personal')}
      form={<PersonalInfoForm onDone={(changed) => finish('personal', changed)} />}
    >
      <SummaryList
        rows={[
          { label: 'Name', value: user.name },
          { label: 'Email', value: user.email },
          { label: 'Member since', value: memberSince(user.createdAt) },
        ]}
      />
    </ProfileSectionCard>
  )

  const account = <AccountSettingsCard user={user} />

  let fitnessCards: { body: ReactNode; goals: ReactNode; training: ReactNode } | null = null
  let fitnessStatus: ReactNode = null

  if (loading) {
    fitnessStatus = <FitnessCardsSkeleton />
  } else if (load.state.status === 'error' && !saved) {
    fitnessStatus = (
      <Card padding="none">
        <ErrorFallback
          variant="section"
          title="Couldn’t load your fitness profile"
          description={getErrorFeedback(load.state.error)?.message}
          onRetry={() => void load.retry()}
          headingLevel="h2"
        />
      </Card>
    )
  } else if (!profile) {
    fitnessStatus = <MissingProfile />
  } else {
    const text = describeProfile(profile)
    const goal = GOAL_OPTIONS.find((option) => option.value === profile.goal)
    fitnessCards = {
      body: (
        <ProfileSectionCard title="Body Information" icon={<Ruler />} {...cardProps('body')} form={fitnessCard('body', BodyMetricsFields)}>
          <SummaryList
            rows={(['sex', 'age', 'heightCm', 'weightKg'] as const).map((field) => ({ label: PROFILE_FIELD_LABELS[field], value: text[field] }))}
          />
        </ProfileSectionCard>
      ),
      goals: (
        <ProfileSectionCard title="Fitness Goals" icon={<Target />} {...cardProps('goals')} form={fitnessCard('goals', GoalField)}>
          <SummaryList rows={[{ label: PROFILE_FIELD_LABELS.goal, value: text.goal }]} />
          {goal && <p className="mt-2 text-body-sm text-foreground-muted">{goal.description}</p>}
        </ProfileSectionCard>
      ),
      training: (
        <ProfileSectionCard title="Training Preferences" icon={<Dumbbell />} {...cardProps('training')} form={fitnessCard('training', TrainingDaysField)}>
          <SummaryList rows={[{ label: PROFILE_FIELD_LABELS.trainingDaysPerWeek, value: `${text.trainingDaysPerWeek} per week` }]} />
        </ProfileSectionCard>
      ),
    }
  }

  return (
    <section className="flex flex-col gap-4 md:gap-6" aria-labelledby="page-title">
      <h1 id="page-title" className="sr-only">
        Profile
      </h1>
      <ProfileHeader user={user} profile={profile} loading={loading} />
      {fitnessStatus}
      <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 md:gap-6">
          {personal}
          {fitnessCards?.body}
        </div>
        <div className="flex flex-col gap-4 md:gap-6">
          {fitnessCards?.goals}
          {fitnessCards?.training}
          {account}
        </div>
      </div>
    </section>
  )
}

/** Email, appearance and logging out. No new account operations in FIT-13 (password and sessions: FIT-16). */
function AccountSettingsCard({ user }: { user: AuthUser }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onLogout = async () => {
    setError(null)
    setLoggingOut(true)
    try {
      await logout()
      navigate(ROUTES.login, { replace: true })
    } catch {
      setError('Couldn’t log out. Check your connection and try again.')
      setLoggingOut(false)
    }
  }

  return (
    <ProfileSectionCard title="Account Settings" icon={<Settings2 />}>
      <div className="flex flex-col gap-4">
        <SummaryList rows={[{ label: 'Email', value: user.email }]} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* ThemeToggle's own legend ("Theme") is the accessible name. */}
          <span className="text-body-sm text-foreground-muted" aria-hidden="true">
            Theme
          </span>
          <ThemeToggle />
        </div>
        {error && (
          <Alert variant="danger" live>
            {error}
          </Alert>
        )}
        <Button variant="outline" leftIcon={<LogOut aria-hidden="true" />} loading={loggingOut} loadingText="Logging out…" onClick={() => void onLogout()}>
          Log out
        </Button>
      </div>
    </ProfileSectionCard>
  )
}

function FitnessCardsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        Loading your fitness profile…
      </p>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} shape="rect" className="h-40 w-full" />
        ))}
      </div>
    </div>
  )
}

/** The onboarding gate normally prevents this; re-checking the session sends the user to onboarding. */
function MissingProfile() {
  const { refresh } = useAuth()
  return (
    <Card padding="none">
      <EmptyState
        icon={<Target />}
        title="Your fitness profile isn’t set up"
        description="Add your body details and goals so Fitness AI can personalise your training."
        headingLevel="h2"
        action={<Button onClick={() => void refresh()}>Set up fitness profile</Button>}
      />
    </Card>
  )
}

export default ProfileView
