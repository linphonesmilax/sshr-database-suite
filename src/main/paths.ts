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

/** Window / taskbar icon. Packaged extraResources, otherwise repo `build/icon.png`. */
export function getAppIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath, 'icon.png'),
    join(getProjectRoot(), 'build', 'icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  return candidates.find((p) => existsSync(p))
}

/** Dev: project db_backups/. Packaged: ~/Documents/SSHR Database Suite/db_backups */
export function getDefaultBackupDir(): string {
  if (app.isPackaged) {
    return join(app.getPath('documents'), PACKAGED_BACKUP_REL)
  }
  return join(getProjectRoot(), 'db_backups')
}
