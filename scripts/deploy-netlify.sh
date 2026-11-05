#!/usr/bin/env bash
#
# Deploy a built Simple Photo Gallery folder to Netlify.
#
# All settings come from a JSON config file (the same file used by
# "spg init --config"). The gallery folder is mirrored into a staging
# directory, leaving out files that should not be published (gallery.json,
# dotfiles, RAW files, ...), then uploaded with the Netlify CLI.
#
# See DEPLOY-NETLIFY.md for the full setup.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: deploy-netlify.sh --config <file> [options]

Options:
  -c, --config <file>   JSON config file (required), e.g. conf/francoisgeorgy-ch.json
  -b, --build           Run "spg build" on the gallery before deploying
      --recursive       Build sub-galleries too (default: on, or "recursive" in config)
      --cloudflare      Build with Cloudflare Web Analytics (or "cloudflare" in config)
      --prune           Build with --prune (or "prune" in config)
  -p, --prod            Deploy to production (default: draft preview URL)
  -m, --message <text>  Deploy message shown in the Netlify UI
  -n, --dry-run         Stage the files and list them, but do not deploy
  -h, --help            Show this help

Config properties used:
  baseFolder            Gallery folder to deploy (required)
  netlify.site          Netlify project ID (required)
  netlify.noindex       Ask search engines not to index the gallery (default: false)
  netlify.exclude       Extra rsync exclude patterns (default: [])
  recursive             Build flag (default: true)
  cloudflare            Build flag (default: false)
  prune                 Build flag (default: false)

Examples:
  deploy-netlify.sh -c conf/francoisgeorgy-ch.json
  deploy-netlify.sh -c conf/francoisgeorgy-ch.json --build --prod
EOF
}

die() { echo "Error: $*" >&2; exit 1; }

config=""
build=false
prod=false
dry_run=false
message=""
cli_recursive=false
cli_cloudflare=false
cli_prune=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--config) config="$2"; shift 2 ;;
    -b|--build) build=true; shift ;;
    --recursive) cli_recursive=true; shift ;;
    --cloudflare) cli_cloudflare=true; shift ;;
    --prune) cli_prune=true; shift ;;
    -p|--prod) prod=true; shift ;;
    -m|--message) message="$2"; shift 2 ;;
    -n|--dry-run) dry_run=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

[[ -n "$config" ]] || { usage >&2; die "No config file given. Use --config <file>."; }
[[ -f "$config" ]] || die "Config file not found: $config"
command -v node >/dev/null || die "node is required to read the config file."
command -v rsync >/dev/null || die "rsync is required."

# cfg <key> [default]: print a config value (dotted key). Arrays print one item per line.
cfg() {
  node -e '
    const [file, key, fallback] = process.argv.slice(1);
    const data = JSON.parse(require("fs").readFileSync(file, "utf8"));
    const value = key.split(".").reduce((obj, k) => obj?.[k], data);
    if (value === undefined || value === null) console.log(fallback);
    else if (Array.isArray(value)) value.forEach((item) => console.log(item));
    else console.log(value);
  ' "$config" "$1" "${2-}"
}

# cfg_bool <key> <default>: print "true" or "false", or fail on any other value.
cfg_bool() {
  local value
  value="$(cfg "$1" "$2")"
  [[ "$value" == true || "$value" == false ]] || die "\"$1\" in $config must be true or false (got: $value)"
  echo "$value"
}

gallery_dir="$(cfg baseFolder)"
site="$(cfg netlify.site)"
noindex="$(cfg_bool netlify.noindex false)"
recursive="$(cfg_bool recursive true)"
cloudflare="$(cfg_bool cloudflare false)"
prune="$(cfg_bool prune false)"
[[ "$cli_recursive" == true ]] && recursive=true
[[ "$cli_cloudflare" == true ]] && cloudflare=true
[[ "$cli_prune" == true ]] && prune=true

extra_excludes=()
while IFS= read -r pattern; do
  [[ -n "$pattern" ]] && extra_excludes+=("$pattern")
done < <(cfg netlify.exclude)

[[ -n "$gallery_dir" ]] || die "\"baseFolder\" is missing in $config."
[[ -n "$site" ]] || die "\"netlify.site\" is missing in $config."
[[ -d "$gallery_dir" ]] || die "Gallery folder not found: $gallery_dir"
gallery_dir="$(cd "$gallery_dir" && pwd)"

if [[ "$build" == true ]]; then
  command -v spg >/dev/null || die "spg not found. See RUN-LOCAL.md to link the local CLI."
  build_args=(build --gallery "$gallery_dir")
  [[ "$recursive" == true ]] && build_args+=(--recursive)
  [[ "$cloudflare" == true ]] && build_args+=(--cloudflare)
  [[ "$prune" == true ]] && build_args+=(--prune)
  echo "==> spg ${build_args[*]}"
  spg "${build_args[@]}"
fi

[[ -f "$gallery_dir/index.html" ]] || die "No index.html in $gallery_dir. Run 'spg build' first (or pass --build)."
[[ -d "$gallery_dir/gallery" ]] || die "No gallery/ folder in $gallery_dir. Run 'spg build' first (or pass --build)."

# Prefer a globally installed Netlify CLI, fall back to pnpm dlx.
if command -v netlify >/dev/null; then
  netlify_cmd=(netlify)
elif command -v pnpm >/dev/null; then
  netlify_cmd=(pnpm dlx netlify-cli)
else
  die "Netlify CLI not found. Install it with: pnpm add --global netlify-cli"
fi

# Keep the staging copy between runs so rsync only copies what changed.
staging_dir="${XDG_CACHE_HOME:-$HOME/.cache}/spg-netlify/$site"
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
# removes _headers on the next run, so this only applies when noindex is set.
if [[ "$noindex" == true ]]; then
  echo "==> Adding noindex header (_headers)"
  printf '\n/*\n  X-Robots-Tag: noindex, noimageindex\n' >> "$staging_dir/_headers"
fi

if [[ "$dry_run" == true ]]; then
  echo "==> Dry run, staged files:"
  (cd "$staging_dir" && find . -type f | sort)
  exit 0
fi

deploy_args=(deploy --dir . --site "$site")
[[ "$prod" == true ]] && deploy_args+=(--prod)
[[ -n "$message" ]] && deploy_args+=(--message "$message")

echo "==> Deploying to Netlify site '$site' ($([[ "$prod" == true ]] && echo production || echo draft))"
(cd "$staging_dir" && "${netlify_cmd[@]}" "${deploy_args[@]}")
