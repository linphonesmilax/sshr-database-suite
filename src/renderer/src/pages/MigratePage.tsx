import { ArrowRightLeft, CheckCircle2, Play, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SERVICES, MigrateMode } from '../../../shared/types'
import { useApp } from '../context/AppContext'
import {
  Alert,
  Button,
  CheckboxRow,
  CommandPreview,
  NavButton,
  PageHeader,
  Panel,
  SectionLabel,
  SegmentedControl
} from '../components/ui'
import { ServicePicker } from '../components/Pickers'
import { LogConsole } from '../components/LogConsole'
import { parseJobHeadline } from '../lib/jobSummary'

const MODE_OPTIONS: Array<{ value: MigrateMode; label: string }> = [
  { value: 'full', label: 'Migrate + generate' },
  { value: 'deploy-only', label: 'Deploy only' },
  { value: 'generate-only', label: 'Generate only' }
]

export default function MigratePage() {
  const { readiness, job, settings } = useApp()
  const [selected, setSelected] = useState<string[]>([...SERVICES])
  const [mode, setMode] = useState<MigrateMode>('full')
  const [dryRun, setDryRun] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readyMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const s of readiness?.services ?? []) map[s.name] = s.ready
    return map
  }, [readiness])

  const preview = useMemo(() => {
    const root = settings?.microserviceRoot ?? '<microservice-root>'
    const parts = [`migrate --root ${root}`]
    if (dryRun) parts.push('--dry-run')
    if (mode === 'deploy-only') parts.push('--deploy-only')
    if (mode === 'generate-only') parts.push('--generate-only')
    parts.push(...selected)
    return parts.join(' ')
  }, [settings, dryRun, mode, selected])

  const summary = useMemo(
    () => parseJobHeadline('migrate', job.lines.map((l) => l.line)),
    [job.lines]
  )

  const pnpmReady = readiness?.toolchain.pnpm !== false
  const nodeReady = readiness?.toolchain.node !== false
  const canRun =
    Boolean(readiness?.rootExists) && pnpmReady && nodeReady && selected.length > 0 && !job.active

  const run = async () => {
    setError(null)
    if (selected.length === 0) {
      setError('Select at least one service.')
      return
    }
    if (!readiness?.rootExists) {
      setError('Set a valid microservice root in Settings before migrating.')
      return
    }
    if (!pnpmReady) {
      setError(
        'pnpm was not found. Install pnpm, then fully quit and reopen this app so the desktop launcher can see it.'
      )
      return
    }
    if (!nodeReady) {
      setError('Node.js was not found. Install Node 20+, then fully quit and reopen this app.')
      return
    }
    try {
      await window.api.runJob({
        kind: 'migrate',
        services: selected,
        mode,
        dryRun
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)]">
      <div className="space-y-5">
        <PageHeader
          className="mb-2"
          title="Migrate"
          subtitle="Apply pending Prisma migrations and regenerate clients via pnpm in each service."
          icon={<ArrowRightLeft size={28} strokeWidth={1.75} />}
          actions={
            <Button
              disabled={!canRun}
              onClick={() => void run()}
              icon={<Play size={16} strokeWidth={1.75} />}
            >
              {dryRun ? 'Dry run' : 'Run migrate'}
            </Button>
          }
        />

          {!readiness?.rootExists ? (
            <Alert variant="warning" title="Microservice path missing">
              Set the microservice root in{' '}
              <NavButton to="/settings" variant="ghost" className="inline-flex px-1 py-0">
                Settings
              </NavButton>{' '}
              before running migrations.
            </Alert>
          ) : null}

          {readiness?.rootExists && (!pnpmReady || !nodeReady) ? (
            <Alert variant="warning" title="Migrate tools missing">
              {!nodeReady ? 'Node.js was not found on PATH. ' : null}
              {!pnpmReady ? 'pnpm was not found on PATH. ' : null}
              Install the missing tools, then fully quit and reopen this app (AppImage / menu
              launches often miss nvm installs).
            </Alert>
          ) : null}

          <ServicePicker selected={selected} onChange={setSelected} readyMap={readyMap} />

          <Panel>
            <SectionLabel>Mode</SectionLabel>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={MODE_OPTIONS}
              label="Migration mode"
            />
            <div className="mt-3">
              <CheckboxRow
                checked={dryRun}
                onChange={setDryRun}
                label="Dry run"
                hint="Print commands only — no migrate or generate"
              />
            </div>
          </Panel>

          <CommandPreview command={preview} />
          {error ? <Alert variant="error">{error}</Alert> : null}

          {!job.active && (summary.ok.length || summary.skipped.length || summary.failed.length) ? (
            <Panel>
              <SectionLabel>Last summary</SectionLabel>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[var(--ok)]">
                    <CheckCircle2 size={14} strokeWidth={1.75} />
                    OK
                  </p>
                  <p className="font-mono text-xs">{summary.ok.join(' ') || '—'}</p>
                </div>
                <div>
                  <p className="text-[var(--warn)]">Skipped</p>
                  <p className="font-mono text-xs">{summary.skipped.join(' ') || '—'}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[var(--danger)]">
                    <XCircle size={14} strokeWidth={1.75} />
                    Failed
                  </p>
                  <p className="font-mono text-xs">{summary.failed.join(' ') || '—'}</p>
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel className="xl:sticky xl:bottom-0">
            <Button
              className="w-full"
              disabled={!canRun}
              onClick={() => void run()}
              icon={<Play size={16} strokeWidth={1.75} />}
            >
              {dryRun ? 'Dry run' : 'Run migrate'}
            </Button>
          </Panel>
        </div>

      <LogConsole onCancel={() => void window.api.cancelJob()} />
    </div>
  )
}
