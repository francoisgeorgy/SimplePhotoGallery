#!/usr/bin/env bash
#
# Deploy a built Simple Photo Gallery folder to Netlify.
#
# The gallery folder is first mirrored into a staging directory, leaving out
# files that should not be published (gallery.json, dotfiles, RAW files, ...).
# The staging directory is then uploaded with the Netlify CLI. Netlify only
# uploads files whose content changed, so redeploys are fast.
#
# See DEPLOY-NETLIFY.md for the full setup.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy-netlify.sh [options]

Options:
  -g, --gallery <dir>   Gallery folder to deploy (default: current directory)
  -s, --site <name|id>  Netlify site name or ID (default: $NETLIFY_SITE)
  -b, --build           Run "spg build -r" on the gallery before deploying
  -p, --prod            Deploy to production (default: draft preview URL)
  -m, --message <text>  Deploy message shown in the Netlify UI
  -x, --exclude <glob>  Extra rsync exclude pattern (repeatable)
      --noindex         Ask search engines not to index the gallery or its images
  -n, --dry-run         Stage the files and list them, but do not deploy
  -h, --help            Show this help

Examples:
  deploy-netlify.sh -g ~/Pictures/my-gallery -s francoisgeorgy-photos
  deploy-netlify.sh -g ~/Pictures/my-gallery -s francoisgeorgy-photos --build --prod
EOF
}

gallery_dir="$PWD"
site="${NETLIFY_SITE:-}"
build=false
prod=false
dry_run=false
noindex=false
message=""
extra_excludes=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -g|--gallery) gallery_dir="$2"; shift 2 ;;
    -s|--site) site="$2"; shift 2 ;;
    -b|--build) build=true; shift ;;
    -p|--prod) prod=true; shift ;;
    -m|--message) message="$2"; shift 2 ;;
    -x|--exclude) extra_excludes+=("$2"); shift 2 ;;
    -n|--dry-run) dry_run=true; shift ;;
    --noindex) noindex=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

die() { echo "Error: $*" >&2; exit 1; }

[[ -d "$gallery_dir" ]] || die "Gallery folder not found: $gallery_dir"
gallery_dir="$(cd "$gallery_dir" && pwd)"

if [[ -z "$site" && "$dry_run" == false ]]; then
  die "No Netlify site given. Use --site <name|id> or set NETLIFY_SITE."
fi

command -v rsync >/dev/null || die "rsync is required."

# Prefer a globally installed Netlify CLI, fall back to pnpm dlx.
if command -v netlify >/dev/null; then
  netlify_cmd=(netlify)
elif command -v pnpm >/dev/null; then
  netlify_cmd=(pnpm dlx netlify-cli)
else
  die "Netlify CLI not found. Install it with: pnpm add --global netlify-cli"
fi

if [[ "$build" == true ]]; then
  command -v spg >/dev/null || die "spg not found. See RUN-LOCAL.md to link the local CLI."
  echo "==> Building gallery in $gallery_dir"
  spg build -r -g "$gallery_dir"
fi

[[ -f "$gallery_dir/index.html" ]] || die "No index.html in $gallery_dir. Run 'spg build' first (or pass --build)."
[[ -d "$gallery_dir/gallery" ]] || die "No gallery/ folder in $gallery_dir. Run 'spg build' first (or pass --build)."

# Keep the staging copy between runs so rsync only copies what changed.
staging_root="${XDG_CACHE_HOME:-$HOME/.cache}/spg-netlify"
staging_dir="$staging_root/${site:-dry-run}"
mkdir -p "$staging_dir"

excludes=(
  '.*'                # .DS_Store, .netlify, .git, ...
  'gallery.json'      # source data, only needed at build time
  'gallery.json.old'
  '_build/'
  'node_modules/'
  'Thumbs.db'
  '*.xmp' '*.XMP'
  '*.dng' '*.DNG' '*.cr2' '*.CR2' '*.cr3' '*.CR3' '*.nef' '*.NEF'
  '*.arw' '*.ARW' '*.raf' '*.RAF' '*.orf' '*.ORF' '*.rw2' '*.RW2'
)
excludes+=("${extra_excludes[@]+"${extra_excludes[@]}"}")

rsync_args=(-a --delete --delete-excluded)
for pattern in "${excludes[@]}"; do
  rsync_args+=("--exclude=$pattern")
done

echo "==> Staging $gallery_dir -> $staging_dir"
rsync "${rsync_args[@]}" "$gallery_dir/" "$staging_dir/"

file_count="$(find "$staging_dir" -type f | wc -l | tr -d ' ')"
total_size="$(du -sh "$staging_dir" | cut -f1)"
echo "    $file_count files, $total_size"

# Ask search engines not to index the pages or the images. rsync restores or
# removes _headers on the next run, so this only applies when --noindex is set.
if [[ "$noindex" == true ]]; then
  echo "==> Adding noindex header (_headers)"
  printf '\n/*\n  X-Robots-Tag: noindex, noimageindex\n' >> "$staging_dir/_headers"
fi

if [[ "$dry_run" == true ]]; then
  echo "==> Dry run, staged files:"
  (cd "$staging_dir" && find . -type f | sort)
  exit 0
fi

deploy_args=(deploy --dir "$staging_dir" --site "$site")
if [[ "$prod" == true ]]; then
  deploy_args+=(--prod)
fi
if [[ -n "$message" ]]; then
  deploy_args+=(--message "$message")
fi

echo "==> Deploying to Netlify site '$site' ($([[ "$prod" == true ]] && echo production || echo draft))"
"${netlify_cmd[@]}" "${deploy_args[@]}"
