# Deploy a Gallery to Netlify

These instructions publish a gallery built with `spg` on your Mac to Netlify, served at:

```text
https://photos.francoisgeorgy.ch/
```

The gallery is a plain static site, so Netlify only hosts files. There is no build step on Netlify: you build locally with `spg build` and upload the result with the Netlify CLI, using `scripts/deploy-netlify.sh`.

> **See also:** [Run a Local Fork](./RUN-LOCAL.md) | [Deployment Guide](./docs/deployment.md) | [build command](./docs/commands/build.md)

## What Gets Deployed

After `spg build`, the photo folder looks like this:

```text
my-gallery/
├── index.html              <- gallery page
├── photo-1.jpg             <- original photos (shown in the lightbox)
├── photo-2.jpg
├── sub-gallery/            <- optional sub-galleries, each with its own index.html
└── gallery/
    ├── gallery.json        <- source data, only used at build time
    ├── images/             <- thumbnails, header image, social media card
    └── ...                 <- CSS/JS assets
```

The whole folder is the website, except for a few files that are not needed online. The deploy script copies the folder into a staging directory and leaves out:

- `gallery.json` and `gallery.json.old`
- dotfiles, such as `.DS_Store`
- RAW files and sidecars (`.dng`, `.cr2`, `.cr3`, `.nef`, `.arw`, `.raf`, `.orf`, `.rw2`, `.xmp`)

Use `--exclude` for anything else you want to keep private.

## One-Time Setup

### 1. Install the Netlify CLI and log in

```bash
pnpm add --global netlify-cli
netlify login
```

`netlify login` opens a browser window to authorize the CLI with your Netlify account. If you skip the global install, the script falls back to `pnpm dlx netlify-cli`. You still need to log in once with `pnpm dlx netlify-cli login`.

### 2. Create the Netlify site

**TO BE DONE FROM THE GALLERY DIR**

```bash
netlify sites:create --name francoisgeorgy-photos
```

The site name must be unique across Netlify. It also gives you a default URL, for example `https://francoisgeorgy-photos.netlify.app`. You can also create the site in the Netlify UI by choosing **Add new site → Deploy manually**.

Note the site name or the **Site ID** (in **Site configuration → General**). The deploy script needs one of them.

### 3. Tell the gallery its public URL

Edit `gallery/gallery.json` in the photo folder and set the top-level `url`:

```json
{
  "title": "My Gallery",
  "url": "https://photos.francoisgeorgy.ch/",
  ...
}
```

The theme uses this value for the canonical URL and for social media previews. `spg build` uses it to build an absolute URL for the social media card image (`metadata.image`). It only does this when `metadata.image` is still empty. If an earlier build already filled it with a relative path such as `/gallery/images/social-media-card.jpg`, change it by hand:

```json
"metadata": {
  "image": "https://photos.francoisgeorgy.ch/gallery/images/social-media-card.jpg"
}
```

Then rebuild:

```bash
cd /path/to/my-gallery
spg build
```

### 4. Add the custom domain

In the Netlify UI, open the site and go to **Domain management → Add a domain**. Enter `photos.francoisgeorgy.ch` and confirm.

Next, point DNS at Netlify. What you do depends on where `francoisgeorgy.ch` is managed.

**DNS stays with your current registrar or DNS provider (most common).** Add one record there:

| Type  | Name     | Value                                |
| ----- | -------- | ------------------------------------ |
| CNAME | `photos` | `francoisgeorgy-photos.netlify.app.` |

Use your own `<site-name>.netlify.app` as the value. Don't change the existing records for `francoisgeorgy.ch` or `www`. This subdomain is independent of them.

**DNS is managed by Netlify DNS.** Netlify creates the record for you when you add the domain.

Check that the record is live:

```bash
dig +short photos.francoisgeorgy.ch CNAME
```

Once DNS resolves, Netlify issues a free Let's Encrypt certificate automatically. You can see its status under **Domain management → HTTPS**. If it stays pending, click **Verify DNS configuration**. You can also enable **Force HTTPS** there.

## Deploying

From the repository root (or with the full path to the script):

