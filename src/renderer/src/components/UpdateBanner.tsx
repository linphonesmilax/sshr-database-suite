import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '../../../shared/types'
import { Button } from './ui'

const HIDDEN_PHASES = new Set(['idle', 'not-available'])

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    return window.api.onUpdateStatus((next) => {
      setStatus(next)
      if (next.phase === 'available' || next.phase === 'downloading' || next.phase === 'ready') {
        setDismissed(false)
      }
    })
  }, [])

  if (dismissed || HIDDEN_PHASES.has(status.phase)) return null
  if (status.phase === 'checking') return null

  const isError = status.phase === 'error'
  const isReady = status.phase === 'ready'
  const isDownloading = status.phase === 'downloading'
  const isAvailable = status.phase === 'available'

  const text =
    status.message ||
    (isReady
      ? 'An update is ready. Restart to install.'
      : isDownloading
        ? `Downloading update… ${status.percent ?? 0}%`
        : isAvailable
          ? `Update ${status.version ?? ''} available.`
          : isError
            ? status.message || 'Could not check for updates.'
            : null)

  if (!text) return null

  return (
    <div
      className={[
        'flex items-center gap-3 border-b px-4 py-2.5 text-sm',
        isError
          ? 'border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg))] text-[var(--text)]'
          : 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg))] text-[var(--text)]'
      ].join(' ')}
      role="status"
    >
      <Download size={16} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" aria-hidden />
      <p className="min-w-0 flex-1">{text}</p>
      {isDownloading && typeof status.percent === 'number' ? (
        <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-[var(--bg-elevated)] sm:block">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }}
          />
        </div>
      ) : null}
      {isReady ? (
        <Button
          type="button"
          onClick={() => void window.api.installUpdate()}
          className="shrink-0"
          icon={<RefreshCw size={14} strokeWidth={1.75} />}
        >
          Restart now
        </Button>
      ) : null}
      {isError ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => void window.api.checkForUpdates()}
          className="shrink-0"
        >
          Try again
        </Button>
      ) : null}
      {!isDownloading ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  )
}
