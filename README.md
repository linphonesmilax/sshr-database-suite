# SSHR Database Suite

Self-contained Electron app for SSHR database **backup**, **restore**, and **migrate**. All orchestration runs in TypeScript in the Electron main process — no shell scripts.

## For your friend (Ubuntu install)

Send them **one file** from the `release/` folder after you build:

| File | How to install |
|------|----------------|
| **`SSHR-Database-Suite-1.0.0-x86_64.AppImage`** (recommended) | Right-click → Properties → **Allow executing as program**, then double-click. Or: `chmod +x SSHR-Database-Suite-*.AppImage` and run it. |
| **`sshr-database-suite_1.0.0_amd64.deb`** | Double-click to open in Software Install, or: `sudo apt install ./sshr-database-suite_*.deb` |

The `.deb` installer pulls in **PostgreSQL client tools** automatically. With the AppImage, they need:

```bash
sudo apt update
sudo apt install postgresql-client libfuse2
```

(`libfuse2` is required on newer Ubuntu so the AppImage can launch.)

### Migrate (optional)

Backup and restore work out of the box once `postgresql-client` is installed. **Migrate** also needs:

- Node.js 20+
- `pnpm` (`npm install -g pnpm`)
- A local checkout of **sshr-microservice** (path set in **Settings**)

### First run

1. Open the app from the app menu (**SSHR Database Suite**).
2. Enter database passwords when prompted (not saved to disk).
3. Backups are stored in **`~/Documents/SSHR Database Suite/db_backups`**.
4. Use **Dashboard** to see if anything is missing.

---

## Layout (developers)

```
database-manage/
  build/icons/    # app icon
  db_backups/     # default dump dir (dev mode)
  release/        # AppImage + .deb output
  src/main/       # migrate.ts, databases.ts, jobs, IPC
  src/renderer/   # UI
```

## How it works

| Action | Implementation |
|--------|----------------|
| Migrate | Loops services under the microservice root; runs `pnpm` Prisma migrate deploy + generate |
| Backup | Spawns `pg_dump` |
| Restore | Spawns `psql` / `pg_restore` (create/drop DB via `psql`) |

## Developer setup

```bash
cd ~/Desktop/database-manage
pnpm install
pnpm approve-builds   # allow electron + esbuild if prompted
pnpm dev
```

GPU issues on some Linux setups:

```bash
SSHR_DB_SUITE_DISABLE_GPU=1 pnpm dev
```

## Build installers (Linux)

```bash
pnpm install
pnpm dist:linux
```

Output in `release/`:

- `SSHR-Database-Suite-<version>-x86_64.AppImage` (**use this for auto-updates**)
- `sshr-database-suite_<version>_amd64.deb` (build machine needs `sudo apt install binutils`)

## Auto-updates (GitHub Releases)

The installed **AppImage** checks GitHub for new versions on launch (`electron-updater`).

Publish target: `linphonesmilax/sshr-database-suite` (see `package.json` `build.publish`).

### One-time setup

1. Create the GitHub repo (public is simplest for updates).
2. Create a classic PAT with `repo` scope: [https://github.com/settings/tokens](https://github.com/settings/tokens)
3. Export it when publishing:

```bash
export GH_TOKEN=ghp_your_token_here
```

### Ship an update

1. Bump `"version"` in `package.json` (e.g. `1.0.0` → `1.0.1`)
2. Commit and push
3. Build + publish:

```bash
pnpm release:linux
```

That uploads the AppImage (and `.deb`) to a GitHub Release. Friends on the AppImage get a banner → download → **Restart now**.

**Note:** Auto-update works reliably for **AppImage**. The `.deb` is still fine to hand out, but friends on `.deb` should reinstall newer packages manually (or switch to AppImage).

**Requirements for auto-update:**

1. Repo must be **public** (Settings → Danger zone → Change visibility).
2. The GitHub Release must be **published**, not a draft. Drafts are invisible to the app.
3. `package.json` uses `"releaseType": "release"` so `pnpm release:linux` publishes immediately.

If you already have a draft: open [Releases](https://github.com/linphonesmilax/sshr-database-suite/releases) → open the draft → **Publish release**.

Do not put `GH_TOKEN` inside the app. Tokens stay on your machine for `pnpm release:linux` only.

## Typical workflow

1. **Backup** → dumps into `db_backups/` (dev) or Documents folder (installed app)
2. **Restore** → Local preset → Recreate (type `RECREATE`)
3. **Migrate** → against the configured microservice root

## Security

- Passwords stay in memory for the job only; never written to `settings.json`
- Destructive restore requires typing `RECREATE` or `DROP`
- Database names are validated before use in SQL
