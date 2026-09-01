import { app } from 'electron'
import { existsSync } from 'fs'
import { join, resolve } from 'path'

const PACKAGED_BACKUP_REL = join('SSHR Database Suite', 'db_backups')

/** Dev: project root. Packaged: per-user app data (settings, etc.). */
export function getProjectRoot(): string {
  if (app.isPackaged) {
    return app.getPath('userData')
  }

  const fromOut = resolve(__dirname, '../..')
  if (existsSync(join(fromOut, 'package.json'))) return fromOut

  const fromApp = app.getAppPath()
  if (existsSync(join(fromApp, 'package.json'))) return fromApp

  return fromOut
}

/** Dev: project db_backups/. Packaged: ~/Documents/SSHR Database Suite/db_backups */
export function getDefaultBackupDir(): string {
  if (app.isPackaged) {
    return join(app.getPath('documents'), PACKAGED_BACKUP_REL)
  }
  return join(getProjectRoot(), 'db_backups')
}
