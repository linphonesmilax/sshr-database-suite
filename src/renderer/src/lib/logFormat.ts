export type LogLineKind =
  | 'meta'
  | 'command'
  | 'dry-run'
  | 'error'
  | 'warn'
  | 'success'
  | 'noise'
  | 'output'

export interface ParsedLogLine {
  index: number
  stream: 'stdout' | 'stderr'
  raw: string
  kind: LogLineKind
  time?: string
  message: string
}

const META_RE = /^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/

const NOISE_PATTERNS = [
  /^SET$/i,
  /^set_config$/i,
  /^\(\d+ row\)$/,
  /^-+$/,
  /^$/
]

export function parseLogLine(
  index: number,
  stream: 'stdout' | 'stderr',
  raw: string
): ParsedLogLine {
  const trimmed = raw.trimEnd()

  if (stream === 'stderr' || isErrorLine(trimmed)) {
    return { index, stream, raw: trimmed, kind: 'error', message: trimmed }
  }

  const meta = trimmed.match(META_RE)
  if (meta) {
    const message = meta[2]
    return {
      index,
      stream,
      raw: trimmed,
      kind: classifyMetaMessage(message),
      time: meta[1],
      message
    }
  }

  if (trimmed.startsWith('> ')) {
    return {
      index,
      stream,
      raw: trimmed,
      kind: 'command',
      message: trimmed.slice(2).trim()
    }
  }

  if (trimmed.startsWith('DRY-RUN:')) {
    return {
      index,
      stream,
      raw: trimmed,
      kind: 'dry-run',
      message: trimmed.slice('DRY-RUN:'.length).trim()
    }
  }

  if (NOISE_PATTERNS.some((re) => re.test(trimmed))) {
    return { index, stream, raw: trimmed, kind: 'noise', message: trimmed }
  }

  return { index, stream, raw: trimmed, kind: 'output', message: trimmed }
}

function isErrorLine(line: string): boolean {
  return (
    /ERROR:/i.test(line) ||
    /FATAL:/i.test(line) ||
    /Command failed/i.test(line) ||
    /authentication failed/i.test(line) ||
    /^\[cancelled\]/i.test(line)
  )
}

function classifyMetaMessage(message: string): LogLineKind {
  if (message.startsWith('> ')) return 'command'
  if (message.startsWith('DRY-RUN:')) return 'dry-run'
  if (/^Done\.$|^OK:|^=== /.test(message)) return 'success'
  if (/SKIP|WARN/i.test(message)) return 'warn'
  if (/FAILED/i.test(message)) return 'error'
  return 'meta'
}

export function extractActionableErrors(lines: ParsedLogLine[]): string[] {
  const errors: string[] = []
  for (const line of lines) {
    if (line.kind !== 'error') continue
    const msg = line.message
    if (/^Command failed/i.test(msg)) continue
    if (/^npm warn/i.test(msg)) continue
    if (/^warn The configuration property/i.test(msg)) continue
    errors.push(msg)
  }
  return errors
}

export function suggestFix(errors: string[], kind: string | null): string | null {
  const blob = errors.join('\n')
  if (/already exists/i.test(blob)) {
    if (kind === 'restore') {
      return 'The target database already has schema/data. Turn on Recreate (and type RECREATE) to drop and restore fresh.'
    }
    return 'An object already exists. You may need to drop or recreate the target first.'
  }
  if (/authentication failed/i.test(blob)) {
    return 'Check the password matches manage-databases.sh / PGPASSWORD.'
  }
  if (/no encryption|SSL/i.test(blob)) {
    return 'Remote PostgreSQL may require SSL. The app sets PGSSLMODE=require for non-local hosts.'
  }
  if (/could not connect|Connection refused/i.test(blob)) {
    return 'PostgreSQL may not be running on that host/port.'
  }
  return null
}

export function countHiddenNoise(lines: ParsedLogLine[]): number {
  return lines.filter((l) => l.kind === 'noise').length
}

/** Turn psql/pg_dump errors into plain language. */
export function humanizeError(raw: string): string {
  const pgError = raw.match(/ERROR:\s*(.+)$/i)
  if (pgError) return capitalize(pgError[1].trim())

  if (/P1001|Can't reach database server/i.test(raw)) {
    return 'Could not reach the database server (is Postgres running on that host/port?).'
  }
  if (/authentication failed/i.test(raw)) {
    return 'The database password was not accepted.'
  }
  if (/Connection refused/i.test(raw)) {
    return 'Could not connect — is PostgreSQL running on that port?'
  }
  if (/no encryption/i.test(raw)) {
    return 'The server requires a secure (encrypted) connection.'
  }
  if (/Dry-run connectivity check failed/i.test(raw)) {
    return 'Could not reach the database to run the preview.'
  }

  return raw.replace(/^psql:[^:]+:\d+:\s*/i, '').trim() || raw
}

