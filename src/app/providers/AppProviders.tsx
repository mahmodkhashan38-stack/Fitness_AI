import type { ReactNode } from 'react'
import ThemeProvider from '@/app/providers/ThemeProvider'

interface AppProvidersProps {
  children: ReactNode
}

/**
 * App-wide providers, outermost first. Add a provider here only when state is
 * genuinely shared across unrelated parts of the app; feature-specific state
 * belongs in a provider mounted by that feature's route or layout instead.
 *
 * The router is rendered inside these providers, so providers here cannot use
 * router hooks. Providers that need the router belong in a route layout (e.g. AppShell).
 */
function AppProviders({ children }: AppProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>
}

export default AppProviders
