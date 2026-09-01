import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Square } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  buildFriendlySummary,
  countHiddenNoise,
  extractActionableErrors,
  friendlyFixHint,
  humanizeError,
  parseLogLine
} from '../lib/logFormat'
import { Button, Panel, SectionLabel } from './ui'

function LogRow({
  time,
  kind,
  message
}: {
  time?: string
  kind: string
  message: string
}) {
  const styles: Record<string, string> = {
    meta: 'border-l-2 border-[var(--border)] pl-3 text-[var(--text)]',
    command:
      'my-1 border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] pl-3 py-1.5 text-[var(--accent)]',
    'dry-run':
      'my-1 border-l-2 border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] pl-3 py-1 text-[var(--warn)]',
    error:
      'my-1.5 border-l-2 border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] pl-3 py-2 text-[var(--danger)]',
    warn: 'border-l-2 border-[var(--warn)] pl-3 text-[var(--warn)]',
    success: 'border-l-2 border-[var(--ok)] pl-3 text-[var(--ok)]',
    output: 'pl-3 text-[var(--text-muted)] opacity-80',
    noise: 'pl-3 text-[var(--text-muted)] opacity-40'
  }

  return (
    <div className={`font-mono text-[11px] leading-relaxed ${styles[kind] ?? styles.output}`}>
      {time ? (
        <span className="mr-2 inline-block min-w-[4.5rem] font-sans text-[10px] tracking-wide text-[var(--text-muted)]">
          {time}
        </span>
      ) : null}
      {kind === 'command' ? (
        <span>
          <span className="mr-1 opacity-60">$</span>
          {message}
        </span>
      ) : kind === 'dry-run' ? (
        <span>
          <span className="mr-1.5 rounded bg-[color-mix(in_srgb,var(--warn)_20%,transparent)] px-1 py-0.5 font-sans text-[9px] font-semibold uppercase tracking-wider">
            preview
          </span>
          {message}
        </span>
      ) : (
        message
      )}
    </div>
  )
}

function StatusChip({
  active,
  exitCode,
  cancelled,
  isDryRun
}: {
  active: boolean
  exitCode: number | null
  cancelled: boolean
  isDryRun: boolean
}) {
  if (active) {
    return (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-2.5 py-0.5 font-sans text-[11px] font-medium text-[var(--warn)]">
        In progress
      </span>
    )
  }
  if (cancelled) {
    return (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-2.5 py-0.5 font-sans text-[11px] font-medium text-[var(--text-muted)]">
        Stopped
      </span>
    )
  }
  if (isDryRun && exitCode === 0) {
    return (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-2.5 py-0.5 font-sans text-[11px] font-medium text-[var(--warn)]">
        Preview only
      </span>
    )
  }
  if (exitCode === 0) {
    return (
      <span className="rounded-full bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] px-2.5 py-0.5 font-sans text-[11px] font-medium text-[var(--ok)]">
        Done
      </span>
    )
  }
  if (exitCode == null) {
    return null
  }
  return (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] px-2.5 py-0.5 font-sans text-[11px] font-medium text-[var(--danger)]">
      Problem
    </span>
  )
}

