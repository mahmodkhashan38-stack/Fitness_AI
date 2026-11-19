import { ArrowRight, Bookmark, Dumbbell, Pencil, Play, Plus, Share2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, IconButton, Tooltip } from '@/components/ui'
import { DemoGroup, Section } from '@/dev/design-system/Section'

export function ActionsSection() {
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!saving) return
    const timer = window.setTimeout(() => setSaving(false), 2000)
    return () => window.clearTimeout(timer)
  }, [saving])

  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Five variants and three sizes. Medium (44px) is the default touch target. Loading keeps the button focusable and announces it as busy."
    >
      <DemoGroup title="Variants">
        <Button variant="primary">Start workout</Button>
        <Button variant="secondary">Edit plan</Button>
        <Button variant="outline">View history</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="destructive">Delete session</Button>
      </DemoGroup>

      <DemoGroup title="Sizes">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </DemoGroup>

      <DemoGroup title="With icons">
        <Button leftIcon={<Play aria-hidden="true" />}>Start session</Button>
        <Button variant="secondary" leftIcon={<Plus aria-hidden="true" />}>
          Add exercise
        </Button>
        <Button variant="outline" rightIcon={<ArrowRight aria-hidden="true" />}>
          Continue
        </Button>
      </DemoGroup>

      <DemoGroup title="States">
        <Button loading={saving} loadingText="Saving…" onClick={() => setSaving(true)}>
          Save workout
        </Button>
        <Button variant="secondary" loading>
          Syncing
        </Button>
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled outline
        </Button>
      </DemoGroup>

      <DemoGroup title="Full width (mobile actions)" className="block max-w-sm">
        <Button fullWidth size="lg" leftIcon={<Dumbbell aria-hidden="true" />}>
          Begin training session
        </Button>
      </DemoGroup>

      <DemoGroup title="Icon buttons with tooltips">
        <Tooltip content="Add exercise">
          <IconButton label="Add exercise" icon={<Plus />} variant="primary" />
        </Tooltip>
        <Tooltip content="Edit workout">
          <IconButton label="Edit workout" icon={<Pencil />} variant="secondary" />
        </Tooltip>
        <Tooltip content="Save to favourites">
          <IconButton label="Save to favourites" icon={<Bookmark />} variant="outline" />
        </Tooltip>
        <Tooltip content="Share progress">
          <IconButton label="Share progress" icon={<Share2 />} />
        </Tooltip>
        <Tooltip content="Delete workout" align="end">
          <IconButton label="Delete workout" icon={<Trash2 />} variant="destructive" />
        </Tooltip>
        <IconButton label="Loading" icon={<Plus />} variant="secondary" loading />
        <IconButton label="Unavailable" icon={<Plus />} variant="secondary" disabled />
      </DemoGroup>
    </Section>
  )
}
