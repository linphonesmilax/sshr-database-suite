import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '../../../shared/types'
import { Button } from './ui'

/** Transient phases auto-hide after a few seconds. Sticky ones need user action. */
const AUTO_HIDE_MS: Partial<Record<UpdateStatus['phase'], number>> = {
  checking: 2500,
  'not-available': 3500,
  available: 0,
  downloading: 0,
  ready: 0,
  error: 8000,
  idle: 0
}

export function UpdateToast() {
  const [status, setStatus] = useState<UpdateStatus>({ phase: 'idle' })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    return window.api.onUpdateStatus((next) => {
      setStatus(next)
      if (next.phase === 'idle') {
        setVisible(false)
        return
      }
      setVisible(true)
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    const ms = AUTO_HIDE_MS[status.phase]
    if (!ms) return
    const t = window.setTimeout(() => setVisible(false), ms)
    return () => window.clearTimeout(t)
  }, [visible, status.phase, status.message, status.percent])

  if (!visible || status.phase === 'idle') return null

  const isError = status.phase === 'error'
  const isReady = status.phase === 'ready'
  const isDownloading = status.phase === 'downloading'
  const isAvailable = status.phase === 'available'
  const isChecking = status.phase === 'checking'
  const isOk = status.phase === 'not-available'

  const text =
    status.message ||
    (isReady
      ? `Update ${status.version ?? ''} is ready. Restart to install.`
      : isDownloading
        ? `Downloading update… ${status.percent ?? 0}%`
        : isAvailable
          ? `Update ${status.version ?? ''} available.`
          : isChecking
            ? 'Checking for updates…'
            : isOk
              ? 'You are up to date.'
              : isError
                ? 'Could not check for updates.'
                : null)

  if (!text) return null

  const Icon = isError
    ? AlertCircle
    : isOk
      ? CheckCircle2
      : isChecking || isDownloading
        ? Loader2
        : Download

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
          isError
            ? 'border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-[color-mix(in_srgb,var(--bg-panel)_92%,var(--danger))] text-[var(--text)]'
            : isOk
              ? 'border-[color-mix(in_srgb,var(--ok)_40%,var(--border))] bg-[color-mix(in_srgb,var(--bg-panel)_92%,var(--ok))] text-[var(--text)]'
              : 'border-[color-mix(in_srgb,var(--accent)_40%,var(--border))] bg-[color-mix(in_srgb,var(--bg-panel)_94%,var(--accent))] text-[var(--text)]'
        ].join(' ')}
      >
        <Icon
          size={18}
          strokeWidth={1.75}
          className={[
            'mt-0.5 shrink-0',
            isError
              ? 'text-[var(--danger)]'
              : isOk
                ? 'text-[var(--ok)]'
                : 'text-[var(--accent)]',
            isChecking || isDownloading ? 'animate-spin' : ''
          ].join(' ')}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="leading-snug">{text}</p>
          {isDownloading && typeof status.percent === 'number' ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {isReady ? (
              <Button
                type="button"
                onClick={() => void window.api.installUpdate()}
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
              >
                Try again
              </Button>
            ) : null}
          </div>
        </div>
        {!isDownloading ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setVisible(false)}
            className="shrink-0 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)]"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
