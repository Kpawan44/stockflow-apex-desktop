# Stockflow Apex — Desktop App (Windows/Mac/Linux)

This project has been set up to build as an installable desktop app using
**Electron**. It wraps the existing React/Vite web app in a native window —
no code changes to your app logic were needed, since it already talks
directly to Firebase over HTTPS.

## What was added
- `electron/main.cjs` — creates the desktop window and loads the app
- `electron/preload.cjs` — minimal, isolated preload (no extra permissions)
- `vite.config.ts` — added `base: './'` so built assets load correctly from
  the local file system instead of a web server root
- `package.json` — added Electron + electron-builder scripts, dependencies,
  and packaging config (`build` key)
- `build_resources/icon.ico` and `icon.png` — generated from your existing
  `public/logo.jpg` for use as the app/installer icon

## One-time setup (on your own PC)
You need Node.js 18+ installed. Then, in the project folder:

```bash
npm install
```

## Try it in dev mode (runs the app in a desktop window with hot-reload)
```bash
npm run electron:dev
```

## Build an installer
Run the command for whichever OS you want to build for. **You generally
need to build on that OS** (build Windows installers on Windows, macOS
installers on a Mac, etc.) — cross-building is possible in some cases but
not guaranteed to work smoothly, especially for Windows/macOS signing.

```bash
# Windows -> creates an NSIS installer (.exe) in /release
npm run dist:win

# macOS -> creates a .dmg in /release
npm run dist:mac

# Linux -> creates an .AppImage in /release
npm run dist:linux

# Or just build for your current OS automatically
npm run dist
```

The installer/portable app will appear in the `release/` folder. On
Windows, running the generated `.exe` installs the app with a Start Menu
entry and desktop shortcut (the installer lets the user pick the install
folder since `oneClick` is disabled).

## Auto-update (checking for and installing new versions automatically)

The app now uses **electron-updater**, wired up in `electron/main.cjs`. When
a packaged (installed) copy of the app launches, it silently checks for a
newer version. If one exists, it downloads it in the background, then
shows a dialog letting the user restart now or install on next quit.

This only works for **Windows (NSIS)** and **macOS (dmg/zip)** builds —
Linux AppImage supports it too, but Linux package managers (deb/rpm) don't.

### 1. Choose where updates are hosted
By default this is configured for **GitHub Releases** (free, no server
needed). In `package.json`, under `"build" -> "publish"`, replace:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "YOUR_GITHUB_REPO_NAME"
}
```

with your actual GitHub username and repository name. The repo can be
private or public (private repos need a `GH_TOKEN` — see below).

If you'd rather host updates on your own server instead of GitHub, change
the publish block to:
```json
"publish": {
  "provider": "generic",
  "url": "https://your-domain.com/updates/"
}
```
and just upload the files electron-builder produces (the installer plus
the auto-generated `latest.yml` / `latest-mac.yml` / `latest-linux.yml`)
to that URL after each build.

### 2. Get a GitHub token (only needed to publish releases)
Create a Personal Access Token at https://github.com/settings/tokens with
`repo` scope, then set it as an environment variable before publishing:

```bash
# Windows (cmd)
set GH_TOKEN=your_token_here

# macOS/Linux
export GH_TOKEN=your_token_here
```

### 3. Release a new version
Each time you want to ship an update:
1. Bump the `"version"` field in `package.json` (e.g. `1.0.0` → `1.0.1`)
2. Run the publish build instead of the plain `dist` script:
   ```bash
   npm run build
   npx electron-builder --win --publish always
   ```
   (swap `--win` for `--mac`/`--linux` as needed). This uploads the
   installer and update metadata straight to your GitHub Releases page.
3. Anyone with an older version installed will get the update
   automatically next time they open the app.

### Testing it
electron-updater ignores update checks in dev mode and also won't find
updates for unpublished/lower version numbers, so to test: publish version
`1.0.1`, then install the `1.0.0` build on a test machine and open it —
it should detect and download `1.0.1` within a few seconds.

## Notes
- The app is **not code-signed**. On Windows, SmartScreen may show an
  "Unrecognized publisher" warning the first time it's run — this is
  normal for unsigned apps and doesn't affect functionality. To remove
  this warning you'd need a code-signing certificate (paid, from a CA).
- The app still requires an internet connection to sync with Firebase,
  but the existing Firestore persistent-cache setup in `src/firebase.ts`
  means it will keep working (read from cache) if the connection drops
  temporarily.
- If you'd rather have a **lighter-weight "installable app"** without a
  full Electron build, this project's existing PWA manifest also lets
  users click "Install" directly from Chrome/Edge when visiting the
  hosted site — no separate build step needed. That's a good option if
  you deploy the site and want a quick install path; use the Electron
  build above if you specifically need a standalone desktop `.exe`.
