import { AlertTriangle, CheckCircle2, Database, Play, Trash2, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DATABASES, PRESETS } from '../../../shared/types'
import { useApp } from '../context/AppContext'
import {
  Alert,
  Button,
  CheckboxRow,
  CommandPreview,
  Field,
  InputActionRow,
  PageHeader,
  Panel,
  SectionLabel,
  TextInput,
  PasswordInput
} from '../components/ui'
import { DatabasePicker } from '../components/Pickers'
import { LogConsole } from '../components/LogConsole'
import { parseJobHeadline } from '../lib/jobSummary'

function JobSummaryPanel({
  ok,
  skipped,
  failed
}: {
  ok: string[]
  skipped: string[]
  failed: string[]
}) {
  if (!ok.length && !skipped.length && !failed.length) return null
  return (
    <Panel>
      <SectionLabel>Last summary</SectionLabel>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 text-[var(--ok)]">
            <CheckCircle2 size={14} strokeWidth={1.75} />
            OK
          </p>
          <p className="font-mono text-xs">{ok.join(' ') || '—'}</p>
        </div>
        <div>
          <p className="text-[var(--warn)]">Skipped</p>
          <p className="font-mono text-xs">{skipped.join(' ') || '—'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-[var(--danger)]">
            <XCircle size={14} strokeWidth={1.75} />
            Failed
          </p>
          <p className="font-mono text-xs">{failed.join(' ') || '—'}</p>
        </div>
      </div>
    </Panel>
  )
}

export default function RestorePage() {
  const { settings, updateSettings, job, readiness, refreshReadiness } = useApp()
  const [host, setHost] = useState<string>(PRESETS.localRestore.host)
  const [port, setPort] = useState<string>(PRESETS.localRestore.port)
  const [user, setUser] = useState<string>(PRESETS.localRestore.user)
  const [password, setPassword] = useState('postgres')
  const [adminDb, setAdminDb] = useState('postgres')
  const [backupDir, setBackupDir] = useState('')
  const [selected, setSelected] = useState<string[]>([...DATABASES])
  const [recreate, setRecreate] = useState(false)
  const [dropOnly, setDropOnly] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ backupDir?: string; confirm?: string }>({})

  useEffect(() => {
    if (!settings) return
    setHost(settings.lastRestoreHost)
    setPort(settings.lastRestorePort)
    setUser(settings.lastRestoreUser)
    setAdminDb(settings.lastRestoreAdminDb)
    setBackupDir(settings.lastBackupDir)
  }, [settings])

  const dumpMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const d of readiness?.dumps ?? []) map[d.name] = d.present
    return map
  }, [readiness])

  const missingDumpSelected = useMemo(
    () => (!dropOnly ? selected.filter((name) => dumpMap[name] === false) : []),
    [selected, dumpMap, dropOnly]
  )

  const applyLocalPreset = () => {
    setHost(PRESETS.localRestore.host)
    setPort(PRESETS.localRestore.port)
    setUser(PRESETS.localRestore.user)
  }

  const needsConfirm = recreate || dropOnly
  const expectedConfirm = dropOnly ? 'DROP' : recreate ? 'RECREATE' : ''
  const confirmOk = !needsConfirm || confirmText.trim().toUpperCase() === expectedConfirm

  const preview = useMemo(() => {
    const parts = [
      'restore',
      '-H',
      host,
      '-P',
      port,
      '-U',
      user,
      '-W',
      '***',
      '-d',
      backupDir || '(dir)',
      '-a',
      adminDb
    ]
    for (const db of selected) parts.push('-D', db)
    if (recreate) parts.push('--recreate')
    if (dropOnly) parts.push('--drop-only')
    if (dryRun) parts.push('--dry-run')
    return parts.join(' ')
  }, [host, port, user, backupDir, adminDb, selected, recreate, dropOnly, dryRun])

  const summary = useMemo(
    () => parseJobHeadline('restore', job.lines.map((l) => l.line)),
    [job.lines]
  )

  const pickDir = async () => {
    const dir = await window.api.pickDir('Select directory containing dump files')
    if (dir) {
      setBackupDir(dir)
      await updateSettings({ lastBackupDir: dir })
      await refreshReadiness(dir)
    }
  }

  const run = async () => {
    setError(null)
    const nextFieldErrors: { backupDir?: string; confirm?: string } = {}
    if (!dropOnly && !backupDir.trim()) {
      nextFieldErrors.backupDir = 'Backup directory is required.'
    }
    if (selected.length === 0) {
      setError('Select at least one database.')
    }
    if (!confirmOk) {
      nextFieldErrors.confirm = `Type ${expectedConfirm} to confirm.`
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0 || selected.length === 0) return

    await updateSettings({
      lastRestoreHost: host,
      lastRestorePort: port,
      lastRestoreUser: user,
      lastRestoreAdminDb: adminDb,
      lastBackupDir: backupDir
    })
    try {
      await window.api.runJob({
        kind: 'restore',
        host,
        port,
        user,
        password,
        backupDir,
        adminDb,
        databases: selected,
        recreate,
        dropOnly,
        dryRun
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const actionLabel = dryRun ? 'Dry run' : dropOnly ? 'Drop databases' : 'Run restore'
  const actionIcon =
    dropOnly ? (
      <Trash2 size={16} strokeWidth={1.75} />
    ) : (
      <Database size={16} strokeWidth={1.75} />
    )

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)]">
      <div className="space-y-5">
        <PageHeader
          className="mb-2"
          title="Restore"
          subtitle="Restore dumps into local PostgreSQL. Destructive options require typed confirmation."
          actions={
            <Button
              variant={needsConfirm ? 'danger' : 'primary'}
              disabled={job.active}
              onClick={() => void run()}
              icon={actionIcon}
            >
              {actionLabel}
            </Button>
          }
        />

          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel className="mb-0">Connection</SectionLabel>
              <Button variant="ghost" onClick={applyLocalPreset}>
                Apply {PRESETS.localRestore.label} preset
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Host">
                <TextInput value={host} onChange={(e) => setHost(e.target.value)} />
              </Field>
              <Field label="Port">
                <TextInput value={port} onChange={(e) => setPort(e.target.value)} />
              </Field>
              <Field label="User">
                <TextInput value={user} onChange={(e) => setUser(e.target.value)} />
              </Field>
              <Field
                label="Password"
                hint="Same as manage-databases.sh / PGPASSWORD. Leave empty only if the app was launched with PGPASSWORD set."
              >
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Admin database">
                <TextInput value={adminDb} onChange={(e) => setAdminDb(e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <SectionLabel>Dump source & options</SectionLabel>
            <Field label="Backup directory" error={fieldErrors.backupDir}>
              <InputActionRow
                actions={
                  <Button variant="secondary" onClick={() => void pickDir()}>
                    Browse
                  </Button>
                }
              >
                <TextInput
                  value={backupDir}
                  onChange={(e) => {
                    setBackupDir(e.target.value)
                    if (fieldErrors.backupDir) setFieldErrors((p) => ({ ...p, backupDir: undefined }))
                  }}
                  error={Boolean(fieldErrors.backupDir)}
                />
              </InputActionRow>
            </Field>
            <div className="mt-3 space-y-1">
              <CheckboxRow
                checked={recreate}
                onChange={(v) => {
                  setRecreate(v)
                  if (v) setDropOnly(false)
                  setConfirmText('')
                  setFieldErrors({})
                }}
                label="Recreate databases"
                hint="DROP DATABASE … WITH (FORCE) then restore"
              />
              <CheckboxRow
                checked={dropOnly}
                onChange={(v) => {
                  setDropOnly(v)
                  if (v) setRecreate(false)
                  setConfirmText('')
                  setFieldErrors({})
                }}
                label="Drop only"
                hint="Drop target DBs without restoring"
              />
              <CheckboxRow checked={dryRun} onChange={setDryRun} label="Dry run" />
            </div>
            {needsConfirm ? (
              <div className="mt-3">
                <Field
                  label={`Type ${expectedConfirm} to confirm`}
                  hint="Required for destructive operations"
                  error={fieldErrors.confirm}
                >
                  <TextInput
                    value={confirmText}
                    onChange={(e) => {
                      setConfirmText(e.target.value)
                      if (fieldErrors.confirm) setFieldErrors((p) => ({ ...p, confirm: undefined }))
                    }}
                    placeholder={expectedConfirm}
                    error={Boolean(fieldErrors.confirm)}
                    aria-describedby="restore-confirm-hint"
                  />
                </Field>
              </div>
            ) : null}
          </Panel>

          <DatabasePicker selected={selected} onChange={setSelected} dumpMap={dumpMap} />
          <CommandPreview command={preview} />

          {needsConfirm && selected.length > 0 ? (
            <Alert variant="warning" title="Destructive operation">
              You are about to {dropOnly ? 'DROP' : 'RECREATE'} {selected.length} database
              {selected.length > 1 ? 's' : ''}: {selected.join(', ')}
            </Alert>
          ) : null}

          {missingDumpSelected.length > 0 ? (
            <Alert variant="warning" title="Missing dump files">
              {missingDumpSelected.length} selected database
              {missingDumpSelected.length > 1 ? 's have' : ' has'} no dump file:{' '}
              {missingDumpSelected.join(', ')}
            </Alert>
          ) : null}

          {!job.active && (summary.ok.length || summary.failed.length) ? (
            <JobSummaryPanel ok={summary.ok} skipped={summary.skipped} failed={summary.failed} />
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <Panel className="xl:sticky xl:bottom-0">
            <Button
              className="w-full"
              variant={needsConfirm ? 'danger' : 'primary'}
              disabled={job.active}
              onClick={() => void run()}
              icon={needsConfirm ? <AlertTriangle size={16} strokeWidth={1.75} /> : actionIcon}
            >
              {actionLabel}
            </Button>
          </Panel>
        </div>

      <LogConsole onCancel={() => void window.api.cancelJob()} />
    </div>
  )
}