function capitalize(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Latest human-readable step while a job is running. */
export function latestActivity(lines: ParsedLogLine[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (line.kind === 'error') continue
    if (line.kind === 'noise' || line.kind === 'output') continue

    const msg = line.message
      .replace(/^DRY-RUN:\s*/i, '')
      .replace(/^> /, '')

    if (/^Done\.$/.test(msg)) return 'Finishing up…'
    if (/^Backing up '/.test(msg)) {
      const db = msg.match(/'([^']+)'/)?.[1]
      return db ? `Backing up ${db}…` : 'Backing up…'
    }
    if (/^Restoring '/.test(msg)) {
      const db = msg.match(/'([^']+)'/)?.[1]
      return db ? `Restoring ${db}…` : 'Restoring…'
    }
    if (/^Database '.*' already exists/.test(msg)) {
      const db = msg.match(/'([^']+)'/)?.[1]
      return db ? `${db} already exists` : 'Database already exists'
    }
    if (/^Creating database '/.test(msg)) {
      const db = msg.match(/'([^']+)'/)?.[1]
      return db ? `Creating ${db}…` : 'Creating database…'
    }
    if (/^=== .+ ===$/.test(msg)) {
      return msg.replace(/=== /g, '').replace(/ ===/g, '')
    }
    if (/^SKIP /.test(msg)) return msg.replace(/^SKIP /, 'Skipped: ')
    if (line.kind === 'meta' && msg.length < 120) return msg
  }
  return null
}

export interface FriendlySummary {
  headline: string
  detail: string | null
  activity: string | null
}

export function buildFriendlySummary(
  opts: {
    active: boolean
    cancelled: boolean
    exitCode: number | null
    kind: string | null
    isDryRun: boolean
    hasJob: boolean
  },
  lines: ParsedLogLine[]
): FriendlySummary {
  const activity = latestActivity(lines)
  const errors = extractActionableErrors(lines).map(humanizeError)

  if (!opts.hasJob) {
    return {
      headline: 'Ready',
      detail: 'Press Run to start. Technical output stays hidden unless you need it.',
      activity: null
    }
  }

  if (opts.active) {
    return {
      headline: opts.isDryRun ? 'Previewing…' : 'Working…',
      detail: activity,
      activity
    }
  }

  if (opts.cancelled) {
    return {
      headline: 'Stopped',
      detail: 'The job was cancelled before it finished.',
      activity: null
    }
  }

  if (opts.isDryRun && opts.exitCode === 0) {
    return {
      headline: 'Preview complete',
      detail: 'Nothing was changed. Turn off Dry run when you are ready to run for real.',
      activity: null
    }
  }

  if (opts.exitCode === 0) {
    const byKind: Record<string, string> = {
      backup: 'Backup finished. Your dump files are in the backup folder.',
      restore: 'Restore finished. You can run Migrate next if needed.',
      migrate: 'Migrate finished. Prisma clients were updated.'
    }
    return {
      headline: 'All done',
      detail: opts.kind ? (byKind[opts.kind] ?? 'Finished successfully.') : 'Finished successfully.',
      activity: null
    }
  }

  return {
    headline: 'Something went wrong',
    detail: errors[errors.length - 1] ?? 'The job did not complete. Try the suggestion below.',
    activity: null
  }
}

export function friendlyFixHint(errors: string[], kind: string | null): string | null {
  const blob = errors.join('\n')
  if (/Command not found: pnpm|pnpm was not found/i.test(blob)) {
    return 'Install pnpm (npm install -g pnpm), then fully quit and reopen this app so PATH includes it.'
  }
  if (/Command not found: node|node was not found/i.test(blob)) {
    return 'Install Node.js 20+, then fully quit and reopen this app.'
  }
  if (/P1001|Can't reach database server|Could not connect|Connection refused/i.test(blob)) {
    return kind === 'migrate'
      ? 'Postgres looks unreachable. Start the local stack (docker compose) so localhost:5433 accepts connections, then run migrate again.'
      : 'Make sure PostgreSQL is running and the host/port are correct (local restore usually uses port 5433).'
  }
  if (/already exists/i.test(blob)) {
    if (kind === 'restore') {
      return 'This database already has tables or types. Turn on Recreate databases, type RECREATE, and run again to replace it with the backup.'
    }
    return 'Something already exists at the destination. You may need to remove or recreate it first.'
  }
  if (/authentication failed|password was not accepted/i.test(blob)) {
    return 'Double-check the password. It must match what you use for the cloud database or local Postgres.'
  }
  if (/Could not connect/i.test(blob)) {
    return 'Make sure PostgreSQL is running and the host/port are correct (local restore usually uses port 5433).'
  }
  if (/secure \(encrypted\) connection/i.test(blob)) {
    return 'The cloud database needs a secure connection. Try again — the app should handle this automatically.'
  }
  return suggestFix(errors, kind)
}
