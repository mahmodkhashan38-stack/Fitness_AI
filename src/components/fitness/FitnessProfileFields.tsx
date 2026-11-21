import { Input, RadioCardGroup } from '@/components/ui'
import { GOAL_OPTIONS, PROFILE_LIMITS, SEX_OPTIONS, TRAINING_DAY_OPTIONS } from '@/constants/fitness-profile'
import type { FitnessProfileErrors, FitnessProfileField, FitnessProfileFormValues } from '@/types/fitness-profile'

export interface FitnessProfileFieldsProps {
  values: FitnessProfileFormValues
  errors: FitnessProfileErrors
  /** Called with the edited field; the parent updates its state and clears that field's error. */
  onChange: <F extends FitnessProfileField>(field: F, value: FitnessProfileFormValues[F]) => void
  /** Registers each control so a parent can focus the first invalid one. */
  fieldRef?: (field: FitnessProfileField) => (element: HTMLInputElement | null) => void
  disabled?: boolean
}

/**
 * Body measurements: sex, age, height, weight. Metric units, shown as suffixes.
 * Text inputs with numeric keypads (iOS Safari's type="number" accepts letters and
 * changes values on scroll); the values are validated as numbers.
 */
export function BodyMetricsFields({ values, errors, onChange, fieldRef, disabled }: FitnessProfileFieldsProps) {
  const { age, heightCm, weightKg } = PROFILE_LIMITS
  return (
    <div className="flex flex-col gap-5">
      <RadioCardGroup
        ref={fieldRef?.('sex')}
        legend="Sex"
        name="sex"
        options={SEX_OPTIONS}
        value={values.sex}
        onChange={(value) => onChange('sex', value as FitnessProfileFormValues['sex'])}
        required
        disabled={disabled}
        error={errors.sex}
      />
      <Input
        ref={fieldRef?.('age')}
        label="Age"
        name="age"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        suffix="years"
        required
        disabled={disabled}
        maxLength={3}
        helperText={`${age.min}–${age.max} years.`}
        value={values.age}
        onChange={(event) => onChange('age', event.target.value)}
        error={errors.age}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          ref={fieldRef?.('heightCm')}
          label="Height"
          name="heightCm"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          suffix="cm"
          required
          disabled={disabled}
          maxLength={5}
          helperText={`${heightCm.min}–${heightCm.max} cm.`}
          value={values.heightCm}
          onChange={(event) => onChange('heightCm', event.target.value)}
          error={errors.heightCm}
        />
        <Input
          ref={fieldRef?.('weightKg')}
          label="Weight"
          name="weightKg"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          suffix="kg"
          required
          disabled={disabled}
          maxLength={5}
          helperText={`${weightKg.min}–${weightKg.max} kg.`}
          value={values.weightKg}
          onChange={(event) => onChange('weightKg', event.target.value)}
          error={errors.weightKg}
        />
      </div>
    </div>
  )
}

/** Main goal. */
export function GoalField({ values, errors, onChange, fieldRef, disabled }: FitnessProfileFieldsProps) {
  return (
    <RadioCardGroup
      ref={fieldRef?.('goal')}
      legend="Main goal"
      name="goal"
      options={GOAL_OPTIONS}
      value={values.goal}
      onChange={(value) => onChange('goal', value as FitnessProfileFormValues['goal'])}
      required
      disabled={disabled}
      error={errors.goal}
    />
  )
}

/** Weekly training frequency, 0–7 days. */
export function TrainingDaysField({ values, errors, onChange, fieldRef, disabled }: FitnessProfileFieldsProps) {
  return (
    <RadioCardGroup
      ref={fieldRef?.('trainingDaysPerWeek')}
      legend="Training days per week"
      name="trainingDaysPerWeek"
      options={TRAINING_DAY_OPTIONS}
      value={values.trainingDaysPerWeek}
      onChange={(value) => onChange('trainingDaysPerWeek', value)}
      compact
      required
      disabled={disabled}
      helperText="How many days a week you usually work out. 0 is fine if you’re just starting."
      error={errors.trainingDaysPerWeek}
    />
  )
}

/** Main goal and weekly training frequency (registration and onboarding). */
export function GoalFields(props: FitnessProfileFieldsProps) {
  return (
    <div className="flex flex-col gap-6">
      <GoalField {...props} />
      <TrainingDaysField {...props} />
    </div>
  )
}
