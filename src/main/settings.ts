import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { AppSettings, defaultSettings } from '../shared/types'
import { getDefaultBackupDir } from './paths'

function settingsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

function stripLegacy(partial: Partial<AppSettings> & Record<string, unknown>): Partial<AppSettings> {
  const {
    migrateScript: _m,
    manageScript: _n,
    ...rest
  } = partial as Partial<AppSettings> & {
    migrateScript?: string
    manageScript?: string
  }
  return rest
}

export function loadSettings(): AppSettings {
  const defaults = defaultSettings(homedir(), getDefaultBackupDir())
  try {
    const raw = readFileSync(settingsPath(), 'utf8')
    const parsed = stripLegacy(JSON.parse(raw) as Partial<AppSettings> & Record<string, unknown>)
    // Prefer project-local backups when user still points at microservice db_backups from older installs
    const merged = { ...defaults, ...parsed }
    if (
      !parsed.lastBackupDir ||
      parsed.lastBackupDir.endsWith('/sshr-microservice/db_backups')
    ) {
      merged.lastBackupDir = defaults.lastBackupDir
    }
    return merged
  } catch {
    return defaults
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...stripLegacy(partial) }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
