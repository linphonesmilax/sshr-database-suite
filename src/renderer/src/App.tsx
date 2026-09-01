import { useEffect, useState } from 'react'
import { NavLink, Outlet, Routes, Route } from 'react-router-dom'
import {
  ArrowRightLeft,
  CheckCircle2,
  CloudDownload,
  Database,
  LayoutDashboard,
  Loader2,
  Monitor,
  Moon,
  Settings,
  Sun
} from 'lucide-react'
import { AppProvider, useApp } from './context/AppContext'
import DashboardPage from './pages/DashboardPage'
import MigratePage from './pages/MigratePage'
import BackupPage from './pages/BackupPage'
import RestorePage from './pages/RestorePage'
import SettingsPage from './pages/SettingsPage'
import {
  cycleThemePreference,
  getStoredTheme,
  themeLabel,
  type ThemePreference
} from './lib/theme'

const nav = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/migrate', label: 'Migrate', icon: ArrowRightLeft },
  { to: '/backup', label: 'Backup', icon: CloudDownload },
  { to: '/restore', label: 'Restore', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings }
]

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  switch (preference) {
    case 'dark':
      return <Moon size={14} strokeWidth={1.75} />
    case 'light':
      return <Sun size={14} strokeWidth={1.75} />
    case 'system':
      return <Monitor size={14} strokeWidth={1.75} />
  }
}

function Shell() {
  const { job, settings } = useApp()
  const [themePref, setThemePref] = useState<ThemePreference>(getStoredTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (getStoredTheme() === 'system') {
        document.documentElement.dataset.theme = mq.matches ? 'light' : 'dark'
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="app-grid flex h-full min-h-0">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-panel)_88%,transparent)] px-4 py-6">
        <div className="mb-8 px-2">
          <p className="font-display text-[1.65rem] leading-none tracking-tight text-[var(--text)]">
            SSHR
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Database Suite
          </p>
        </div>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    isActive
                      ? 'bg-[var(--bg-elevated)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]'
                  ].join(' ')
                }
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
          <p className="truncate" title={settings?.microserviceRoot}>
            {settings?.microserviceRoot ?? 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            {job.active ? (
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin text-[var(--warn)]" />
            ) : (
              <CheckCircle2 size={14} strokeWidth={1.75} className="text-[var(--ok)]" />
            )}
            <p className={job.active ? 'text-[var(--warn)]' : 'text-[var(--ok)]'}>
              {job.active ? `Running ${job.kind}…` : 'Idle'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setThemePref(cycleThemePreference(themePref))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            title={`Theme: ${themeLabel(themePref)}`}
          >
            <ThemeIcon preference={themePref} />
            <span>{themeLabel(themePref)} theme</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="migrate" element={<MigratePage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="restore" element={<RestorePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}
