import { CircleCheck, Clock, Dumbbell, Flame, MoreHorizontal, TrendingDown, Trophy } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Divider,
  IconButton,
  ProgressBar,
} from '@/components/ui'
import { Section } from '@/dev/design-system/Section'

export function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards"
      description="Cards group related data. Default cards sit on the surface with a hairline border; elevated and muted variants add hierarchy without heavy shadows."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card as="article">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-foreground-muted uppercase">Daily Calories</span>
              <span className="flex items-baseline gap-1.5">
                <span className="numeric text-metric">1,840</span>
                <span className="numeric text-body-sm text-foreground-muted">/ 2,600 kcal</span>
              </span>
            </div>
            <span className="flex size-10 items-center justify-center rounded-control bg-primary-subtle text-accent">
              <Flame className="size-5" aria-hidden="true" />
            </span>
          </CardHeader>
          <ProgressBar label="Calories consumed" hideLabel value={1840} max={2600} valueText="71%" />
          <p className="text-body-sm text-foreground-muted">760 kcal remaining today</p>
        </Card>

        <Card as="article">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-foreground-muted uppercase">Protein Goal</span>
              <span className="flex items-baseline gap-1.5">
                <span className="numeric text-metric">128</span>
                <span className="numeric text-body-sm text-foreground-muted">/ 160 g</span>
              </span>
            </div>
            <Badge variant="warning">32 g to go</Badge>
          </CardHeader>
          <ProgressBar label="Protein" hideLabel value={128} max={160} tone="warning" valueText="80%" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-sm bg-surface-muted p-3">
              <p className="text-caption text-foreground-muted">Carbs</p>
              <p className="numeric text-label">212 g</p>
            </div>
            <div className="rounded-sm bg-surface-muted p-3">
              <p className="text-caption text-foreground-muted">Fat</p>
              <p className="numeric text-label">61 g</p>
            </div>
          </div>
        </Card>

        <Card as="article">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <span className="text-overline text-foreground-muted uppercase">Body Weight</span>
              <span className="flex items-baseline gap-1.5">
                <span className="numeric text-metric">78.4</span>
                <span className="text-body-sm text-foreground-muted">kg</span>
              </span>
            </div>
            <Badge variant="success" icon={<TrendingDown />}>
              −0.6 kg
            </Badge>
          </CardHeader>
          <p className="text-body-sm text-foreground-muted">Down 0.6 kg this week · 7-day average 78.7 kg</p>
          <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
            {[62, 70, 58, 66, 54, 50, 44].map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-xs bg-chart-1 opacity-80 last:opacity-100"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </Card>

        <Card as="article" className="sm:col-span-2">
          <CardHeader className="flex-wrap">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-elevated text-foreground">
                <Dumbbell className="size-5" aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>Training Session · Push Day</CardTitle>
                <CardDescription>Chest, shoulders and triceps · Today, 07:30</CardDescription>
              </div>
            </div>
            <Badge variant="success" icon={<CircleCheck />}>
              Workout completed
            </Badge>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3">
              {[
                { term: 'Duration', detail: '52 min', icon: <Clock /> },
                { term: 'Volume', detail: '8,420 kg', icon: <Dumbbell /> },
                { term: 'PRs', detail: '2', icon: <Trophy /> },
              ].map((stat) => (
                <div key={stat.term} className="flex flex-col gap-1 rounded-sm bg-surface-muted p-3">
                  <dt className="flex items-center gap-1.5 text-caption text-foreground-muted [&_svg]:size-3.5">
                    <span aria-hidden="true" className="flex">
                      {stat.icon}
                    </span>
                    {stat.term}
                  </dt>
                  <dd className="numeric text-h4 sm:text-metric-sm">{stat.detail}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
          <Divider />
          <CardFooter className="justify-between">
            <span className="flex items-center gap-2">
              <Avatar name="Maya Levi" size="sm" />
              <span className="text-body-sm text-foreground-muted">Program by Maya Levi</span>
            </span>
            <span className="flex gap-2">
              <Button variant="ghost" size="sm">
                Details
              </Button>
              <Button variant="secondary" size="sm">
                Repeat workout
              </Button>
            </span>
          </CardFooter>
        </Card>

        <Card as="article" variant="elevated">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Weekly Progress</CardTitle>
              <CardDescription>3 of 4 planned sessions</CardDescription>
            </div>
            <IconButton label="Weekly progress options" icon={<MoreHorizontal />} size="sm" />
          </CardHeader>
          <ProgressBar label="Sessions this week" value={3} max={4} valueText="3 / 4" />
          <ProgressBar label="Active minutes" value={168} max={200} valueText="168 / 200 min" tone="info" />
        </Card>
      </div>
    </Section>
  )
}
