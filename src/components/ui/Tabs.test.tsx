import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

function PeriodTabs({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Tabs defaultValue="week" onValueChange={onValueChange}>
      <TabsList aria-label="Progress period">
        <TabsTrigger value="week">Week</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
        <TabsTrigger value="quarter" disabled>
          Quarter
        </TabsTrigger>
        <TabsTrigger value="year">Year</TabsTrigger>
      </TabsList>
      <TabsContent value="week">Week summary</TabsContent>
      <TabsContent value="month">Month summary</TabsContent>
      <TabsContent value="year">Year summary</TabsContent>
    </Tabs>
  )
}

const tab = (name: string) => screen.getByRole('tab', { name })
const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key })

describe('Tabs', () => {
  it('wires tablist, tabs and panels together (WAI-ARIA tabs pattern)', () => {
    render(<PeriodTabs />)
    expect(screen.getByRole('tablist', { name: 'Progress period' })).toBeTruthy()
    const week = tab('Week')
    const panel = screen.getByRole('tabpanel', { name: 'Week' })
    expect(week.getAttribute('aria-selected')).toBe('true')
    expect(week.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.textContent).toBe('Week summary')
    expect(screen.queryByText('Month summary')).toBeNull()
  })

  it('roving tabindex: only the selected tab is in the Tab order', () => {
    render(<PeriodTabs />)
    expect(tab('Week').tabIndex).toBe(0)
    expect(tab('Month').tabIndex).toBe(-1)
    expect(tab('Year').tabIndex).toBe(-1)
  })

  it('arrow keys move and select, skipping disabled tabs, and wrap around', () => {
    render(<PeriodTabs />)
    tab('Week').focus()
    press('ArrowRight')
    expect(document.activeElement).toBe(tab('Month'))
    expect(tab('Month').getAttribute('aria-selected')).toBe('true')
    press('ArrowRight') // Quarter is disabled
    expect(document.activeElement).toBe(tab('Year'))
    press('ArrowRight')
    expect(document.activeElement).toBe(tab('Week'))
    press('ArrowLeft')
    expect(document.activeElement).toBe(tab('Year'))
  })

  it('Home and End jump to the first and last enabled tab', () => {
    render(<PeriodTabs />)
    tab('Week').focus()
    press('End')
    expect(document.activeElement).toBe(tab('Year'))
    press('Home')
    expect(document.activeElement).toBe(tab('Week'))
  })

  it('reports changes and supports controlled use', () => {
    const onValueChange = vi.fn()
    function Controlled() {
      const [value, setValue] = useState('week')
      return (
        <Tabs
          value={value}
          onValueChange={(next) => {
            onValueChange(next)
            setValue(next)
          }}
        >
          <TabsList aria-label="Period">
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
          <TabsContent value="week">W</TabsContent>
          <TabsContent value="month">M</TabsContent>
        </Tabs>
      )
    }
    render(<Controlled />)
    fireEvent.click(tab('Month'))
    expect(onValueChange).toHaveBeenCalledWith('month')
    expect(screen.getByRole('tabpanel').textContent).toBe('M')
  })
})
