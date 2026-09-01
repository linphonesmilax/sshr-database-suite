# AGENTS.md — SSHR Database Suite

Quick orientation for AI agents and contributors working in this repo.

## What this is

Self-contained Electron desktop app for SSHR database **backup** (pg_dump), **restore** (psql/pg_restore), and **migrate** (pnpm + Prisma in microservice services). All orchestration is TypeScript in the main process — no shell scripts.

Stack: Electron 37, electron-vite 4, React 19, Tailwind 4, TypeScript 5.9, pnpm.

## Directory map

```
src/
  main/           Electron main process — spawn, fs, IPC, jobs
    index.ts      App bootstrap, ipcMain handlers
    jobs.ts       Single active job dispatcher
    migrate.ts    Prisma migrate via pnpm per service
    databases.ts  pg_dump / psql / pg_restore
    process.ts    ProcessController, spawn helpers
    settings.ts   settings.json in userData
    paths.ts      Dev vs packaged backup paths
    readiness.ts  Toolchain + service scan
  preload/        contextBridge → window.api
  renderer/src/   React UI
    App.tsx       Shell + routes
    context/      AppContext (settings, readiness, job state)
    pages/        Dashboard, Migrate, Backup, Restore, Settings
    components/   ui.tsx, LogConsole, Pickers
    lib/          logFormat, jobSummary, theme
  shared/
    types.ts      Shared types, constants, presets, job unions
```

## Where to edit

| Goal | Files |
|------|-------|
| New CLI / job behavior | `src/main/jobs.ts` + domain module |
| New IPC endpoint | `shared/types.ts` → `main/<domain>.ts` → `main/index.ts` → `preload/index.ts` |
| New UI screen | `pages/*Page.tsx` + route in `App.tsx` |
| Shared constants | `src/shared/types.ts` |
| User-facing status text | `lib/logFormat.ts`, `components/LogConsole.tsx` |
| Installers | `package.json` build field; `pnpm dist:linux` |

## How to add an IPC feature

1. Add types to `src/shared/types.ts`
2. Implement logic in `src/main/<domain>.ts`
3. Register `ipcMain.handle('domain:action', ...)` in `src/main/index.ts`
4. Expose on `api` in `src/preload/index.ts`
5. Call `window.api.*` from renderer (usually via `useApp()`)

Long-running work: invoke returns immediately; stream `job:started` / `job:log` / `job:ended`.

## How to add a page

1. Create `src/renderer/src/pages/FooPage.tsx` (default export, `PageHeader` + `Panel` layout)
2. Add route in `App.tsx` under the shell `<Outlet />`
3. Add nav link in sidebar (`App.tsx`)
4. Use `useApp()` for settings/readiness/job — do not add duplicate IPC listeners

## Hard boundaries

- Renderer never imports Node/Electron APIs
- Passwords never saved to settings — job input only
- One active job at a time
- HashRouter (not BrowserRouter)
- No new shell scripts

## Build

```bash
pnpm install
pnpm dev              # development
pnpm typecheck        # verify types
pnpm dist:linux       # AppImage in release/
pnpm release:linux    # build + publish to GitHub Releases (needs GH_TOKEN)
```

Friend install instructions: see [README.md](README.md).

Auto-updates: AppImage checks GitHub Releases via `src/main/updater.ts`. Bump `version` in `package.json` before each release.

## Cursor rules

Project-specific agent rules live in `.cursor/rules/`:

- `project-architecture.mdc` — always on; file index + boundaries
- `electron-main-ipc.mdc` — main + preload
- `react-renderer-ui.mdc` — renderer pages and UX
- `shared-types-jobs.mdc` — types and job unions
- `build-packaging.mdc` — dist, publish, and pnpm config
