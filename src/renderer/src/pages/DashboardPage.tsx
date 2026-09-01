import {
  ArrowRightLeft,
  CloudDownload,
  Database,
  FileCode,
  Folder,
  Key,
  LayoutDashboard,
  Package,
  RefreshCw
} from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Alert,
  Button,
  LoadingState,
  NavButton,
  PageHeader,
  Panel,
  SectionLabel,
  StatusDot
} from '../components/ui'

function ReadinessChip({
  ok,
  label,
  icon
}: {
  ok: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
        ok
          ? 'bg-[color-mix(in_srgb,var(--ok)_15%,transparent)] text-[var(--ok)]'
          : 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]'
      }`}
    >
      {icon}
      {label}
    </span>
  )
}

export default function DashboardPage() {
  const { readiness, readinessLoading, readinessError, refreshReadiness, settings, job } =
    useApp()
  const [rescanning, setRescanning] = useState(false)

  const readyCount = readiness?.services.filter((s) => s.ready).length ?? 0
  const serviceTotal = readiness?.services.length ?? 0
  const dumpCount = readiness?.dumps.filter((d) => d.present).length ?? 0
  const dumpTotal = readiness?.dumps.length ?? 0

  const tools = readiness?.toolchain

  const handleRescan = async () => {
    setRescanning(true)
    try {
      await refreshReadiness(settings?.lastBackupDir)
    } finally {
      setRescanning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Readiness for local migrate, dump coverage, and required CLI tools against your microservice root."
        icon={<LayoutDashboard size={28} strokeWidth={1.75} />}
        actions={
          <Button
            variant="secondary"
            onClick={() => void handleRescan()}
            disabled={job.active || rescanning}
            loading={rescanning}
            icon={<RefreshCw size={16} strokeWidth={1.75} />}
          >
            Rescan
          </Button>
        }
      />

      {readinessError ? (
        <Alert variant="error" title="Scan failed" className="mb-6">
          {readinessError}{' '}
          <button
            type="button"
            onClick={() => void handleRescan()}
            className="text-[var(--accent)] underline"
          >
            Retry
          </button>
        </Alert>
      ) : null}

      {readinessLoading && !readiness ? (
        <LoadingState message="Scanning readiness…" />
      ) : readiness ? (
        <div className="space-y-6">
          {!readiness.rootExists ? (
            <Alert variant="warning" title="Microservice path missing">
              Update the microservice root in{' '}
              <NavButton to="/settings" variant="ghost" className="inline-flex px-1 py-0">
                Settings
              </NavButton>{' '}
              before running migrations.
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Panel>
              <SectionLabel>Suite / microservice</SectionLabel>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <StatusDot
                    ok={Boolean(
                      readiness.toolchain.migrateEngine && readiness.toolchain.backupEngine
                    )}
                    label="Built-in engines"
                  />
                  <div>
                    <p className="text-[var(--text)]">Built-in engines</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Migrate + backup/restore run in Electron (no shell scripts)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <StatusDot ok={readiness.rootExists} label="Migrate target" />
                  <div>
                    <p className="text-[var(--text)]">Migrate target</p>
                    <p className="font-mono text-xs break-all text-[var(--text-muted)]">
                      {readiness.root}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {readiness.rootExists
                  ? 'Microservice path found'
                  : 'Microservice path missing — update Settings'}
              </p>
            </Panel>
            <Panel>
              <SectionLabel>Services ready</SectionLabel>
              <p className="font-display text-3xl text-[var(--text)]">
                {readyCount}
                <span className="text-lg text-[var(--text-muted)]"> / {serviceTotal}</span>
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Needs dir, schema, .env.local, node_modules
              </p>
            </Panel>
            <Panel>
              <SectionLabel>Dump coverage</SectionLabel>
              <p className="font-display text-3xl text-[var(--text)]">
                {dumpCount}
                <span className="text-lg text-[var(--text-muted)]"> / {dumpTotal}</span>
              </p>
              <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">
                {readiness.backupDir}
              </p>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <SectionLabel>Service readiness</SectionLabel>
              <ul className="divide-y divide-[var(--border)]">
                {readiness.services.map((svc) => (
                  <li key={svc.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot ok={svc.ready} label={svc.name} />
                      <span className="text-sm">{svc.name}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <ReadinessChip
                        ok={svc.dirExists}
                        label="dir"
                        icon={<Folder size={10} strokeWidth={1.75} />}
                      />
                      <ReadinessChip
                        ok={svc.hasSchema}
                        label="schema"
                        icon={<FileCode size={10} strokeWidth={1.75} />}
                      />
                      <ReadinessChip
                        ok={svc.hasEnvLocal}
                        label="env"
                        icon={<Key size={10} strokeWidth={1.75} />}
                      />
                      <ReadinessChip
                        ok={svc.hasNodeModules}
                        label="nm"
                        icon={<Package size={10} strokeWidth={1.75} />}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="space-y-6">
              <Panel>
                <SectionLabel>Dump files</SectionLabel>
                <ul className="divide-y divide-[var(--border)]">
                  {readiness.dumps.map((db) => (
                    <li key={db.name} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusDot ok={db.present} label={db.name} />
                        <span className="font-mono text-sm">{db.name}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {db.sql ? '.sql' : ''}
                        {db.sql && db.dump ? ' + ' : ''}
                        {db.dump ? '.dump' : ''}
                        {!db.present ? 'missing' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel>
                <SectionLabel>Toolchain</SectionLabel>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['node', tools?.node],
                    ['pnpm', tools?.pnpm],
                    ['pg_dump', tools?.pgDump],
                    ['psql', tools?.psql],
                    ['pg_restore', tools?.pgRestore],
                    ['migrate engine', tools?.migrateEngine],
                    ['backup engine', tools?.backupEngine]
                  ].map(([label, ok]) => (
                    <div key={String(label)} className="flex items-center gap-2">
                      <StatusDot ok={Boolean(ok)} label={String(label)} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <Panel>
            <SectionLabel>Quick actions</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <NavButton
                to="/backup"
                variant="secondary"
                icon={<CloudDownload size={16} strokeWidth={1.75} />}
              >
                Backup from cloud
              </NavButton>
              <NavButton
                to="/restore"
                variant="secondary"
                icon={<Database size={16} strokeWidth={1.75} />}
              >
                Restore locally
              </NavButton>
              <NavButton
                to="/migrate"
                icon={<ArrowRightLeft size={16} strokeWidth={1.75} />}
              >
                Run migrations
              </NavButton>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Typical flow: Backup → Restore (recreate) → Migrate. Last scan{' '}
              {new Date(readiness.scannedAt).toLocaleString()}.
            </p>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
