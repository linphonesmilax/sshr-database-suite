import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import type { AppSettings, JobEndedEvent, JobLogEvent, JobStartedEvent, ReadinessReport } from '../../../shared/types'

interface JobState {
  active: boolean
  id: string | null
  kind: string | null
  commandPreview: string
  lines: Array<{ stream: 'stdout' | 'stderr'; line: string }>
  exitCode: number | null
  cancelled: boolean
}

interface AppContextValue {
  settings: AppSettings | null
  readiness: ReadinessReport | null
  readinessLoading: boolean
  readinessError: string | null
  job: JobState
  refreshSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  refreshReadiness: (backupDir?: string) => Promise<ReadinessReport>
  clearJobLog: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const idleJob: JobState = {
  active: false,
  id: null,
  kind: null,
  commandPreview: '',
  lines: [],
  exitCode: null,
  cancelled: false
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [job, setJob] = useState<JobState>(idleJob)

  const refreshSettings = useCallback(async () => {
    const next = await window.api.getSettings()
    setSettings(next)
    return next
  }, [])

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = await window.api.setSettings(partial)
    setSettings(next)
    return next
  }, [])

  const refreshReadiness = useCallback(async (backupDir?: string) => {
    setReadinessLoading(true)
    setReadinessError(null)
    try {
      const report = await window.api.scanReadiness(backupDir)
      setReadiness(report)
      return report
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setReadinessError(message)
      throw e
    } finally {
      setReadinessLoading(false)
    }
  }, [])

  const clearJobLog = useCallback(() => {
    setJob((prev) => (prev.active ? prev : idleJob))
  }, [])

  useEffect(() => {
    void refreshSettings().then((s) => refreshReadiness(s.lastBackupDir))
  }, [refreshSettings, refreshReadiness])

  useEffect(() => {
    const offStarted = window.api.onJobStarted((event: JobStartedEvent) => {
      setJob({
        active: true,
        id: event.id,
        kind: event.kind,
        commandPreview: event.commandPreview,
        lines: [],
        exitCode: null,
        cancelled: false
      })
    })
    const offLog = window.api.onJobLog((event: JobLogEvent) => {
      setJob((prev) => {
        if (prev.id && prev.id !== event.id) return prev
        return {
          ...prev,
          lines: [...prev.lines, { stream: event.stream, line: event.line }]
        }
      })
    })
    const offEnded = window.api.onJobEnded((event: JobEndedEvent) => {
      setJob((prev) => {
        if (prev.id && prev.id !== event.id) return prev
        return {
          ...prev,
          active: false,
          exitCode: event.code,
          cancelled: event.cancelled
        }
      })
      void refreshReadiness()
    })
    return () => {
      offStarted()
      offLog()
      offEnded()
    }
  }, [refreshReadiness])

  return (
    <AppContext.Provider
      value={{
        settings,
        readiness,
        readinessLoading,
        readinessError,
        job,
        refreshSettings,
        updateSettings,
        refreshReadiness,
        clearJobLog
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
