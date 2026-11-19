import { Dumbbell, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Checkbox,
  Divider,
  Input,
  Select,
  Switch,
  Textarea,
} from '@/components/ui'
import { Section } from '@/dev/design-system/Section'

const muscleGroups = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
] as const

export function FormsSection() {
  const [reps, setReps] = useState('0')
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const repsError = Number(reps) < 1 ? 'Enter at least 1 rep.' : undefined

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (repsError) return
    setSaved(false)
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setSaved(true)
    }, 1200)
  }

  return (
    <Section
      id="forms"
      title="Form controls"
      description="Native inputs with visible labels, helper text and inline errors linked via aria-describedby. Errors use an icon and text, not colour alone."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card as="section" aria-labelledby="log-set-title">
          <div className="flex flex-col gap-1">
            <CardTitle id="log-set-title">Log a set</CardTitle>
            <CardDescription>Sample form — nothing is saved.</CardDescription>
          </div>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Input
              label="Exercise"
              name="exercise"
              defaultValue="Barbell bench press"
              leadingIcon={<Dumbbell />}
              autoComplete="off"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Weight"
                name="weight"
                type="number"
                inputMode="decimal"
                defaultValue="80"
                min={0}
                step={0.5}
                suffix="kg"
                helperText="Total load including the bar."
              />
              <Input
                label="Reps"
                name="reps"
                type="number"
                inputMode="numeric"
                min={1}
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                error={repsError}
                required
              />
            </div>
            <Select label="Muscle group" name="muscle" options={muscleGroups} placeholder="Choose a muscle group" />
            <Textarea
              label="Notes"
              name="notes"
              placeholder="How did the set feel?"
              helperText="Optional. Visible only to you."
              rows={3}
            />
            <Checkbox label="Mark as a personal record" name="pr" />
            <Checkbox
              label="Share with my coach"
              name="share"
              defaultChecked
              helperText="Your coach can comment on this set."
            />
            {saved && (
              <Alert variant="success" title="Set logged" live onDismiss={() => setSaved(false)}>
                Barbell bench press · 80 kg × {reps}
              </Alert>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" type="reset" onClick={() => setReps('0')}>
                Reset
              </Button>
              <Button type="submit" loading={submitting} loadingText="Saving…">
                Save set
              </Button>
            </div>
          </form>
        </Card>

        <div className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="preferences-title">
            <CardTitle id="preferences-title">Training preferences</CardTitle>
            <div className="flex flex-col">
              <Switch
                label="Rest timer reminders"
                description="Vibrate when your rest period ends."
                labelPosition="start"
                defaultChecked
              />
              <Divider className="my-2" />
              <Switch label="Auto-fill last weights" description="Start each set from your previous session." labelPosition="start" />
              <Divider className="my-2" />
              <Switch label="Apple Health sync" description="Not available on this device." labelPosition="start" disabled />
            </div>
          </Card>

          <Card as="section" aria-labelledby="states-title">
            <CardTitle id="states-title">Field states</CardTitle>
            <Input label="Search exercises" hideLabel placeholder="Search exercises" leadingIcon={<Search />} type="search" />
            <Input label="Daily calorie target" defaultValue="2,600" suffix="kcal" disabled helperText="Set by your nutrition plan." />
            <Select
              label="Goal"
              options={[{ value: 'cut', label: 'Lose fat' }, { value: 'bulk', label: 'Build muscle' }]}
              defaultValue="bulk"
              error="Your goal conflicts with your calorie target."
            />
            <Checkbox label="Disabled option" disabled />
          </Card>
        </div>
      </div>
    </Section>
  )
}
