import { Activity, CalendarDays, CircleCheck, Clock, Flame, Info, Sparkles, TriangleAlert, Zap } from 'lucide-react'
import { Avatar, Badge, Card, IconButton, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from '@/components/ui'
import { DemoGroup, Section } from '@/dev/design-system/Section'

const periods = {
  week: { workouts: '4', volume: '31,200 kg', change: '+6%', calories: '2,480' },
  month: { workouts: '15', volume: '118,900 kg', change: '+11%', calories: '2,515' },
  year: { workouts: '142', volume: '1.21M kg', change: '+24%', calories: '2,460' },
} as const

function PeriodSummary({ period }: { period: keyof typeof periods }) {
  const data = periods[period]
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { term: 'Workouts', detail: data.workouts },
        { term: 'Total volume', detail: data.volume },
        { term: 'vs. previous', detail: data.change },
        { term: 'Avg. kcal / day', detail: data.calories },
      ].map((item) => (
        <div key={item.term} className="flex flex-col gap-1 rounded-card bg-surface-muted p-4">
          <dt className="text-caption text-foreground-muted">{item.term}</dt>
          <dd className="numeric text-metric-sm">{item.detail}</dd>
        </div>
      ))}
    </dl>
  )
}

export function OrganizationSection() {
  return (
    <Section
      id="navigation"
      title="Tabs, badges, avatars & tooltips"
      description="Tabs follow the WAI-ARIA pattern: Tab moves into the list, arrow keys switch tabs, Home and End jump to the ends."
    >
      <Card>
        <Tabs defaultValue="week">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-h4">Weekly Progress</h3>
            <TabsList aria-label="Progress period">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="week">
            <PeriodSummary period="week" />
          </TabsContent>
          <TabsContent value="month">
            <PeriodSummary period="month" />
          </TabsContent>
          <TabsContent value="year">
            <PeriodSummary period="year" />
          </TabsContent>
        </Tabs>
      </Card>

      <Card>
        <Tabs defaultValue="strength" variant="underline">
          <TabsList aria-label="Training type">
            <TabsTrigger value="strength" icon={<Zap aria-hidden="true" />}>
              Strength
            </TabsTrigger>
            <TabsTrigger value="cardio" icon={<Activity aria-hidden="true" />}>
              Cardio
            </TabsTrigger>
            <TabsTrigger value="mobility" disabled>
              Mobility
            </TabsTrigger>
          </TabsList>
          <TabsContent value="strength">
            <p className="text-body-sm text-foreground-muted">
              4 strength sessions this week · heaviest lift: 140 kg deadlift.
            </p>
          </TabsContent>
          <TabsContent value="cardio">
            <p className="text-body-sm text-foreground-muted">2 cardio sessions · 9.4 km total · avg. pace 5:42 / km.</p>
          </TabsContent>
        </Tabs>
      </Card>

      <DemoGroup title="Badges">
        <Badge>Rest day</Badge>
        <Badge variant="primary" icon={<Sparkles />}>
          AI pick
        </Badge>
        <Badge variant="success" icon={<CircleCheck />}>
          Completed
        </Badge>
        <Badge variant="warning" icon={<TriangleAlert />}>
          Deload week
        </Badge>
        <Badge variant="danger" icon={<Flame />}>
          Over target
        </Badge>
        <Badge variant="info" icon={<Clock />}>
          Scheduled
        </Badge>
        <Badge variant="outline" icon={<CalendarDays />}>
          Week 3 of 8
        </Badge>
        <Badge size="sm" variant="primary">
          New
        </Badge>
      </DemoGroup>

      <DemoGroup title="Avatars">
        <Avatar name="Noa Cohen" size="sm" />
        <Avatar name="Omar Haddad" size="md" />
        <Avatar name="Dana Katz" size="lg" />
        <Avatar name="Sam" size="xl" />
        <Avatar name="Broken Image" src="/missing-avatar.png" size="md" />
      </DemoGroup>

      <DemoGroup title="Tooltip on hover and focus — press Esc to dismiss">
        <Tooltip content="Calories are estimated from your logged meals.">
          <IconButton label="About calorie estimates" icon={<Info />} variant="outline" size="sm" />
        </Tooltip>
        <Tooltip content="Shown below the trigger" side="bottom">
          <IconButton label="Tooltip below" icon={<Info />} variant="outline" size="sm" />
        </Tooltip>
      </DemoGroup>
    </Section>
  )
}
