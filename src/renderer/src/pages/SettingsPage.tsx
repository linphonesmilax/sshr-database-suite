import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Settings } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  Alert,
  Button,
  Field,
  InputActionRow,
  PageHeader,
  Panel,
  SectionLabel,
  TextInput
} from '../components/ui'

export default function SettingsPage() {
  const { settings, updateSettings, refreshReadiness, job, readiness } = useApp()
  const [root, setRoot] = useState('')
  const [backupDir, setBackupDir] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settings) return
    setRoot(settings.microserviceRoot)
    setBackupDir(settings.lastBackupDir)
  }, [settings])

  const dirty = useMemo(() => {
    if (!settings) return false
    return root !== settings.microserviceRoot || backupDir !== settings.lastBackupDir
  }, [settings, root, backupDir])

  const pickRoot = async () => {
    const dir = await window.api.pickDir('Select sshr-microservice root')
    if (dir) setRoot(dir)
  }

  const pickBackup = async () => {
    const dir = await window.api.pickDir('Select backup directory')
    if (dir) setBackupDir(dir)
  }

  const save = async () => {
    setError(null)
    setMessage(null)
    if (
      settings &&
      root !== settings.microserviceRoot &&
      !window.confirm(
        'Changing the microservice root affects migrate targets. Continue?'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const next = await updateSettings({
        microserviceRoot: root,
        lastBackupDir: backupDir
      })
      await refreshReadiness(next.lastBackupDir)
      setMessage('Settings saved.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const openPath = async (target: string) => {
    if (!target.trim()) return
    const result = await window.api.openPath(target)
    if (result) setError(result)
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Migrate, backup, and restore run in Electron. Microservice root is only the Prisma migrate target."
        icon={<Settings size={28} strokeWidth={1.75} />}
        actions={
          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="text-xs text-[var(--warn)]">Unsaved changes</span>
            ) : null}
            <Button disabled={job.active || !dirty} loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-5">
        <Panel>
          <SectionLabel>This project</SectionLabel>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Project root</dt>
              <dd className="font-mono text-xs break-all">{readiness?.projectRoot ?? '—'}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <Button
              variant="secondary"
              disabled={!readiness?.projectRoot}
              onClick={() => readiness?.projectRoot && void openPath(readiness.projectRoot)}
              icon={<FolderOpen size={16} strokeWidth={1.75} />}
            >
              Open project
            </Button>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Microservice root (migrate target)</SectionLabel>
          <Field label="Path" hint="Default: ~/Documents/smilax/sshr-microservice">
            <InputActionRow
              actions={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void pickRoot()}
                    icon={<FolderOpen size={16} strokeWidth={1.75} />}
                  >
                    Browse
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!root.trim()}
                    onClick={() => void openPath(root)}
                    icon={<FolderOpen size={16} strokeWidth={1.75} />}
                  >
                    Open
                  </Button>
                </>
              }
            >
              <TextInput value={root} onChange={(e) => setRoot(e.target.value)} />
            </InputActionRow>
          </Field>
        </Panel>

        <Panel>
          <SectionLabel>Backup directory</SectionLabel>
          <Field label="Path" hint="Default: project db_backups/ (dev) or Documents/SSHR Database Suite/db_backups (installed app)">
            <InputActionRow
              actions={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void pickBackup()}
                    icon={<FolderOpen size={16} strokeWidth={1.75} />}
                  >
                    Browse
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!backupDir.trim()}
                    onClick={() => void openPath(backupDir)}
                    icon={<FolderOpen size={16} strokeWidth={1.75} />}
                  >
                    Open
                  </Button>
                </>
              }
            >
              <TextInput value={backupDir} onChange={(e) => setBackupDir(e.target.value)} />
            </InputActionRow>
          </Field>
        </Panel>

        {message ? <Alert variant="success">{message}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        <Panel>
          <SectionLabel>Notes</SectionLabel>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
            <li>
              Backup/restore call <code>pg_dump</code> / <code>psql</code> / <code>pg_restore</code>{' '}
              directly. Migrate calls <code>pnpm</code> + Prisma in each service directory.
            </li>
            <li>Passwords are never written to settings.json.</li>
            <li>Connection hosts/ports/users and paths are remembered between sessions.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
