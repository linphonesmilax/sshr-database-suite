import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { AppSettings, JobInput, ReadinessReport } from '../shared/types'
import { loadSettings, saveSettings } from './settings'
import { scanReadiness } from './readiness'
import { cancelActiveJob, runJob } from './jobs'
import { bootstrapCliPath } from './process'
import { getAppIconPath } from './paths'
import { initAutoUpdater } from './updater'

// Linux userland / restricted environments often lack a working chrome-sandbox.
app.commandLine.appendSwitch('no-sandbox')
if (process.env.SSHR_DB_SUITE_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    show: false,
    title: 'SSHR Database Suite',
    backgroundColor: '#0f1c1f',
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:set', (_event, partial: Partial<AppSettings>) => {
    return saveSettings(partial)
  })

  ipcMain.handle(
    'readiness:scan',
    async (_event, backupDir?: string): Promise<ReadinessReport> => {
      const settings = loadSettings()
      return scanReadiness(settings, backupDir ?? settings.lastBackupDir)
    }
  )

  ipcMain.handle('dialog:pickDir', async (_event, title?: string) => {
    const result = await dialog.showOpenDialog({
      title: title ?? 'Select folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
    if (!existsSync(targetPath)) return `Path does not exist: ${targetPath}`
    return shell.openPath(targetPath)
  })

  ipcMain.handle('job:run', async (event, input: JobInput) => {
    const settings = loadSettings()
    const sender = event.sender
    return runJob(settings, input, {
      onStarted: (payload) => sender.send('job:started', payload),
      onLog: (payload) => sender.send('job:log', payload),
      onEnded: (payload) => sender.send('job:ended', payload)
    })
  })

  ipcMain.handle('job:cancel', async () => cancelActiveJob())
}

app.whenReady().then(() => {
  // AppImage / .desktop launches omit nvm+pnpm; expand PATH before any CLI checks.
  bootstrapCliPath()
  registerIpc()
  createWindow()
  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
