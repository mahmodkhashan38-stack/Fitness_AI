import { Dumbbell, Target } from 'lucide-react'
import { Avatar, Badge, Skeleton } from '@/components/ui'
import type { AuthUser } from '@/types/auth'
import type { FitnessProfile } from '@/types/fitness-profile'
import { cn } from '@/utils/cn'
import { describeProfile } from '@/utils/fitness-profile'

/**
 * Full-width banner. `imageSrc` is the licensed high-resolution gym image once it is supplied
 * (docs/sprint-2-advanced-profile-design.md, FIT-13 §1); until then a placeholder made only
 * from theme tokens keeps the final size and position. Decorative either way.
 */
export function ProfileHero({ imageSrc }: { imageSrc?: string }) {
  return (
    <div className="relative h-36 overflow-hidden sm:h-48 lg:h-56" aria-hidden="true" data-testid="profile-hero">
      {imageSrc ? (
        <img src={imageSrc} alt="" className="size-full object-cover object-[45%_55%]" decoding="async" />
      ) : (
        <div
          className={cn(
            'relative size-full',
            'bg-[radial-gradient(circle_at_78%_30%,color-mix(in_oklab,var(--color-primary)_28%,transparent),transparent_55%),linear-gradient(135deg,var(--color-surface-elevated),var(--color-surface-muted)_55%,var(--color-background))]',
          )}
        >
          <Dumbbell className="absolute top-1/2 right-[8%] size-28 -translate-y-1/2 -rotate-12 text-foreground opacity-[0.07] sm:size-36 lg:size-44" strokeWidth={1.25} />
        </div>
      )}
    </div>
  )
}

const STAT_ORDER = [
  { field: 'weightKg', label: 'Weight' },
  { field: 'heightCm', label: 'Height' },
  { field: 'trainingDaysPerWeek', label: 'Training' },
] as const

/** The three real statistics from the stored profile: weight, height, weekly training days. Nothing invented. */
export function ProfileStats({ profile }: { profile: FitnessProfile }) {
  const text = describeProfile(profile)
  const values: Record<(typeof STAT_ORDER)[number]['field'], string> = {
    weightKg: text.weightKg,
    heightCm: text.heightCm,
    trainingDaysPerWeek: `${text.trainingDaysPerWeek} / week`,
  }
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[26rem]" aria-label="Your statistics">
      {STAT_ORDER.map(({ field, label }) => (
        <div key={field} className="flex min-w-0 flex-col-reverse items-center justify-end gap-0.5 rounded-control bg-surface-muted px-1.5 py-3 text-center">
          <dt className="text-caption text-foreground-muted">{label}</dt>
          {/* Wraps on very narrow phones (320 px) instead of overflowing the tile. */}
          <dd className="numeric text-body-sm leading-tight font-semibold text-balance text-foreground min-[380px]:text-body sm:text-body-lg">
            {values[field]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[26rem]">
      {STAT_ORDER.map(({ field }) => (
        <Skeleton key={field} shape="rect" className="h-[4.25rem] rounded-control" />
      ))}
    </div>
  )
}

const GOAL_LABEL = (profile: FitnessProfile) => describeProfile(profile).goal

/**
 * Banner, silhouette avatar overlapping it, the user's name and goal, and the statistics.
 * Experience level is not stored yet (FIT-15), so it is not shown.
 */
export function ProfileHeader({
  user,
  profile,
  loading,
}: {
  user: AuthUser
  /** Null while loading, after an error, or if no profile exists: no statistics or goal are shown then. */
  profile: FitnessProfile | null
  loading: boolean
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <ProfileHero />
      <div className="flex flex-col gap-5 px-4 pb-5 sm:px-6 sm:pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:px-8 lg:pt-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
          <Avatar
            name={`Profile picture of ${user.name}`}
            fallback="silhouette"
            size="xl"
            className="-mt-10 size-20 ring-4 ring-surface sm:-mt-14 sm:size-28 lg:-mt-[4.75rem]"
          />
          <div className="flex min-w-0 flex-col gap-1.5 sm:pb-1">
            <p className="text-h2 break-words text-foreground">{user.name}</p>
            {loading ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              profile && (
                <p className="flex flex-wrap items-center gap-2 text-body-sm text-foreground-muted">
                  <span className="sr-only">Main goal:</span>
                  <Badge variant="primary" icon={<Target aria-hidden="true" />}>
                    {GOAL_LABEL(profile)}
                  </Badge>
                </p>
              )
            )}
          </div>
        </div>
        {loading ? <StatsSkeleton /> : profile && <ProfileStats profile={profile} />}
      </div>
    </div>
  )
}
