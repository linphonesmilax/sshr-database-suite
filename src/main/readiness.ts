import { existsSync } from 'fs'
import { join } from 'path'
import {
  AppSettings,
  DATABASES,
  DumpCoverage,
  ReadinessReport,
  SERVICES,
  ServiceReadiness,
  ToolchainStatus
} from '../shared/types'
import { getProjectRoot } from './paths'
import { bootstrapCliPath, commandExists } from './process'

export async function scanReadiness(
  settings: AppSettings,
  backupDir: string
): Promise<ReadinessReport> {
  bootstrapCliPath()
  const root = settings.microserviceRoot
  const rootExists = existsSync(root)
  const projectRoot = getProjectRoot()

  const services: ServiceReadiness[] = SERVICES.map((name) => {
    const dir = join(root, name)
    const dirExists = existsSync(dir)
    const hasSchema = existsSync(join(dir, 'prisma', 'schema.prisma'))
    const hasEnvLocal = existsSync(join(dir, '.env.local'))
    const hasNodeModules = existsSync(join(dir, 'node_modules'))
    return {
      name,
      dirExists,
      hasSchema,
      hasEnvLocal,
      hasNodeModules,
      ready: dirExists && hasSchema && hasEnvLocal && hasNodeModules
    }
  })

  const backupDirExists = existsSync(backupDir)
  const dumps: DumpCoverage[] = DATABASES.map((name) => {
    const sql = existsSync(join(backupDir, `${name}.sql`))
    const dump = existsSync(join(backupDir, `${name}.dump`))
    return { name, sql, dump, present: sql || dump }
  })

  const [node, pnpm, pgDump, psql, pgRestore] = await Promise.all([
    commandExists('node'),
    commandExists('pnpm'),
    commandExists('pg_dump'),
    commandExists('psql'),
    commandExists('pg_restore')
  ])

  const toolchain: ToolchainStatus = {
    node,
    pnpm,
    pgDump,
    psql,
    pgRestore,
    migrateEngine: true,
    backupEngine: pgDump && psql && pgRestore
  }

  return {
    root,
    rootExists,
    projectRoot,
    services,
    dumps,
    backupDir,
    backupDirExists,
    toolchain,
    scannedAt: new Date().toISOString()
  }
}
