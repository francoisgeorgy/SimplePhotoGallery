# Simple Photo Gallery

Create beautiful photo galleries from collections in just 30 seconds. No configuration required to get started—simply run two commands in your photos folder and create a static gallery website you can self-host.

This is a free, open-source tool that you can use to generate galleries and self-host them. If you don't want to use the command line or bother with self-hostting, please check out [simple.photo](https://simple.photo) for a hosted solution.

## Example Gallries

<div align="center">
  <a href="https://simple.photo/haltakov/australia">
    <img src="docs/images/simple-photo-gallery-demo.jpg" alt="Simple Photo Gallery Demo" width="50%">
  </a>
</div>

### More examples

- [California Road Trip](https://simple.photo/haltakov/california-trip/)
- [Visiting Australia](https://simple.photo/haltakov/australia/)
- [Discovering Japan](https://simple.photo/haltakov/japan-trip/)

## Features

    📸 Automatically scan directories with photos and videos
    📝 Show descriptions for photos and videos
    📂 Divide the gallery into sections to tell a story
    🖼️ Create optimized thumbnails for fast loading
    🎥 Play videos directly in the gallery
    📱 Generate galleries that work on all devices
    ⚡ Optimized to be fast and lightweight
    🔧 Generate a static HTML gallery that you can self-host

## Quick Start

To create a gallery you need to install he `simple-photo-gallery` package globally and then you can use the `spg` command:

```bash
pnpm add --global simple-photo-gallery@latest
spg init
spg build
```

Alternatively, use `pnpm dlx` to run the commands without a global installation:

```bash
pnpm dlx simple-photo-gallery@latest init
pnpm dlx simple-photo-gallery@latest build
```

This will:

1. Download the [simple-photo-gallery](https://www.npmjs.com/package/simple-photo-gallery) package from the npm registry if needed
2. Prompt you for your gallery title, description, and header image
3. Scan your photos and create a `gallery.json` file
4. Generate optimized thumbnails
5. Build a static HTML gallery that you can open in your browser and self-host

## Installation Requirements

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **pnpm 10.12.4** - Managed through Corepack using the version pinned in `package.json`
- **FFmpeg** (for video support) - Install via:
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: [Download from ffmpeg.org](https://ffmpeg.org/download.html)

## Development

This is a monorepo using pnpm workspaces. To set up the development environment:

1. **Clone the repository**

   ```bash
   git clone https://github.com/SimplePhotoGallery/core.git
   cd spg-core
   ```

2. **Enable pnpm through Corepack**

   ```bash
   corepack enable
   ```

3. **Install dependencies from the lockfile**

   ```bash
   pnpm install --frozen-lockfile
   ```

4. **Build the `common` package** (required for TypeScript/ESLint to resolve `@simple-photo-gallery/common`)

   ```bash
   pnpm --filter @simple-photo-gallery/common build
   ```

5. **Run the repository checks**

   ```bash
   pnpm run ci
   ```

6. **Run the CLI in development mode**

   ```bash
   pnpm --filter simple-photo-gallery gallery
   ```

### Workspace Packages

- **`common/`** - Shared types, schemas, and utilities used by both the CLI and themes
  - Gallery types and Zod validation schemas
  - Theme utilities (data loading, path resolution, markdown parsing)
  - Client-side utilities (PhotoSwipe, blurhash, CSS helpers)
  - See [common/README.md](common/README.md) for full API documentation
- **`gallery/`** - CLI tool (`simple-photo-gallery`)
  - Includes base theme template bundled at `gallery/src/modules/create-theme/templates/base/`
- **`themes/modern/`** - Default theme package (reference implementation)

### Building Packages

Each workspace package can be built individually:

- `pnpm --filter @simple-photo-gallery/common build`
- `pnpm --filter simple-photo-gallery build`
- `pnpm --filter @simple-photo-gallery/theme-modern build`

## Supported Formats

**Images:** JPEG, PNG, WebP, GIF, TIFF  
**Videos:** MP4, MOV, AVI, WebM, MKV

## Preparing Photos for the Web

When a visitor opens a photo in the gallery's full-screen viewer, the browser loads your original file. `spg build` only generates thumbnails (300 px, plus a 600 px version for high-resolution screens) and versions of the header image. It does not create smaller copies of the originals. The size you export is the size visitors download.

**Use JPEG rather than PNG.** A photo saved as PNG is typically several times larger than a good JPEG and looks no better on screen.

**Recommended export settings** (shown for Adobe Lightroom; other editors have equivalent options):

| Setting           | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Format            | JPEG, quality 85                                                               |
| Color space       | sRGB                                                                           |
| Image sizing      | Resize to Fit: **Long Edge, 2560 px**, "Don't Enlarge" checked                 |
| Resolution (ppi)  | Doesn't matter for the web                                                     |
| Output sharpening | Screen, Standard                                                               |
| Metadata          | **All Except Camera & Camera Raw Info**, with **Remove Location Info** checked |

- **2560 px on the long edge** looks sharp full-screen on laptops, high-resolution laptop screens and 1440p monitors, with files of about 1–2.5 MB. Use 2048 px for a lighter gallery, or 3840 px if many visitors have 4K screens (expect files roughly 2–3× larger).
- **Quality 85** is hard to tell apart from higher settings on screen. Lightroom groups its 0–100 scale into steps, and 85–92 is a single step, so any value in that range gives the same file. Use 93–100 only if you want the maximum, which makes files noticeably larger for little visible gain.
- **Keep the description metadata.** `spg` reads each photo's caption from the Description/Title stored in the file, so a "Copyright Only" export removes your captions. "Remove Location Info" still keeps GPS data private.
- **Export the header image larger.** The build crops it to 4:3 at widths up to 3840 px (and to 3:4 up to 1080 px for phones). Export that photo at least **3840 px wide** so it stays sharp on large screens, and leave room around the subject for the crops.

### Protecting Your Photos

A published gallery is a set of plain files, and visitors can download them. The viewer has no download button, but right-click → "Save image" works, and the page's HTML lists the address of every full-size photo, so a tool like `wget --mirror` can copy the whole gallery in minutes. No website can fully prevent this: if a browser can display an image, it can save it. What you control is what people get:

- **Export size.** This is the strongest protection. A 2048–2560 px JPEG looks great on screen but is limited for printing. Never upload full-resolution files.
- **Watermark.** Add it when exporting, for example with Lightroom's **Watermarking** export option, so the gallery only ever sees watermarked files. Keep the header image clean or lightly marked, since the build crops it and may cut a corner watermark off.
- **Copyright metadata.** Fill in Copyright and Creator in your editor. The export settings above keep this metadata, so it travels with every copied file.
- **Restricted access.** For a private gallery, use your host's password protection (on Netlify this needs a paid plan). It keeps out casual visitors, not people who have the password.
- **Search engines.** To keep the gallery out of web and image search, send a `noindex` header. The Netlify deploy script does this with `--noindex` (see [DEPLOY-NETLIFY.md](./DEPLOY-NETLIFY.md)). Well-behaved crawlers respect it, scrapers do not.

Disabling right-click or image dragging with JavaScript annoys normal visitors and does not stop anyone determined, so the gallery does not do it.

## Architecture

This project uses a multi-theme architecture:

- **Common package** provides shared utilities for all themes
- **Themes** focus only on layout and presentation
- **CLI** handles gallery generation and theme orchestration

See the [Architecture Documentation](./docs/architecture.md) for details on how the system works, including:

- Package structure and dependencies
- Data flow from photos to static HTML
- Theme system design and resolution
- Multi-theme support implementation
- Guidelines for adding new features

## Detailed Documentation

For advanced usage, customization, and deployment options, see the comprehensive [documentation](./docs/README.md):

- **[Commands Reference](./docs/commands/README.md)** - Detailed guide for all CLI commands
  - [`init`](./docs/commands/init.md) - Initialize new galleries
  - [`build`](./docs/commands/build.md) - Generate static HTML galleries
  - [`thumbnails`](./docs/commands/thumbnails.md) - Generate optimized thumbnails
  - [`clean`](./docs/commands/clean.md) - Remove gallery files
  - [`create-theme`](./docs/commands/create-theme.md) - Scaffold a new theme package
  - [`telemetry`](./docs/commands/telemetry.md) - Manage anonymous telemetry preferences
- **[Gallery Configuration](./docs/configuration.md)** - Manual editing of `gallery.json` and advanced features like sections
- **[Custom Themes](./docs/themes.md)** - Create and use custom themes
- **[Common Package API](./common/README.md)** - Utilities and types for theme development
- **[Deployment Guide](./docs/deployment.md)** - Guidelines for hosting your gallery

## Python Version

The old Python version of Simple Photo Gallery V1 is still available [here](https://github.com/haltakov/simple-photo-gallery), but is now deprecated.

## License

Simple Photo Gallery is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.
