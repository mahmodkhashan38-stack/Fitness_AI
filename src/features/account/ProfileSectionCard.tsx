import { Pencil, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button, Card } from '@/components/ui'

export interface ProfileSectionCardProps {
  title: string
  icon: ReactNode
  /** Summary shown when not editing (usually a <SummaryList>). */
  children: ReactNode
  /** When set, the card is editable: an Edit/Close disclosure button toggles `form`. */
  editing?: boolean
  onToggleEdit?: () => void
  /** Another card is being edited: editing this one is disabled until that finishes. */
  editLocked?: boolean
  form?: ReactNode
  /** Polite confirmation after a save, e.g. "Saved." */
  status?: string | null
}

/**
 * A rounded profile section. Editable cards follow the disclosure pattern: the button keeps
 * aria-expanded/aria-controls in sync, the form gets focus when it opens (the form component
 * focuses its first field), and focus returns to the button when it closes.
 */
function ProfileSectionCard({ title, icon, children, editing = false, onToggleEdit, editLocked = false, form, status }: ProfileSectionCardProps) {
  const headingId = useId()
  const regionId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)

  useEffect(() => {
    if (wasEditing.current && !editing) buttonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  return (
    <Card as="section" aria-labelledby={headingId} className="gap-4 transition-shadow hover:shadow-elevated">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-subtle text-accent [&_svg]:size-5" aria-hidden="true">
            {icon}
          </span>
          <h2 id={headingId} className="text-h4 text-foreground">
            {title}
          </h2>
        </div>
        {onToggleEdit && (
          <Button
            ref={buttonRef}
            variant="ghost"
            leftIcon={editing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            // Visible text plus the section, e.g. "Edit body information" (contains the visible label).
            aria-label={`${editing ? 'Close' : 'Edit'} ${title.toLowerCase()}`}
            aria-expanded={editing}
            aria-controls={regionId}
            disabled={editLocked && !editing}
            onClick={onToggleEdit}
          >
            {editing ? 'Close' : 'Edit'}
          </Button>
        )}
      </div>
      <div id={regionId}>{editing ? form : children}</div>
      <p role="status" className="text-body-sm text-success empty:hidden">
        {!editing && status ? status : ''}
      </p>
    </Card>
  )
}

/** Label/value rows for a card summary. */
export function SummaryList({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-body-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-foreground-muted">{row.label}</dt>
          <dd className="min-w-0 text-right font-medium break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default ProfileSectionCard
