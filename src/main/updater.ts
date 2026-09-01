import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

let started = false

function broadcast(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', status)
  }
}

function friendlyUpdateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (/404|releases\.atom|authentication token|Unable to find latest version/i.test(raw)) {
    return 'Could not check for updates. Publish a non-draft GitHub Release (Releases → Edit draft → Publish).'
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::/i.test(raw)) {
    return 'Could not check for updates. Check your internet connection.'
  }
  return 'Could not check for updates.'
}

/**
 * GitHub Releases auto-update (AppImage on Linux).
 * No-op in development; requires a published release with matching channel files.
 */
export function initAutoUpdater(): void {
  if (started) return
  started = true

  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      const status: UpdateStatus = {
        phase: 'not-available',
        message: 'Updates only run in the installed app.'
      }
      broadcast(status)
      return status
    }
    try {
      broadcast({ phase: 'checking' })
      const result = await autoUpdater.checkForUpdates()
      return {
        phase: 'checking',
        version: result?.updateInfo?.version
      } satisfies UpdateStatus
    } catch (err) {
      const status: UpdateStatus = { phase: 'error', message: friendlyUpdateError(err) }
      broadcast(status)
      return status
    }
  })

  ipcMain.handle('update:install', () => {
    if (!app.isPackaged) return false
    // isSilent=false, isForceRunAfter=true
    autoUpdater.quitAndInstall(false, true)
    return true
  })

  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Public repo: no token. Private repo: set GH_TOKEN / GITHUB_TOKEN in the environment.
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => {
    broadcast({ phase: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({
      phase: 'available',
      version: info.version,
      message: `Version ${info.version} is available.`
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast({
      phase: 'not-available',
      version: info.version,
      message: 'You are up to date.'
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      phase: 'downloading',
      percent: Math.round(progress.percent),
      message: `Downloading update… ${Math.round(progress.percent)}%`
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({
      phase: 'ready',
      version: info.version,
      message: `Update ${info.version} is ready. Restart to install.`
    })
  })

  autoUpdater.on('error', (err) => {
    broadcast({
      phase: 'error',
      message: friendlyUpdateError(err)
    })
  })

  // Delay so the window can subscribe first.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      broadcast({ phase: 'error', message: friendlyUpdateError(err) })
    })
  }, 4000)
}
