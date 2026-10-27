# Build and Use Your Local Version

This guide makes the `spg` command use your local Simple Photo Gallery checkout instead of the version published to the npm registry.

## 1. Install Dependencies

Open a terminal in the repository root:

```bash
cd /path/to/SimplePhotoGallery
corepack enable
pnpm install --frozen-lockfile
```

If pnpm asks whether it may remove and reinstall the existing `node_modules` directories, answer `Y`. It only replaces installed dependencies and does not remove your source code.

## 2. Build the Local App

Still in the repository root, build the shared code first and the app second:

```bash
pnpm --filter @simple-photo-gallery/common build
pnpm --filter simple-photo-gallery build
```

The compiled local app is written to `gallery/dist/`.

## 3. Make the Local `spg` Command Available

First, check that pnpm has a global command directory:

```bash
pnpm bin --global
```

If this reports `ERR_PNPM_NO_GLOBAL_BIN_DIR`, configure it with:

```bash
pnpm setup
```

If setup reports `ERR_PNPM_BAD_SHELL_SECTION` because an old or commented pnpm section already exists in your shell configuration, replace that section with:

```bash
pnpm setup --force
```

Close and reopen your terminal so the updated `PATH` takes effect. Return to the repository root and confirm that `pnpm bin --global` now prints a directory.

Create a global command that points to the local build:

```bash
cd /path/to/SimplePhotoGallery/gallery
pnpm link --global
```

Run the link command from inside `gallery/`. Using `pnpm --dir gallery link --global` from the repository root links the workspace package instead of the CLI package.

This does not publish or copy the app. It makes the global `spg` command point to this repository's `gallery/dist/index.js` file.

Verify that the command is available:

```bash
command -v spg
spg --version
```

## 4. Use the Local App

Change to the folder containing your photos and run `spg`:

```bash
cd /path/to/your/photos
spg init
spg build
```

The generated gallery is created in the photo folder:

```text
photos/
├── index.html
├── photo-1.jpg
├── photo-2.jpg
└── gallery/
    ├── gallery.json
    └── images/
```

Do not use `pnpm dlx simple-photo-gallery` for this workflow. That command downloads the published registry version instead of running your local checkout.

## Rebuild After Changing the Code

After editing files under `gallery/`, rebuild the app:

```bash
cd /path/to/SimplePhotoGallery
pnpm --filter simple-photo-gallery build
```

After editing files under `common/`, rebuild both packages:

```bash
cd /path/to/SimplePhotoGallery
pnpm --filter @simple-photo-gallery/common build
pnpm --filter simple-photo-gallery build
```

You only need to create the global link once. The linked `spg` command automatically uses the newly built files.

## What `--filter` Means

This repository contains multiple packages. `--filter` selects which local package should run the command:

```bash
pnpm --filter simple-photo-gallery build
```

The command above means: run the `build` script from the local `gallery/package.json`. Run filtered commands from the repository root.

## If `spg` Is Not Found

Confirm that pnpm's global command directory exists:

```bash
pnpm bin --global
```

If the command reports `ERR_PNPM_NO_GLOBAL_BIN_DIR`, run `pnpm setup` and restart your terminal. If setup reports `ERR_PNPM_BAD_SHELL_SECTION` for an obsolete pnpm section, run `pnpm setup --force`. Otherwise, confirm that the printed directory is included in your shell's `PATH`, then run `spg --version` again.

If pnpm warns that `@simple-photo-gallery/workspace` has no binaries, remove the incorrect link and link again from inside `gallery/`:

```bash
pnpm remove --global @simple-photo-gallery/workspace
cd /path/to/SimplePhotoGallery/gallery
pnpm link --global
```