export function LogConsole({
  onCancel,
  showClear = true
}: {
  onCancel?: () => void
  showClear?: boolean
}) {
  const { job, clearJobLog } = useApp()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const technicalId = 'log-technical-details'
  const [showTechnical, setShowTechnical] = useState(false)
  const [verbose, setVerbose] = useState(false)
  const lastJobId = useRef<string | null>(null)

  const parsed = useMemo(
    () => job.lines.map((entry, i) => parseLogLine(i, entry.stream, entry.line)),
    [job.lines]
  )

  const isDryRun = parsed.some(
    (line) =>
      line.message.includes('DryRun=true') ||
      line.message.includes('(dry-run)') ||
      line.kind === 'dry-run' ||
      line.message.startsWith('DRY-RUN:')
  )
  const errors = useMemo(
    () => extractActionableErrors(parsed).map(humanizeError),
    [parsed]
  )
  const fixHint = useMemo(
    () => friendlyFixHint(extractActionableErrors(parsed), job.kind),
    [parsed, job.kind]
  )
  const hiddenNoise = useMemo(() => countHiddenNoise(parsed), [parsed])

  const summary = useMemo(
    () =>
      buildFriendlySummary(
        {
          active: job.active,
          cancelled: job.cancelled,
          exitCode: job.exitCode,
          kind: job.kind,
          isDryRun,
          hasJob: Boolean(job.id)
        },
        parsed
      ),
    [job.active, job.cancelled, job.exitCode, job.kind, job.id, isDryRun, parsed]
  )

  const visible = useMemo(
    () => (verbose ? parsed : parsed.filter((line) => line.kind !== 'noise')),
    [parsed, verbose]
  )

  useEffect(() => {
    if (job.id && job.id !== lastJobId.current) {
      lastJobId.current = job.id
      setShowTechnical(false)
      setVerbose(false)
    }
  }, [job.id])

  useEffect(() => {
    if (!showTechnical || !job.active) return
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visible.length, job.active, showTechnical])

  const failed =
    !job.active && Boolean(job.id) && !job.cancelled && job.exitCode != null && job.exitCode !== 0

  return (
    <Panel className="flex h-full min-h-[24rem] max-h-[calc(100vh-4rem)] flex-col overflow-hidden xl:sticky xl:top-8 xl:self-start xl:h-[calc(100vh-4rem)] xl:max-h-[calc(100vh-4rem)]">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SectionLabel className="mb-0">Status</SectionLabel>
          {job.id ? (
            <StatusChip
              active={job.active}
              exitCode={job.exitCode}
              cancelled={job.cancelled}
              isDryRun={isDryRun}
            />
          ) : null}
        </div>
        <div className="flex gap-2">
          {showClear ? (
            <Button
              variant="ghost"
              onClick={() => {
                clearJobLog()
                setShowTechnical(false)
              }}
              disabled={job.active}
            >
              Clear
            </Button>
          ) : null}
          {job.active && onCancel ? (
            <Button variant="danger" onClick={onCancel} icon={<Square size={14} strokeWidth={1.75} />}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5">
        <div
          aria-live="polite"
          aria-atomic="true"
          className={`rounded-lg border px-4 py-4 ${
            failed
              ? 'border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]'
              : job.active
                ? 'border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_6%,transparent)]'
                : summary.headline === 'All done' || summary.headline === 'Preview complete'
                  ? 'border-[var(--ok)] bg-[color-mix(in_srgb,var(--ok)_6%,transparent)]'
                  : 'border-[var(--border)] bg-[var(--bg-deep)]'
          }`}
        >
          <p className="font-display text-xl text-[var(--text)]">{summary.headline}</p>
          {summary.detail ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{summary.detail}</p>
          ) : null}
          {job.active && summary.activity ? (
            <p className="mt-2 text-sm text-[var(--text)]">{summary.activity}</p>
          ) : null}
          {failed && fixHint ? (
            <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)]">
              <span className="font-medium text-[var(--accent)]">What to try: </span>
              {fixHint}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          id="log-technical-toggle"
          aria-expanded={showTechnical}
          aria-controls={technicalId}
          onClick={() => setShowTechnical((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span>Technical details</span>
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className={`transition-transform ${showTechnical ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {showTechnical ? (
          <div id={technicalId} className="flex flex-col gap-2">
            {job.commandPreview ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2">
                <p className="font-sans text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  Command
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed break-all text-[var(--text)]">
                  {job.commandPreview}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              {hiddenNoise > 0 ? (
                <Button variant="ghost" onClick={() => setVerbose((v) => !v)}>
                  {verbose ? 'Hide extra lines' : `Show ${hiddenNoise} extra lines`}
                </Button>
              ) : null}
            </div>

            <div className="min-h-[12rem] space-y-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-deep)] p-2">
              {visible.length === 0 ? (
                <p className="p-2 font-sans text-sm text-[var(--text-muted)]">No output yet.</p>
              ) : (
                visible.map((line) => (
                  <LogRow
                    key={`${line.index}-${line.raw.slice(0, 32)}`}
                    time={line.time}
                    kind={line.kind}
                    message={line.message}
                  />
                ))
              )}
            </div>

            {errors.length > 0 ? (
              <div className="rounded-md border border-[var(--danger)] px-3 py-2">
                <p className="font-sans text-xs font-medium text-[var(--danger)]">Error details</p>
                <ul className="mt-1 space-y-1">
                  {errors.slice(-3).map((err, i) => (
                    <li
                      key={`${i}-${err.slice(0, 40)}`}
                      className="font-mono text-[11px] text-[var(--danger)]"
                    >
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            Open technical details only if you need the full command output.
          </p>
        )}
      </div>
    </Panel>
  )
}
