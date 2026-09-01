import { existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { BackupJobInput, RestoreJobInput } from '../shared/types'
import {
  LogFn,
  ProcessController,
  logLine,
  readCommandOutput
} from './process'

function assertSafeDbName(db: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(db)) {
    throw new Error(`Unsafe database name rejected: ${db}`)
  }
}

function resolvePassword(inputPassword: string): string {
  const fromInput = inputPassword.trim()
  if (fromInput) return fromInput
  const fromEnv = process.env.PGPASSWORD?.trim()
  if (fromEnv) return fromEnv
  return ''
}

function requirePassword(inputPassword: string, context: string): string {
  const password = resolvePassword(inputPassword)
  if (!password) {
    throw new Error(
      `Password required for ${context}. Enter it in the form or launch the app with PGPASSWORD set (same as manage-databases.sh).`
    )
  }
  return password
}

function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /password authentication failed|authentication failed/i.test(message)
}

function pgEnv(password: string, host: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: password }
  const h = host.trim().toLowerCase()
  const isLocal = h === 'localhost' || h === '127.0.0.1' || h.startsWith('127.')
  // AWS RDS and most remote Postgres require TLS (pg_hba "no encryption" otherwise).
  if (!isLocal) {
    env.PGSSLMODE = 'require'
  }
  return env
}

function dumpPath(backupDir: string, db: string, format: 'plain' | 'custom'): string {
  return join(backupDir, format === 'custom' ? `${db}.dump` : `${db}.sql`)
}

function resolveDumpFile(backupDir: string, db: string): string | null {
  const sql = join(backupDir, `${db}.sql`)
  const custom = join(backupDir, `${db}.dump`)
  if (existsSync(sql)) return sql
  if (existsSync(custom)) return custom
  return null
}

function isCustomDump(filePath: string): boolean {
  if (filePath.endsWith('.dump')) return true
  if (filePath.endsWith('.sql')) return false
  // Fallback: check magic via `file` when available
  return false
}

async function detectCustomDump(filePath: string): Promise<boolean> {
  if (filePath.endsWith('.dump')) return true
  if (filePath.endsWith('.sql')) return false
  try {
    const out = await readCommandOutput('file', ['-b', filePath])
    return /PostgreSQL custom database dump/i.test(out)
  } catch {
    return isCustomDump(filePath)
  }
}

