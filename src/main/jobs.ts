import { randomUUID } from 'crypto'
import {
  AppSettings,
  JobEndedEvent,
  JobInput,
  JobLogEvent,
  JobStartedEvent
} from '../shared/types'
import { runBackup, runRestore, buildBackupPreview, buildRestorePreview } from './databases'
import { runMigrate, buildMigratePreview } from './migrate'
import { JobCancelledError, ProcessController } from './process'

interface JobCallbacks {
  onStarted: (event: JobStartedEvent) => void
  onLog: (event: JobLogEvent) => void
  onEnded: (event: JobEndedEvent) => void
}

interface ActiveJob {
  id: string
  controller: ProcessController
}

let activeJob: ActiveJob | null = null

function previewFor(settings: AppSettings, input: JobInput): string {
  if (input.kind === 'migrate') {
    return buildMigratePreview(settings.microserviceRoot, input)
  }
  if (input.kind === 'backup') {
    return buildBackupPreview(input)
  }
  return buildRestorePreview(input)
}

export async function runJob(
  settings: AppSettings,
  input: JobInput,
  callbacks: JobCallbacks
): Promise<{ id: string; commandPreview: string }> {
  if (activeJob) {
    throw new Error('A job is already running. Cancel it before starting another.')
  }

  const id = randomUUID()
  const controller = new ProcessController()
  const commandPreview = previewFor(settings, input)

  activeJob = { id, controller }
  callbacks.onStarted({ id, kind: input.kind, commandPreview })

  const onLog = (stream: 'stdout' | 'stderr', line: string): void => {
    callbacks.onLog({ id, stream, line })
  }

  // Run async so IPC returns immediately and UI can stream logs / cancel
  void (async () => {
    let code: number | null = 0
    let cancelled = false
    try {
      if (input.kind === 'migrate') {
        await runMigrate(settings.microserviceRoot, input, controller, onLog)
      } else if (input.kind === 'backup') {
        await runBackup(input, controller, onLog)
      } else {
        await runRestore(input, controller, onLog)
      }
    } catch (err) {
      if (err instanceof JobCancelledError) {
        cancelled = true
        code = null
        onLog('stderr', `[cancelled] Job stopped by user`)
      } else {
        code = 1
        const message = err instanceof Error ? err.message : String(err)
        onLog('stderr', message)
      }
    } finally {
      if (activeJob?.id === id) activeJob = null
      callbacks.onEnded({
        id,
        code,
        signal: null,
        cancelled
      })
    }
  })()

  return { id, commandPreview }
}

export async function cancelActiveJob(): Promise<boolean> {
  if (!activeJob) return false
  activeJob.controller.cancel()
  return true
}
