# SSHR Database Suite

Self-contained Electron app for SSHR database **backup**, **restore**, and **migrate**. All orchestration runs in TypeScript in the Electron main process — no shell scripts.

## For your friend (Ubuntu install)

Send them the **AppImage** from the GitHub Release (or `release/` after you build):

**`SSHR-Database-Suite-<version>-x86_64.AppImage`**

1. Right-click → Properties → **Allow executing as program**, then double-click.  
   Or: `chmod +x SSHR-Database-Suite-*.AppImage` and run it.
2. If it does not start:

```bash
sudo apt update
sudo apt install postgresql-client libfuse2
```

(`libfuse2` is required on newer Ubuntu so the AppImage can launch.)

We only ship AppImage. It can auto-update. A `.deb` cannot, and would waste GitHub storage.
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
  release/        # AppImage output
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

- `SSHR-Database-Suite-<version>-x86_64.AppImage`

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

That uploads the AppImage to a GitHub Release. Friends get a toast → download → **Restart now**.

**Requirements for auto-update:**

1. Repo must be **public** (Settings → Danger zone → Change visibility).
2. The GitHub Release must be **published**, not a draft. Drafts are invisible to the app.
3. `package.json` uses `"releaseType": "release"` so `pnpm release:linux` publishes immediately.

If you already have a draft: open [Releases](https://github.com/linphonesmilax/sshr-database-suite/releases) → open the draft → **Publish release**.

Do not put `GH_TOKEN` inside the app. Tokens stay on your machine for `pnpm release:linux` only.

### Managing old releases (save GitHub space)

Keep only the latest release. Delete older ones:

1. Open [Releases](https://github.com/linphonesmilax/sshr-database-suite/releases)
2. Open an old release → **Delete** (trash icon / Delete release)
3. Optionally delete the git tag too when prompted

Friends only need the **latest** AppImage / `latest-linux.yml`. Old releases are not required for auto-update.

## Typical workflow

1. **Backup** → dumps into `db_backups/` (dev) or Documents folder (installed app)
2. **Restore** → Local preset → Recreate (type `RECREATE`)
3. **Migrate** → against the configured microservice root

## Security

- Passwords stay in memory for the job only; never written to `settings.json`
- Destructive restore requires typing `RECREATE` or `DROP`
- Database names are validated before use in SQL