```bash
# Preview: uploads a draft deploy and prints a unique preview URL
./scripts/deploy-netlify.sh -g ~/Pictures/my-gallery -s francoisgeorgy-photos

# Production: publishes to https://photos.francoisgeorgy.ch/
./scripts/deploy-netlify.sh -g ~/Pictures/my-gallery -s francoisgeorgy-photos --prod

# Build first, then publish
./scripts/deploy-netlify.sh -g ~/Pictures/my-gallery -s francoisgeorgy-photos --build --prod
```

To skip typing the site name every time, set it once in your shell profile (`~/.zshrc`):

```bash
export NETLIFY_SITE=francoisgeorgy-photos
```

### Options

| Option                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `-g, --gallery <dir>`   | Gallery folder to deploy (default: current directory)        |
| `-s, --site <name\|id>` | Netlify site name or ID (default: `$NETLIFY_SITE`)           |
| `-b, --build`           | Run `spg build -r` before deploying (includes sub-galleries) |
| `-p, --prod`            | Deploy to production instead of a draft preview              |
| `-m, --message <text>`  | Deploy message shown in the Netlify deploy list              |
| `-x, --exclude <glob>`  | Extra file pattern to leave out (repeatable)                 |
| `-n, --dry-run`         | Stage the files and list them without deploying              |
| `--noindex`             | Ask search engines not to index the gallery or its images    |

Run with `--dry-run` first to check exactly which files will go online.

`--noindex` adds a Netlify `_headers` file that sends `X-Robots-Tag: noindex, noimageindex` with every page and image. Google, Bing and other well-behaved search engines then leave the gallery out of web and image search. It does not stop scrapers or people with the link. Use it on every deploy: a deploy without it removes the header again. Netlify supports `_headers` on all plans.

### How it works

1. The script checks that the folder contains a built gallery (`index.html` and `gallery/`).
2. It mirrors the folder with `rsync` into `~/.cache/spg-netlify/<site>/`, applying the exclusions above. The staging copy is kept between runs, so later runs only copy changed files. Delete that folder to free disk space.
3. It runs `netlify deploy --dir <staging> --site <site>`, plus `--prod` if you passed it.

Netlify compares file hashes and uploads only new or changed files. The first deploy of a large gallery takes a while. Later deploys after adding a few photos are quick.

## Updating the Gallery

```bash
# add or remove photos in the folder, edit gallery.json if needed, then:
./scripts/deploy-netlify.sh -g ~/Pictures/my-gallery --build --prod
```

Every deploy is kept in the Netlify UI under **Deploys**. If something goes wrong, open an earlier deploy and click **Publish deploy** to roll back instantly.

## Deploying Without the Script

If you don't mind publishing `gallery.json` and other stray files, you can deploy the folder directly:

```bash
cd ~/Pictures/my-gallery
netlify deploy --dir . --site francoisgeorgy-photos --prod
```

You can also drag the folder onto the **Deploys** page of the site in the Netlify UI.

## Large Galleries

Netlify works well for galleries of a few hundred photos. If the folder grows to many gigabytes, for example with many videos, deploys get slow and you may hit Netlify's plan limits. In that case, host the originals separately (for example on Cloudflare R2 or S3) and build with `--base-url`. Netlify then only serves the small gallery site. See [Deploying the photos and the gallery site separately](./docs/deployment.md#deploying-the-photos-and-the-gallery-site-separately).

## Troubleshooting

- **`Not logged in` / `Unauthorized`**: run `netlify login` again.
- **`Site not found`**: check the name with `netlify sites:list`, or use the Site ID instead.
- **Domain shows "Awaiting External DNS"**: the CNAME record isn't visible yet. Check it with `dig` and wait for DNS propagation.
- **Social preview shows no image**: make sure `metadata.image` in `gallery.json` is an absolute `https://photos.francoisgeorgy.ch/...` URL, then rebuild and redeploy.
- **Photos missing on the live site**: run with `--dry-run` and check that the files aren't caught by an exclude pattern. Also check that the photos are in the gallery folder itself. If the gallery was created with `spg init -g`, `spg build` must copy them there first.
