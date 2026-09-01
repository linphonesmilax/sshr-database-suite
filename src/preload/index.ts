import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  JobEndedEvent,
  JobInput,
  JobLogEvent,
  JobStartedEvent,
  ReadinessReport
} from '../shared/types'

export type Unsubscribe = () => void

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', partial),
  scanReadiness: (backupDir?: string): Promise<ReadinessReport> =>
    ipcRenderer.invoke('readiness:scan', backupDir),
  pickDir: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickDir', title),
  openPath: (targetPath: string): Promise<string> =>
    ipcRenderer.invoke('shell:openPath', targetPath),
  runJob: (
    input: JobInput
  ): Promise<{ id: string; commandPreview: string }> =>
    ipcRenderer.invoke('job:run', input),
  cancelJob: (): Promise<boolean> => ipcRenderer.invoke('job:cancel'),
  onJobStarted: (handler: (event: JobStartedEvent) => void): Unsubscribe => {
    const listener = (_: Electron.IpcRendererEvent, payload: JobStartedEvent) =>
      handler(payload)
    ipcRenderer.on('job:started', listener)
    return () => ipcRenderer.removeListener('job:started', listener)
  },
  onJobLog: (handler: (event: JobLogEvent) => void): Unsubscribe => {
    const listener = (_: Electron.IpcRendererEvent, payload: JobLogEvent) =>
      handler(payload)
    ipcRenderer.on('job:log', listener)
    return () => ipcRenderer.removeListener('job:log', listener)
  },
  onJobEnded: (handler: (event: JobEndedEvent) => void): Unsubscribe => {
    const listener = (_: Electron.IpcRendererEvent, payload: JobEndedEvent) =>
      handler(payload)
    ipcRenderer.on('job:ended', listener)
    return () => ipcRenderer.removeListener('job:ended', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
