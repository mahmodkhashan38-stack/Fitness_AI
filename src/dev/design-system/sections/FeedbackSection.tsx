import { CalendarPlus, ClipboardList, Dumbbell, RotateCcw, Utensils } from 'lucide-react'
import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Dialog,
  EmptyState,
  Input,
  ProgressBar,
  Skeleton,
  Spinner,
  Switch,
} from '@/components/ui'
import { DemoGroup, Section } from '@/dev/design-system/Section'

export function AlertsSection() {
  const [showDismissible, setShowDismissible] = useState(true)

  return (
    <Section
      id="alerts"
      title="Alerts"
      description="Every alert pairs an icon with text. Screen readers hear a status prefix (e.g. “Warning:”). Live announcements are reserved for alerts that appear after an action."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Alert variant="info" title="New program available">
          Your coach published “Hypertrophy Block 2”. Review it before Monday.
        </Alert>
        <Alert variant="success" title="Workout completed">
          Push Day logged — 2 new personal records.
        </Alert>
        <Alert
          variant="warning"
          title="Protein below target"
          action={
            <Button size="sm" variant="outline">
              Log a meal
            </Button>
          }
        >
          You are 32 g short of today’s protein goal.
        </Alert>
        {showDismissible ? (
          <Alert variant="danger" title="Sync failed" onDismiss={() => setShowDismissible(false)}>
            We couldn’t sync your last session. Check your connection and try again.
          </Alert>
        ) : (
          <div className="flex items-center justify-center rounded-card border border-dashed border-border-strong p-4">
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw aria-hidden="true" />} onClick={() => setShowDismissible(true)}>
              Restore dismissed alert
            </Button>
          </div>
        )}
      </div>
    </Section>
  )
}

export function ProgressSection() {
  return (
    <Section
      id="progress"
      title="Progress bars"
      description="Each bar has a label and a text value, so progress is never shown by colour alone."
    >
      <Card className="gap-5">
        <ProgressBar label="Daily Calories" value={1840} max={2600} valueText="1,840 / 2,600 kcal" />
        <ProgressBar label="Protein Goal" value={128} max={160} valueText="128 / 160 g" tone="warning" />
        <ProgressBar label="Weekly workouts" value={4} max={4} valueText="4 / 4 · Complete" tone="success" />
        <ProgressBar label="Water intake" value={1.8} max={3} valueText="1.8 / 3 L" tone="info" />
        <ProgressBar label="Sugar limit" value={62} max={50} valueText="62 / 50 g · Over" tone="danger" />
        <div className="grid gap-4 sm:grid-cols-3">
          <ProgressBar label="Small" size="sm" value={35} />
          <ProgressBar label="Medium" size="md" value={60} />
          <ProgressBar label="Large" size="lg" value={85} />
        </div>
      </Card>
    </Section>
  )
}

export function LoadingSection() {
  const [loading, setLoading] = useState(true)

  return (
    <Section
      id="loading"
      title="Loading & skeletons"
      description="Skeletons mirror the final layout and are hidden from assistive technology; the region is marked busy and announces a loading message instead."
    >
      <Switch label="Simulate loading" checked={loading} onChange={(event) => setLoading(event.target.checked)} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-busy={loading} aria-live="polite">
          {loading ? (
            <>
              <span className="sr-only">Loading today’s summary…</span>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-36" />
                </div>
                <Skeleton shape="rect" className="size-10 rounded-control" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
              <Skeleton className="w-2/3" />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-overline text-foreground-muted uppercase">Today’s summary</span>
                <span className="numeric text-metric">1,840 kcal</span>
              </div>
              <ProgressBar label="Calories" hideLabel value={1840} max={2600} valueText="71%" />
              <p className="text-body-sm text-foreground-muted">760 kcal remaining · 3 meals logged</p>
            </>
          )}
        </Card>

        <Card>
          <CardTitle>Spinners</CardTitle>
          <div className="flex items-center gap-6 text-accent">
            <Spinner size="sm" label="Loading small example" />
            <Spinner size="md" label="Loading medium example" />
            <Spinner size="lg" label="Loading large example" />
          </div>
          <div className="flex items-center gap-3 rounded-sm bg-surface-muted p-3 text-body-sm text-foreground-muted">
            <Spinner size="sm" label={null} />
            Analysing your training week…
          </div>
        </Card>
      </div>
    </Section>
  )
}

export function EmptyStatesSection() {
  return (
    <Section id="empty-states" title="Empty states" description="Explain what’s missing and offer one clear next step.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="none">
          <EmptyState
            icon={<Dumbbell />}
            title="No workouts logged yet"
            description="Log your first training session to start tracking volume, PRs and weekly progress."
            action={<Button leftIcon={<CalendarPlus aria-hidden="true" />}>Plan a workout</Button>}
            secondaryAction={<Button variant="ghost">Browse programs</Button>}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card padding="none">
            <EmptyState
              compact
              icon={<Utensils />}
              title="No meals today"
              description="Add breakfast to begin today’s nutrition log."
              action={
                <Button size="sm" variant="secondary">
                  Add meal
                </Button>
              }
            />
          </Card>
          <Card padding="none" variant="muted">
            <EmptyState compact icon={<ClipboardList />} title="No notes" description="Session notes will appear here." />
          </Card>
        </div>
      </div>
    </Section>
  )
}

export function DialogSection() {
  const [weightOpen, setWeightOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <Section
      id="dialogs"
      title="Modal dialog"
      description="Native <dialog>: focus moves inside and is trapped, Esc or the close button dismisses it, and focus returns to the trigger. On phones it opens as a bottom sheet."
    >
      <DemoGroup title="Try it">
        <Button variant="secondary" onClick={() => setWeightOpen(true)}>
          Log body weight
        </Button>
        <Button variant="destructive" onClick={() => setEndOpen(true)}>
          End training session
        </Button>
      </DemoGroup>

      <div aria-live="polite">
        {message && (
          <Alert variant="success" title={message} onDismiss={() => setMessage(null)}>
            This is sample feedback — nothing was saved.
          </Alert>
        )}
      </div>

      <Dialog
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        title="Log body weight"
        description="Weigh yourself at the same time each day for the most consistent trend."
        footer={
          <>
            <Button variant="ghost" onClick={() => setWeightOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="body-weight-form"
            >
              Save weight
            </Button>
          </>
        }
      >
        <form
          id="body-weight-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setWeightOpen(false)
            setMessage('Body weight logged')
          }}
        >
          <Input label="Body weight" type="number" inputMode="decimal" step={0.1} defaultValue="78.4" suffix="kg" data-autofocus />
          <Input label="Date" type="date" defaultValue="2026-11-19" />
        </form>
      </Dialog>

      <Dialog
        alert
        size="sm"
        open={endOpen}
        onClose={() => setEndOpen(false)}
        closeOnBackdropClick={false}
        title="End training session?"
        description="You have 2 exercises left. Completed sets will be saved."
        footer={
          <>
            <Button variant="outline" onClick={() => setEndOpen(false)} data-autofocus>
              Keep training
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setEndOpen(false)
                setMessage('Training session ended')
              }}
            >
              End session
            </Button>
          </>
        }
      />

      <Card variant="muted" padding="sm">
        <CardDescription>
          Keyboard: <kbd className="font-mono text-foreground">Tab</kbd> cycles inside the dialog,{' '}
          <kbd className="font-mono text-foreground">Esc</kbd> closes it.
        </CardDescription>
      </Card>
    </Section>
  )
}
