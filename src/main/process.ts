import { spawn, ChildProcess, execFile, execFileSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { delimiter, join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type LogFn = (stream: 'stdout' | 'stderr', line: string) => void

export class JobCancelledError extends Error {
  constructor() {
    super('Job cancelled')
    this.name = 'JobCancelledError'
  }
}

export class CommandFailedError extends Error {
  readonly code: number | null
  readonly signal: NodeJS.Signals | null

  constructor(command: string, code: number | null, signal: NodeJS.Signals | null) {
    super(
      signal
        ? `Command killed (${signal}): ${command}`
        : `Command failed (exit ${code ?? 'unknown'}): ${command}`
    )
    this.name = 'CommandFailedError'
    this.code = code
    this.signal = signal
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%=+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function formatCommand(cmd: string, args: string[]): string {
  return [cmd, ...args].map(shellQuote).join(' ')
}

export function nowStamp(): string {
  return new Date().toTimeString().slice(0, 8)
}

export function logLine(message: string): string {
  return `[${nowStamp()}] ${message}`
}

function compareNodeVersionDesc(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => Number(n) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => Number(n) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function collectExtraBinDirs(): string[] {
  const home = homedir()
  const candidates: Array<string | undefined> = [
    process.env.PNPM_HOME,
    join(home, '.local', 'share', 'pnpm'),
    join(home, '.local', 'bin'),
    join(home, '.volta', 'bin'),
    join(home, '.fnm', 'current', 'bin'),
    join(home, '.asdf', 'shims'),
    join(home, '.npm-global', 'bin'),
    '/usr/local/bin'
  ]

  const nvmDir = process.env.NVM_DIR || join(home, '.nvm')
  const versionsDir = join(nvmDir, 'versions', 'node')
  if (existsSync(versionsDir)) {
    try {
      const versions = readdirSync(versionsDir).sort(compareNodeVersionDesc)
      for (const version of versions) {
        candidates.push(join(versionsDir, version, 'bin'))
      }
    } catch {
      // ignore unreadable nvm dir
    }
  }

  const dirs: string[] = []
  const seen = new Set<string>()
  for (const dir of candidates) {
    if (!dir || seen.has(dir) || !existsSync(dir)) continue
    seen.add(dir)
    dirs.push(dir)
  }
  return dirs
}

function mergePath(extraDirs: string[], basePath: string): string {
  const parts = basePath.split(delimiter).filter(Boolean)
  const seen = new Set(parts)
  const prefix: string[] = []
  for (const dir of extraDirs) {
    if (seen.has(dir)) continue
    seen.add(dir)
    prefix.push(dir)
  }
  return [...prefix, ...parts].join(delimiter)
}

function whichSync(cmd: string, envPath: string): string | null {
  try {
    const stdout = execFileSync('which', [cmd], {
      encoding: 'utf8',
      env: { ...process.env, PATH: envPath },
      timeout: 5000
    })
    const resolved = String(stdout).trim()
    return resolved || null
  } catch {
    return null
  }
}

function loadLoginShellPath(): string | null {
  if (process.platform === 'win32') return null
  try {
    const shell = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/bash'
    const stdout = execFileSync(shell, ['-lc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 8000,
      env: process.env
    })
    return String(stdout).trim() || null
  } catch {
    return null
  }
}

let pathBootstrapped = false

/**
 * Desktop launches (AppImage / .desktop) often omit nvm/pnpm paths that
 * interactive shells have. Expand PATH once so migrate/backup CLIs resolve.
 */
export function bootstrapCliPath(): void {
  if (pathBootstrapped) return
  pathBootstrapped = true

  const extras = collectExtraBinDirs()
  let nextPath = mergePath(extras, process.env.PATH ?? '')

  if (!whichSync('pnpm', nextPath) || !whichSync('node', nextPath)) {
    const loginPath = loadLoginShellPath()
    if (loginPath) {
      nextPath = mergePath(extras, mergePath(loginPath.split(delimiter), nextPath))
    }
  }

  process.env.PATH = nextPath
}

/** Env for spawned CLI tools — strip Electron / parent package-manager noise. */
export function buildChildEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  bootstrapCliPath()
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra }

  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ASAR
  delete env.INIT_CWD

  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_')) {
      delete env[key]
      continue
    }
    if (key.startsWith('PNPM_') && key !== 'PNPM_HOME') {
      delete env[key]
    }
  }

  env.CI = env.CI || '1'
  env.PRISMA_HIDE_UPDATE_MESSAGE = '1'
  env.npm_config_update_notifier = 'false'
  return env
}

export async function resolveCommand(cmd: string): Promise<string> {
  bootstrapCliPath()
  if (cmd.includes('/') || cmd.includes('\\')) return cmd
  try {
    const { stdout } = await execFileAsync('which', [cmd], {
      env: buildChildEnv(),
      encoding: 'utf8'
    })
    const resolved = stdout.trim()
    return resolved || cmd
  } catch {
    return cmd
  }
}

function formatSpawnError(cmd: string, err: NodeJS.ErrnoException): Error {
  if (err.code === 'ENOENT') {
    return new Error(
      `Command not found: ${cmd}. Install it and restart the app. Desktop launches often miss tools installed via nvm/pnpm — open a terminal and run \`which ${cmd}\`.`
    )
  }
  return err
}

/** Track one cancellable child at a time for the active job. */
export class ProcessController {
  private child: ChildProcess | null = null
  private cancelled = false

  get isCancelled(): boolean {
    return this.cancelled
  }

  assertNotCancelled(): void {
    if (this.cancelled) throw new JobCancelledError()
  }

  cancel(): void {
    this.cancelled = true
    const child = this.child
    if (!child || child.killed) return

    if (process.platform !== 'win32' && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM')
        return
      } catch {
        // fall through
      }
    }
    child.kill('SIGTERM')

    setTimeout(() => {
      if (!child.killed && child.pid) {
        try {
          if (process.platform !== 'win32') {
            process.kill(-child.pid, 'SIGKILL')
          } else {
            child.kill('SIGKILL')
          }
        } catch {
          // already gone
        }
      }
    }, 3000)
  }

  async run(
    cmd: string,
    args: string[],
    options: {
      cwd?: string
      env?: NodeJS.ProcessEnv
      dryRun?: boolean
      onLog: LogFn
    }
  ): Promise<void> {
    this.assertNotCancelled()
    bootstrapCliPath()

    const resolved = await resolveCommand(cmd)
    const preview = formatCommand(resolved === cmd ? cmd : resolved, args)
    if (options.dryRun) {
      options.onLog('stdout', `DRY-RUN: ${preview}`)
      return
    }

    options.onLog('stdout', `> ${preview}`)

    const env = buildChildEnv(options.env)

    await new Promise<void>((resolve, reject) => {
      const child = spawn(resolved, args, {
        cwd: options.cwd,
        env,
        shell: false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      })
      this.child = child

      const pump = (stream: NodeJS.ReadableStream | null, label: 'stdout' | 'stderr') => {
        if (!stream) return
        let buffer = ''
        stream.setEncoding('utf8')
        stream.on('data', (chunk: string) => {
          buffer += chunk
          const parts = buffer.split(/\r?\n/)
          buffer = parts.pop() ?? ''
          for (const line of parts) {
            options.onLog(label, line)
          }
        })
        stream.on('end', () => {
          if (buffer.length > 0) {
            options.onLog(label, buffer)
            buffer = ''
          }
        })
      }

      pump(child.stdout, 'stdout')
      pump(child.stderr, 'stderr')

      child.on('error', (err) => {
        this.child = null
        reject(formatSpawnError(cmd, err as NodeJS.ErrnoException))
      })

      child.on('close', (code, signal) => {
        this.child = null
        if (this.cancelled) {
          reject(new JobCancelledError())
          return
        }
        if (code === 0) {
          resolve()
          return
        }
        reject(new CommandFailedError(preview, code, signal))
      })
    })
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  bootstrapCliPath()
  try {
    await execFileAsync('which', [cmd], { env: buildChildEnv() })
    return true
  } catch {
    return false
  }
}

export async function readCommandOutput(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<string> {
  bootstrapCliPath()
  const resolved = await resolveCommand(cmd)
  const { stdout } = await execFileAsync(resolved, args, {
    env: buildChildEnv(env),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout
}
