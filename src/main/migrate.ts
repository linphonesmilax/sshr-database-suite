import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { SERVICES, MigrateJobInput } from '../shared/types'
import {
  JobCancelledError,
  LogFn,
  ProcessController,
  commandExists,
  logLine
} from './process'

interface PackageJson {
  scripts?: Record<string, string>
}

function hasNpmScript(serviceDir: string, scriptName: string): boolean {
  const pkgPath = join(serviceDir, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson
    return Boolean(pkg.scripts?.[scriptName])
  } catch {
    return false
  }
}

/** Match bash filter: exact, `${filter}-service`, or substring. */
export function resolveServices(filters: string[]): string[] {
  if (filters.length === 0) return [...SERVICES]

  const resolved: string[] = []
  const seen = new Set<string>()

  for (const filter of filters) {
    let matched = false
    for (const svc of SERVICES) {
      if (
        svc === filter ||
        svc === `${filter}-service` ||
        svc.includes(filter)
      ) {
        if (!seen.has(svc)) {
          seen.add(svc)
          resolved.push(svc)
        }
        matched = true
      }
    }
    if (!matched) {
      throw new Error(
        `Unknown service filter: ${filter}\nKnown: ${SERVICES.join(' ')}`
      )
    }
  }

  return resolved
}

function modeFlags(mode: MigrateJobInput['mode']): {
  deployOnly: boolean
  generateOnly: boolean
} {
  return {
    deployOnly: mode === 'deploy-only',
    generateOnly: mode === 'generate-only'
  }
}

export function buildMigratePreview(
  root: string,
  input: MigrateJobInput
): string {
  const parts = [`migrate --root ${root}`]
  if (input.dryRun) parts.push('--dry-run')
  if (input.mode !== 'full') parts.push(`--${input.mode}`)
  if (input.services.length) parts.push(...input.services)
  else parts.push('(all services)')
  return parts.join(' ')
}

export async function runMigrate(
  root: string,
  input: MigrateJobInput,
  controller: ProcessController,
  onLog: LogFn
): Promise<void> {
  const emit = (stream: 'stdout' | 'stderr', message: string) => {
    onLog(stream, logLine(message))
  }

  if (!root.trim()) {
    throw new Error('Microservice root is required.')
  }
  if (!existsSync(root)) {
    throw new Error(`Microservice root does not exist: ${root}`)
  }

  const { deployOnly, generateOnly } = modeFlags(input.mode)
  if (deployOnly && generateOnly) {
    throw new Error('Cannot combine deploy-only and generate-only')
  }

  if (!(await commandExists('pnpm'))) {
    throw new Error(
      'pnpm was not found on PATH. Install pnpm, then fully quit and reopen this app (desktop launches often miss nvm/pnpm).'
    )
  }
  if (!(await commandExists('node'))) {
    throw new Error(
      'node was not found on PATH. Install Node.js 20+, then fully quit and reopen this app.'
    )
  }

  const services = resolveServices(input.services)
  const ok: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  emit('stdout', `Microservice root: ${root}`)
  emit('stdout', `Mode: ${input.mode}${input.dryRun ? ' (dry-run)' : ''}`)

  for (const svc of services) {
    controller.assertNotCancelled()

    const dir = join(root, svc)
    if (!existsSync(dir)) {
      emit('stdout', `SKIP ${svc} — directory missing`)
      skipped.push(svc)
      continue
    }
    if (!existsSync(join(dir, 'prisma', 'schema.prisma'))) {
      emit('stdout', `SKIP ${svc} — no prisma/schema.prisma`)
      skipped.push(svc)
      continue
    }
    if (!existsSync(join(dir, '.env.local'))) {
      emit('stdout', `SKIP ${svc} — missing .env.local`)
      skipped.push(svc)
      continue
    }
    if (!existsSync(join(dir, 'node_modules'))) {
      emit('stdout', `SKIP ${svc} — missing node_modules (run pnpm install in the service)`)
      skipped.push(svc)
      continue
    }

    emit('stdout', `=== ${svc} ===`)
    try {
      if (!generateOnly) {
        emit('stdout', `${svc}: migrate deploy`)
        if (hasNpmScript(dir, 'local:migrate:deploy')) {
          await controller.run('pnpm', ['run', 'local:migrate:deploy'], {
            cwd: dir,
            dryRun: input.dryRun,
            onLog
          })
        } else {
          // Prefer local prisma binary (avoid npx). Same as bash fallback intent.
          await controller.run(
            'pnpm',
            ['exec', 'dotenv', '-e', '.env.local', '--', 'prisma', 'migrate', 'deploy'],
            { cwd: dir, dryRun: input.dryRun, onLog }
          )
        }
      }

      if (!deployOnly) {
        emit('stdout', `${svc}: prisma generate`)
        if (hasNpmScript(dir, 'local:generate')) {
          await controller.run('pnpm', ['run', 'local:generate'], {
            cwd: dir,
            dryRun: input.dryRun,
            onLog
          })
        } else {
          await controller.run(
            'pnpm',
            ['exec', 'dotenv', '-e', '.env.local', '--', 'prisma', 'generate'],
            { cwd: dir, dryRun: input.dryRun, onLog }
          )
        }
      }

      ok.push(svc)
    } catch (err) {
      if (err instanceof JobCancelledError) throw err
      const message = err instanceof Error ? err.message : String(err)
      onLog('stderr', logLine(`${svc} failed: ${message}`))
      failed.push(svc)
    }
  }

  onLog('stdout', '')
  emit('stdout', `OK:      ${ok.length ? ok.join(' ') : '(none)'}`)
  emit('stdout', `SKIPPED: ${skipped.length ? skipped.join(' ') : '(none)'}`)
  emit('stdout', `FAILED:  ${failed.length ? failed.join(' ') : '(none)'}`)

  if (failed.length > 0) {
    throw new Error(`Migrate finished with failures: ${failed.join(', ')}`)
  }
}
