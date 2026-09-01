export const SERVICES = [
  'auth-service',
  'common-service',
  'employee-service',
  'recruitment-service',
  'timekeeping-service',
  'email-noti-service',
  'code-gen-service'
] as const

export type ServiceName = (typeof SERVICES)[number]

export const DATABASES = [
  'sshr_auth',
  'sshr_code_gen',
  'sshr_common',
  'sshr_email_noti',
  'sshr_employee',
  'sshr_migration_shadow',
  'sshr_rcm',
  'sshr_timekeeping'
] as const

export type DatabaseName = (typeof DATABASES)[number]

export const MICROSERVICE_ROOT_REL = 'Documents/smilax/sshr-microservice'

export const PRESETS = {
  cloudBackup: {
    label: 'Cloud RDS',
    host: 'sshr-v2.c5migwq2oose.ap-southeast-1.rds.amazonaws.com',
    port: '5432',
    user: 'Pzaw'
  },
  localRestore: {
    label: 'Local',
    host: 'localhost',
    port: '5433',
    user: 'postgres'
  }
} as const

export type MigrateMode = 'full' | 'deploy-only' | 'generate-only'

export interface AppSettings {
  /** Target checkout for Prisma migrate (services live here). */
  microserviceRoot: string
  /** Dump directory; defaults to this project's db_backups/. */
  lastBackupDir: string
  lastBackupHost: string
  lastBackupPort: string
  lastBackupUser: string
  lastBackupFormat: 'plain' | 'custom'
  lastRestoreHost: string
  lastRestorePort: string
  lastRestoreUser: string
  lastRestoreAdminDb: string
}

export function defaultSettings(homeDir = '', projectBackupDir = ''): AppSettings {
  const root = homeDir
    ? `${homeDir}/${MICROSERVICE_ROOT_REL}`
    : `~/${MICROSERVICE_ROOT_REL}`
  return {
    microserviceRoot: root,
    lastBackupDir: projectBackupDir || `${root}/db_backups`,
    lastBackupHost: PRESETS.cloudBackup.host,
    lastBackupPort: PRESETS.cloudBackup.port,
    lastBackupUser: PRESETS.cloudBackup.user,
    lastBackupFormat: 'plain',
    lastRestoreHost: PRESETS.localRestore.host,
    lastRestorePort: PRESETS.localRestore.port,
    lastRestoreUser: PRESETS.localRestore.user,
    lastRestoreAdminDb: 'postgres'
  }
}

export interface ServiceReadiness {
  name: ServiceName
  dirExists: boolean
  hasSchema: boolean
  hasEnvLocal: boolean
  hasNodeModules: boolean
  ready: boolean
}

export interface DumpCoverage {
  name: DatabaseName
  sql: boolean
  dump: boolean
  present: boolean
}

export interface ToolchainStatus {
  node: boolean
  pnpm: boolean
  pgDump: boolean
  psql: boolean
  pgRestore: boolean
  /** Built-in TypeScript migrate runner */
  migrateEngine: boolean
  /** pg client tools available for backup/restore */
  backupEngine: boolean
}

export interface ReadinessReport {
  root: string
  rootExists: boolean
  projectRoot: string
  services: ServiceReadiness[]
  dumps: DumpCoverage[]
  backupDir: string
  backupDirExists: boolean
  toolchain: ToolchainStatus
  scannedAt: string
}

export type JobKind = 'migrate' | 'backup' | 'restore'

export interface MigrateJobInput {
  kind: 'migrate'
  services: string[]
  mode: MigrateMode
  dryRun: boolean
}

export interface BackupJobInput {
  kind: 'backup'
  host: string
  port: string
  user: string
  password: string
  backupDir: string
  format: 'plain' | 'custom'
  databases: string[]
  dryRun: boolean
}

export interface RestoreJobInput {
  kind: 'restore'
  host: string
  port: string
  user: string
  password: string
  backupDir: string
  adminDb: string
  databases: string[]
  recreate: boolean
  dropOnly: boolean
  dryRun: boolean
}

export type JobInput = MigrateJobInput | BackupJobInput | RestoreJobInput

export interface JobStartedEvent {
  id: string
  kind: JobKind
  commandPreview: string
}

export interface JobLogEvent {
  id: string
  stream: 'stdout' | 'stderr'
  line: string
}

export interface JobEndedEvent {
  id: string
  code: number | null
  signal: string | null
  cancelled: boolean
}
