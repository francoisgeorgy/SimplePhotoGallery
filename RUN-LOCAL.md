# Run a Local Fork

Use these instructions when you want the `spg` command to run this local fork instead of downloading `simple-photo-gallery` from the npm registry.

## Prerequisites

- Node.js 20 or newer
- Corepack enabled
- This repository cloned locally

The repository pins pnpm 10.12.4 in its root `package.json`.

## Initial Setup

Run the setup commands from the repository root:

```bash
cd /path/to/SimplePhotoGallery
corepack enable
pnpm install --frozen-lockfile
```

Build the shared package first, followed by the CLI package:

```bash
pnpm --filter @simple-photo-gallery/common build
pnpm --filter simple-photo-gallery build
```

## Understanding `--filter`

This repository is a pnpm workspace containing several packages. The `--filter` option selects a local workspace package by the `name` in its `package.json` and runs a command in that package.

For example:

```bash
pnpm --filter @simple-photo-gallery/common build
```

This selects the local package in `common/` and runs its `build` script. It is approximately equivalent to:

```bash
cd common
pnpm build
```

Similarly:

```bash
pnpm --filter simple-photo-gallery build
```

selects the local CLI package in `gallery/`. These commands do not download either package from the registry.

Filters are resolved from the current pnpm workspace. Run filtered commands from the repository root, or provide the repository explicitly when running them elsewhere:

```bash
pnpm --dir /path/to/SimplePhotoGallery \
    --filter simple-photo-gallery build
```

## Link the Local CLI Globally

After building the CLI, create a global link:

```bash
pnpm --dir gallery link --global
```

The `gallery/package.json` file exposes two executable names:

```text
simple-photo-gallery
spg
```

The link makes both commands available through pnpm's global executable directory while keeping the package itself in this repository.

Conceptually, command resolution becomes:

```text
spg
  -> pnpm global executable directory
  -> local gallery package
  -> gallery/dist/index.js
```

Linking does not publish the fork, download the registry version, or copy the repository. It creates a filesystem link back to the local `gallery/` directory.

You can inspect pnpm's global executable directory with:

```bash
pnpm bin --global
```

Verify the linked command with:

```bash
command -v spg
spg --version
```

## Run the Fork from a Photo Folder

Once linked, change to any photo folder and run `spg` normally:

```bash
cd /path/to/photos
spg init
spg build
```

The shell finds `spg` through pnpm's global executable directory. The CLI still uses the photo folder as its current working directory, so it creates the gallery there:

```text
photos/
├── index.html
├── photo-1.jpg
├── photo-2.jpg
└── gallery/
    ├── gallery.json
    └── images/
```

The global link affects command discovery only. It does not change where gallery files are created.

## Rebuild After Making Changes

The linked command runs `gallery/dist/index.js`, not the TypeScript files in `gallery/src/`. Rebuild after editing the CLI:

```bash
cd /path/to/SimplePhotoGallery
pnpm --filter simple-photo-gallery build
```

If you change the shared `common` package, rebuild both packages in dependency order:

```bash
pnpm --filter @simple-photo-gallery/common build
pnpm --filter simple-photo-gallery build
```

The existing global link immediately uses the rebuilt files. You do not need to link the package again.

## Run Without a Global Link

After building, you can invoke the local compiled CLI directly from a photo folder:

```bash
cd /path/to/photos
node /path/to/SimplePhotoGallery/gallery/dist/index.js init
node /path/to/SimplePhotoGallery/gallery/dist/index.js build
```

This uses the local fork and preserves the photo folder as the current working directory.

Do not use `pnpm dlx simple-photo-gallery@latest` when testing the fork. `pnpm dlx` resolves the published package from the registry rather than this local workspace.

## Moving or Removing the Fork

The global link points to the current location of the repository. Moving or deleting the repository breaks the command. After moving it, build and link the package again from its new location.

To remove the global command registration without deleting the fork:

```bash
pnpm remove --global simple-photo-gallery
```
