import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'fs'
import { join } from 'path'

interface SecretStore {
  backupPassword?: string
}

function secretsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'secrets.json')
}

function readStore(): SecretStore {
  try {
    return JSON.parse(readFileSync(secretsPath(), 'utf8')) as SecretStore
  } catch {
    return {}
  }
}

function writeStore(store: SecretStore): void {
  const path = secretsPath()
  if (!store.backupPassword) {
    if (existsSync(path)) unlinkSync(path)
    return
  }
  writeFileSync(path, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(path, 0o600)
  } catch {
    /* ignore */
  }
}

function encrypt(plain: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(plain).toString('base64')}`
  }
  return `raw:${Buffer.from(plain, 'utf8').toString('base64')}`
}

function decrypt(stored: string): string {
  if (stored.startsWith('enc:')) {
    return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
  }
  if (stored.startsWith('raw:')) {
    return Buffer.from(stored.slice(4), 'base64').toString('utf8')
  }
  return stored
}

export function getBackupPassword(): string {
  const stored = readStore().backupPassword
  if (!stored) return ''
  try {
    return decrypt(stored)
  } catch {
    return ''
  }
}

export function setBackupPassword(password: string): void {
  const trimmed = password
  if (!trimmed) {
    writeStore({})
    return
  }
  writeStore({ backupPassword: encrypt(trimmed) })
}
