# init

Scans a folder for images and videos and creates a `gallery.json` file.

```bash
spg init [options]
```

## How it works

This command initializes a new gallery by scanning a folder (and optionally its subfolders) for images and videos. In interactive mode, the command first asks for the base publication URL. It then prompts for these settings for each gallery:

- Gallery title
- Gallery description
- Header image (selected from your photos)

The top-level gallery uses the base URL directly. Sub-gallery URLs are generated automatically from their relative directories. For example, the folder `2011-2016` receives `https://photos.example.com/2011-2016/` when the base URL is `https://photos.example.com/`. All settings can later be edited in the corresponding `gallery.json` file.

If a gallery contains only sub-galleries and no media of its own, the script asks for a homepage title and an optional homepage description instead of asking for an empty header image. These values are displayed above the sub-gallery grid.

Every interactive question includes its directory context, such as `[root: photos]` or `[sub-gallery: trips/italy]`, so recursive initialization always makes it clear which gallery is being configured.

> **Note:** The URL is important if you want the automatically generated social media images to work correctly, as it needs to be an absolute URL.

> **Tip:** Theme and thumbnail settings can be specified via CLI flags (`--theme`, `--thumbnail-size`, `--thumbnail-edge`) for users who know what they want upfront. These are stored in `gallery.json` and follow the [configuration hierarchy](../configuration.md#thumbnail-configuration): CLI → gallery.json → themeConfig.json → built-in defaults.

After that, the command will create a `gallery` folder and a `gallery.json` file in it. The `gallery.json` file contains all the information about the gallery, including the title, description, header image, URL, thumbnail settings (if specified), and all images and videos in the gallery.

## Options

| Option                      | Description                                                           | Default               |
| --------------------------- | --------------------------------------------------------------------- | --------------------- |
| `-p, --photos <path>`       | Path to folder containing photos                                      | Current directory     |
| `-g, --gallery <path>`      | Where to create the gallery                                           | Same as photos folder |
| `--config <path>`           | Path to a text or JSON config file for non-interactive initialization | None                  |
| `-r, --recursive`           | Create galleries from subdirectories                                  | `false`               |
| `-d, --default`             | Use default settings (skip prompts)                                   | `false`               |
| `-f, --force`               | Force override existing galleries without asking                      | `false`               |
| `--cta-banner`              | Add a Simple Photo Gallery CTA banner to the gallery                  | `false`               |
| `--cloudflare`              | Include Cloudflare Web Analytics script in the gallery HTML pages     | `false`               |
| `--theme <package\|path>`   | Theme to store in gallery.json                                        | None                  |
| `--thumbnail-size <pixels>` | Thumbnail size in pixels to store in gallery.json                     | Theme/default (300)   |
| `--thumbnail-edge <mode>`   | Size application mode: auto, width, or height                         | Theme/default (auto)  |
| `-v, --verbose`             | Show detailed output                                                  |                       |
| `-q, --quiet`               | Only show warnings/errors                                             |                       |
| `-h, --help`                | Show command help                                                     |                       |

## Examples

```bash
# Create gallery in current folder
spg init

# With a predefined config file
spg init --config conf/francoisgeorgy-ch.txt

# Overwrite existing galleries from config
spg init --config conf/francoisgeorgy-ch.txt --force

# Scan specific folder
spg init -p /path/to/photos

# Create gallery in different location
spg init -p /photos -g /gallery

# Scan subdirectories and create multiple galleries
spg init -r

# Skip interactive prompts
spg init -d

# Force override existing gallery
spg init -f

# Combine options
spg init -r -d -f

# Initialize with a specific theme and thumbnail settings
spg init --theme @simple-photo-gallery/theme-modern --thumbnail-size 400

# Initialize with custom thumbnail edge mode
spg init --thumbnail-size 300 --thumbnail-edge height

# Initialize with Cloudflare Web Analytics enabled
spg init --cloudflare
```

## Initialize from a config file

You can initialize a recursive gallery without prompts using a config file:

```bash
spg init --config conf/francoisgeorgy-ch.json
```

Use `--force` only if you want to overwrite existing generated gallery files:

```bash
spg init --config conf/francoisgeorgy-ch.json --force
```

JSON configs support localized album titles and descriptions. The default language is used for generated metadata and as a fallback when the browser does not prefer a configured language:

```json
{
    "baseFolder": "/Volumes/Photos/publish/",
    "defaultLanguage": "en",
    "title": "Photographs",
    "description": "A curated collection of photographs",
    "url": "https://photos.example.com/",
    "albums": {
        "after-hours": {
            "title": {
                "en": "After Hours",
                "fr": "Après la tombée de la nuit"
            },
            "description": {
                "en": "Night photographs",
                "fr": "Photographies de nuit"
            }
        }
    }
}
```

The generated page selects a configured language from the visitor's browser preferences. The language selector stores an explicit choice in `localStorage`. Search and social metadata use `defaultLanguage`.

Text configs remain supported for single-language galleries:

```text
base folder : /Volumes/Photos/publish/
title : Photographs
description : A curated collection of photographs
url : https://photos.example.com/

albums (folder name : album name : album description):
after-hours : After Hours : Ville, crépuscule, nuit, lumières artificielles
monochrome : Monochrome : Sélection de photographies noir et blanc
```

### Directory and album handling behavior

When `spg init --config <file>` runs against a target directory, it processes the folder hierarchy according to the following rules:

1. **Configured album folders (defined in config and present on disk):**
   - The CLI scans each matching subfolder for media files (images and videos).
   - The album's `gallery.json` is generated directly with its configured `title` and `description`, bypassing all interactive prompts.
   - Sub-gallery URLs are derived from the root `url` (e.g., `https://photos.example.com/after-hours/`), and a `navigation.home` link pointing back to the root gallery is added with the root gallery's title.
   - In the root gallery's `gallery.json`, the `subGalleries.galleries` collection uses the configured title rather than an inferred folder name.

2. **Unconfigured subfolders (present on disk but not in config):**
   - Any subfolder containing media that is not explicitly listed in the config is still processed and included as a sub-gallery so that no media files are omitted.
   - Its gallery title is automatically formatted from its folder name (e.g., `summer-trip` becomes `Summer Trip`), and it receives the standard default description.

3. **Configured albums not present on disk:**
   - If an album is defined in the config file but the folder does not exist on disk (or contains no media files), the initialization continues smoothly without error.
   - Non-existent or empty directories are omitted from the generated gallery tree to prevent broken navigation or empty pages.

4. **Existing gallery metadata (`gallery.json`):**
   - **Without `--force`:** If a `gallery/gallery.json` file already exists, execution halts with a safe error in non-interactive environments (or prompts for confirmation in interactive terminals) to prevent accidental loss of customized metadata.
   - **With `--force` (`-f`):** All existing `gallery.json` files are overwritten with the fresh configuration non-interactively.

## Creating the gallery in a folder other than the photos folder

The simplest way to create the gallery is in the same folder where your photos are. However, this means you will have the `index.html` file and the `gallery` folder alongside your photos. If you want to keep your photo folders clean and not add any files, you can create the gallery in a different folder using the `-g` flag.

If you do this, you will need to choose how the gallery links to your photos and there are two options for that:

### Copy all photos to the gallery folder

This is the simplest option and will copy all photos to the `gallery` folder. This is the default option, and you will be able to upload the entire gallery folder to your hosting provider.

### Link to photos uploaded separately

If you want to avoid copying the photos to the gallery folder, you can tell Simple Photo Gallery the URL where they are uploaded and upload them separately from the gallery. For this, you can use the `-b` or `--base-url` option in the [`simple-photo-gallery build`](./build.md) command.

This is especially useful for large galleries as static page hosting providers often have a limit on the size of the files you can upload. In this case, you can upload the photos to some kind of bucket storage that doesn't support hosting sites like for example [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/), [AWS S3](https://aws.amazon.com/s3/) or [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces), while you keep hosting the gallery itself on another provider like [Cloudflare Pages](https://pages.cloudflare.com/), [GitHub Pages](https://pages.github.com/), [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).

Keep in mind that the local files will be used when scanning the photos and when generating the thumbnails. The URL where they are hosted will only be used to link to them in the gallery.

## Recursive gallery initialization

The `-r` or `--recursive` flag can be used to create galleries from all subdirectories of the photos folder. This is useful if you have a lot of photos in subdirectories and you want to create a gallery for each subdirectory.

```bash
spg init -r
```

The command will recursively scan all subdirectories of the photos folder and create a separate gallery for each subdirectory. This has the same effect as running the command multiple times with the `-p` flag set to each subdirectory.

What the recursive option does in addition is create links between the galleries, and sub-galleries will appear as links in each folder's gallery. This way, you can navigate between the galleries and sub-galleries.

The publication base URL is requested once before any gallery-specific prompts. Every recursive gallery URL is then derived from its directory path, including nested subdirectories.

After recursive initialization, every child `gallery.json` also receives a relative home link. Its label uses the root gallery title, while its path is calculated from the child's nesting depth. The root gallery does not receive a home link.

> **Note:** If you have a lot of subdirectories, you might want to use the `-d` or `--default` flag to skip the interactive prompts.

## Overriding existing galleries

By default, if a gallery already exists in the target directory, the command will ask you whether you want to override it. You can use the `-f` or `--force` flag to skip this confirmation and automatically override any existing galleries.

```bash
# Force override without confirmation
spg init -f

# Useful in scripts and automated workflows
spg init -p /photos -f -d
```

This is particularly useful when:

- Running the command in automated scripts or CI/CD pipelines
- Re-initializing galleries after making changes to your photos
- You want to reset your gallery configuration
