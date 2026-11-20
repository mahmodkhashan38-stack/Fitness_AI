import { Check } from 'lucide-react'
import { ProgressBar } from '@/components/ui'
import { cn } from '@/utils/cn'

/** "Step 2 of 4" bar plus the named steps (laid out for four); the current one is marked with aria-current="step". */
function RegistrationProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  const total = steps.length
  return (
    <div className="flex flex-col gap-3">
      <ProgressBar
        label="Registration progress"
        hideLabel
        value={current + 1}
        max={total}
        valueText={`Step ${current + 1} of ${total}: ${steps[current]}`}
        size="sm"
      />
      <ol className="grid grid-cols-4 gap-1">
        {steps.map((title, index) => {
          const done = index < current
          const active = index === current
          return (
            <li
              key={title}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-1.5 text-caption',
                active ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-foreground-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] numeric',
                  done && 'border-primary-edge bg-primary text-primary-foreground',
                  active && 'border-primary-edge text-foreground',
                  !done && !active && 'border-border-strong',
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              {/* Narrow phones: only the current step's name is shown (others stay available to screen readers). */}
              <span className={cn('truncate', !active && 'max-[430px]:sr-only')}>
                {title}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default RegistrationProgress
