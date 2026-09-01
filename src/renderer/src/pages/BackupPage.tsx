import { CheckCircle2, Play, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  TextSelect,
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

export default function BackupPage() {
  const { settings, updateSettings, job, refreshReadiness } = useApp()
  const [host, setHost] = useState<string>(PRESETS.cloudBackup.host)
  const [port, setPort] = useState<string>(PRESETS.cloudBackup.port)
  const [user, setUser] = useState<string>(PRESETS.cloudBackup.user)
  const [password, setPassword] = useState('')
  const [backupDir, setBackupDir] = useState('')
  const [format, setFormat] = useState<'plain' | 'custom'>('plain')
  const [selected, setSelected] = useState<string[]>([...DATABASES])
  const [dryRun, setDryRun] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ backupDir?: string }>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passwordSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!settings) return
    setHost(settings.lastBackupHost)
    setPort(settings.lastBackupPort)
    setUser(settings.lastBackupUser)
    setBackupDir(settings.lastBackupDir)
    setFormat(settings.lastBackupFormat)
  }, [settings])

  useEffect(() => {
    void window.api.getBackupPassword().then((saved) => {
      if (saved) setPassword(saved)
    })
  }, [])

  useEffect(() => {
    if (!backupDir.trim()) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void refreshReadiness(backupDir)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [backupDir, refreshReadiness])

  const applyCloudPreset = () => {
    setHost(PRESETS.cloudBackup.host)
    setPort(PRESETS.cloudBackup.port)
    setUser(PRESETS.cloudBackup.user)
  }

  const preview = useMemo(() => {
    const parts = [
      'backup',
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
      '-F',
      format
    ]
    for (const db of selected) {
      parts.push('-D', db)
    }
    if (dryRun) parts.push('--dry-run')
    return parts.join(' ')
  }, [host, port, user, backupDir, format, selected, dryRun])

  const summary = useMemo(
    () => parseJobHeadline('backup', job.lines.map((l) => l.line)),
    [job.lines]
  )

  const pickDir = async () => {
    const dir = await window.api.pickDir('Select backup output directory')
    if (dir) {
      setBackupDir(dir)
      await updateSettings({ lastBackupDir: dir })
      await refreshReadiness(dir)
    }
  }

  const run = async () => {
    setError(null)
    const nextFieldErrors: { backupDir?: string } = {}
    if (!backupDir.trim()) {
      nextFieldErrors.backupDir = 'Backup directory is required.'
    }
    if (selected.length === 0) {
      setError('Select at least one database.')
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0 || selected.length === 0) return

    await updateSettings({
      lastBackupHost: host,
      lastBackupPort: port,
      lastBackupUser: user,
      lastBackupDir: backupDir,
      lastBackupFormat: format
    })
    await window.api.setBackupPassword(password)
    try {
      await window.api.runJob({
        kind: 'backup',
        host,
        port,
        user,
        password,
        backupDir,
        format,
        databases: selected,
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
          title="Backup"
          subtitle="Dump SSHR PostgreSQL databases with pg_dump (Cloud RDS preset available)."
          actions={
            <Button
              disabled={job.active}
              onClick={() => void run()}
              icon={<Play size={16} strokeWidth={1.75} />}
            >
              {dryRun ? 'Dry run' : 'Run backup'}
            </Button>
          }
        />

          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel className="mb-0">Connection</SectionLabel>
              <Button variant="ghost" onClick={applyCloudPreset}>
                Apply {PRESETS.cloudBackup.label} preset
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
                hint="Saved on this device. Must match manage-databases.sh (or PGPASSWORD). Leave empty only if you launched the app with PGPASSWORD set."
              >
                <PasswordInput
                  value={password}
                  onChange={(e) => {
                    const next = e.target.value
                    setPassword(next)
                    if (passwordSaveRef.current) clearTimeout(passwordSaveRef.current)
                    passwordSaveRef.current = setTimeout(() => {
                      void window.api.setBackupPassword(next)
                    }, 400)
                  }}
                  autoComplete="off"
                />
              </Field>
            </div>
          </Panel>

          <Panel>
            <SectionLabel>Output</SectionLabel>
            <div className="grid gap-3">
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
                      if (fieldErrors.backupDir) setFieldErrors({})
                    }}
                    error={Boolean(fieldErrors.backupDir)}
                  />
                </InputActionRow>
              </Field>
              <Field label="Format">
                <TextSelect
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'plain' | 'custom')}
                >
                  <option value="plain">plain (.sql)</option>
                  <option value="custom">custom (.dump)</option>
                </TextSelect>
              </Field>
            </div>
            <div className="mt-3">
              <CheckboxRow checked={dryRun} onChange={setDryRun} label="Dry run" />
            </div>
          </Panel>

          <DatabasePicker selected={selected} onChange={setSelected} />
          <CommandPreview command={preview} />

          {!job.active && (summary.ok.length || summary.failed.length) ? (
            <JobSummaryPanel ok={summary.ok} skipped={summary.skipped} failed={summary.failed} />
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <Panel className="xl:sticky xl:bottom-0">
            <Button
              className="w-full"
              disabled={job.active}
              onClick={() => void run()}
              icon={<Play size={16} strokeWidth={1.75} />}
            >
              {dryRun ? 'Dry run' : 'Run backup'}
            </Button>
          </Panel>
        </div>

      <LogConsole onCancel={() => void window.api.cancelJob()} />
    </div>
  )
}