export function buildBackupPreview(input: BackupJobInput): string {
  const dbs = input.databases.length ? input.databases.join(',') : '(all)'
  return [
    'backup',
    `-H ${input.host}`,
    `-P ${input.port}`,
    `-U ${input.user}`,
    '-W ***',
    `-d ${input.backupDir}`,
    `-F ${input.format}`,
    `-D ${dbs}`,
    input.dryRun ? '--dry-run' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildRestorePreview(input: RestoreJobInput): string {
  const dbs = input.databases.length ? input.databases.join(',') : '(all)'
  return [
    'restore',
    `-H ${input.host}`,
    `-P ${input.port}`,
    `-U ${input.user}`,
    '-W ***',
    `-d ${input.backupDir}`,
    `-a ${input.adminDb}`,
    `-D ${dbs}`,
    input.recreate ? '--recreate' : '',
    input.dropOnly ? '--drop-only' : '',
    input.dryRun ? '--dry-run' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

export async function runBackup(
  input: BackupJobInput,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  const emit = (message: string) => onLog('stdout', logLine(message))
  const password = requirePassword(input.password, 'backup')
  const job: BackupJobInput = { ...input, password }

  if (!job.backupDir.trim()) {
    throw new Error('Backup directory is required.')
  }
  if (job.databases.length === 0) {
    throw new Error('Select at least one database.')
  }
  if (job.format !== 'plain' && job.format !== 'custom') {
    throw new Error(`Invalid format: ${job.format}`)
  }

  for (const db of job.databases) assertSafeDbName(db)

  if (!job.dryRun) {
    mkdirSync(job.backupDir, { recursive: true })
  }

  emit(`Mode=backup Host=${job.host} Port=${job.port} User=${job.user}`)
  emit(`BackupDir=${job.backupDir} Format=${job.format} DryRun=${job.dryRun}`)
  emit(
    input.password.trim()
      ? 'Password source: form'
      : 'Password source: PGPASSWORD environment'
  )

  const env = pgEnv(job.password, job.host)

  for (const db of job.databases) {
    controller.assertNotCancelled()
    const outFile = dumpPath(job.backupDir, db, job.format)
    emit(`Backing up '${db}' -> '${outFile}'`)

    const args = [
      '-h',
      job.host,
      '-p',
      job.port,
      '-U',
      job.user,
      '-d',
      db,
      '-f',
      outFile,
      '--no-password',
      `--format=${job.format}`
    ]

    try {
      await controller.run('pg_dump', args, {
        env,
        dryRun: job.dryRun,
        onLog
      })
    } catch (err) {
      if (isAuthError(err)) {
        throw new Error(
          'PostgreSQL authentication failed. Use the same RDS password as manage-databases.sh (form field or PGPASSWORD when launching the app).'
        )
      }
      throw err
    }
  }

  emit('Done.')
}

async function databaseExists(
  input: RestoreJobInput,
  db: string
): Promise<boolean> {
  assertSafeDbName(db)
  assertSafeDbName(input.adminDb)
  const env = pgEnv(input.password, input.host)
  const sql = `SELECT 1 FROM pg_database WHERE datname='${db}';`
  const out = await readCommandOutput(
    'psql',
    [
      '-h',
      input.host,
      '-p',
      input.port,
      '-U',
      input.user,
      '-d',
      input.adminDb,
      '-tAc',
      sql
    ],
    env
  )
  return out.trim() === '1'
}

async function dropDbIfExists(
  input: RestoreJobInput,
  db: string,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  assertSafeDbName(db)
  assertSafeDbName(input.adminDb)
  onLog('stdout', logLine(`Dropping database '${db}' if exists...`))
  await controller.run(
    'psql',
    [
      '-h',
      input.host,
      '-p',
      input.port,
      '-U',
      input.user,
      '-d',
      input.adminDb,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE IF EXISTS "${db}" WITH (FORCE);`
    ],
    { env: pgEnv(input.password, input.host), dryRun: input.dryRun, onLog }
  )
}

async function createDbIfMissing(
  input: RestoreJobInput,
  db: string,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  assertSafeDbName(db)
  assertSafeDbName(input.adminDb)

  // Match manage-databases.sh: check existence even during dry-run (real psql query).
  if (!input.dryRun) {
    const exists = await databaseExists(input, db)
    if (exists) {
      onLog('stdout', logLine(`Database '${db}' already exists.`))
      return
    }
  } else {
    try {
      const exists = await databaseExists(input, db)
      if (exists) {
        onLog('stdout', logLine(`Database '${db}' already exists.`))
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Dry-run connectivity check failed for '${db}': ${message}`
      )
    }
  }

  onLog('stdout', logLine(`Creating database '${db}'...`))
  await controller.run(
    'psql',
    [
      '-h',
      input.host,
      '-p',
      input.port,
      '-U',
      input.user,
      '-d',
      input.adminDb,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `CREATE DATABASE "${db}";`
    ],
    { env: pgEnv(input.password, input.host), dryRun: input.dryRun, onLog }
  )
}

async function restoreOne(
  input: RestoreJobInput,
  db: string,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  assertSafeDbName(db)
  const dumpFile = resolveDumpFile(input.backupDir, db)
  if (!dumpFile) {
    onLog(
      'stdout',
      logLine(
        `SKIP: no dump file for '${db}' in ${input.backupDir} (<db>.sql or <db>.dump)`
      )
    )
    return
  }

  if (!input.dryRun) {
    const size = statSync(dumpFile).size
    if (size === 0) {
      onLog('stdout', logLine(`SKIP: dump file is empty for '${db}': ${dumpFile}`))
      return
    }
  }

  const custom = await detectCustomDump(dumpFile)
  onLog(
    'stdout',
    logLine(
      `Restoring '${db}' from '${dumpFile}' (${custom ? 'custom dump' : 'plain SQL'})`
    )
  )

  if (custom) {
    await controller.run(
      'pg_restore',
      [
        '--no-owner',
        '--no-acl',
        '-h',
        input.host,
        '-p',
        input.port,
        '-U',
        input.user,
        '-d',
        db,
        dumpFile
      ],
      { env: pgEnv(input.password, input.host), dryRun: input.dryRun, onLog }
    )
  } else {
    await controller.run(
      'psql',
      [
        '-h',
        input.host,
        '-p',
        input.port,
        '-U',
        input.user,
        '-d',
        db,
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        dumpFile
      ],
      { env: pgEnv(input.password, input.host), dryRun: input.dryRun, onLog }
    )
  }
}

export async function runRestore(
  input: RestoreJobInput,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  const emit = (message: string) => onLog('stdout', logLine(message))
  const password = requirePassword(input.password, 'restore')
  const job: RestoreJobInput = { ...input, password }

  if (job.databases.length === 0) {
    throw new Error('Select at least one database.')
  }
  for (const db of job.databases) assertSafeDbName(db)
  assertSafeDbName(job.adminDb)

  if (!job.dropOnly) {
    if (!job.backupDir.trim()) {
      throw new Error('Backup directory is required.')
    }
    if (!existsSync(job.backupDir)) {
      throw new Error(`Backup directory does not exist: ${job.backupDir}`)
    }
  }

  emit(
    `Mode=restore Host=${job.host} Port=${job.port} User=${job.user} AdminDB=${job.adminDb}`
  )
  emit(
    input.password.trim()
      ? 'Password source: form'
      : 'Password source: PGPASSWORD environment'
  )
  if (job.dropOnly) {
    emit('DropOnly=true (no restore)')
  } else {
    emit(`BackupDir=${job.backupDir}`)
  }
  emit(
    `Recreate=${job.recreate} DropOnly=${job.dropOnly} DryRun=${job.dryRun}`
  )

  for (const db of job.databases) {
    controller.assertNotCancelled()

    if (job.dropOnly) {
      await dropDbIfExists(job, db, controller, onLog)
      continue
    }
    if (job.recreate) {
      await dropDbIfExists(job, db, controller, onLog)
    }
    await createDbIfMissing(job, db, controller, onLog)
    await restoreOne(job, db, controller, onLog)
  }

  emit('Done.')
}
