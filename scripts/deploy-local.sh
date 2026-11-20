#!/usr/bin/env bash
# Build the site at the committed HEAD and deploy it on THIS machine: the home
# server, where the self-hosted GitHub Actions runner runs it (see
# ff-server/docs/migrate-home-server.md). The NFSN equivalent is
# scripts/deploy-nfsn.sh, kept for failover.
#
#   scripts/deploy-local.sh
#
# Run it as a member of group `ff` (the `runner` user). It needs sudo for exactly
# `systemctl restart ffsite` (a sudoers drop-in).
#
# The build runs in a temporary git worktree with its own `npm ci`, so it never
# touches this checkout's node_modules or a running dev server.
#
# On the host:
#   /srv/ff/ff-site/app/    the standalone build (replaced every deploy)
#   /srv/ff/ff-site/run.sh  the service's run script (host-only)
# Env: FF_ROOT (default /srv/ff) overrides the base directory.
set -euo pipefail
umask 027   # group ff (the service) reads what we write; nobody else does

FF_ROOT="${FF_ROOT:-/srv/ff}"
DEST="$FF_ROOT/ff-site"
PORT=41731

cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
    echo "ff-site has uncommitted changes; commit them first (the build uses HEAD)" >&2
    exit 1
fi
REVISION="$(git rev-parse --short HEAD)"
BUILD_DIR="$(mktemp -d)"
trap 'git worktree remove --force "$BUILD_DIR" 2>/dev/null || rm -rf "$BUILD_DIR"' EXIT
git worktree add --detach -q "$BUILD_DIR" HEAD

echo "== build $REVISION"
(
    cd "$BUILD_DIR"
    # On a dev machine nvm picks the version from .nvmrc; the home server has
    # Node 24 system-wide (what production runs) and no nvm
    if [ -z "${CI:-}" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
        # shellcheck disable=SC1091
        source "$HOME/.nvm/nvm.sh" > /dev/null && nvm use > /dev/null
    fi
    npm ci --no-audit --no-fund --loglevel=error
    # Browser code calls the API same-origin; cloudflared sends /api to
    # ff-server. Server code gets API_URL at runtime from run.sh instead.
    NEXT_PUBLIC_API_URL=/api npm run build > build.log 2>&1 || { tail -30 build.log; exit 1; }
    # standalone leaves static assets and public/ for the deployer to place
    cp -r public .next-build/standalone/
    cp -r .next-build/static .next-build/standalone/.next-build/
    echo "$REVISION" > .next-build/standalone/REVISION
)

echo "== install"
mkdir -p "$DEST/app"
rsync -rlpt --delete --chmod=D2750,F640 "$BUILD_DIR/.next-build/standalone/" "$DEST/app/"

echo "== restart ffsite"
sudo -n systemctl restart ffsite
# Straight to loopback: no Cloudflare in the way, and no canonical-host redirect
# (that only fires for *.nfshost.com and www. names). These render real pages.
fail=0
for path in / /characters; do
    code=000
    for _ in $(seq 1 30); do
        code="$(curl -s -o /dev/null --max-time 20 -w '%{http_code}' "http://127.0.0.1:$PORT$path" || true)"
        [ "$code" = 200 ] && break
        sleep 2
    done
    echo "$path -> $code"
    [ "$code" = 200 ] || fail=1
done
if [ "$fail" != 0 ]; then
    echo "$REVISION IS LIVE, but its pages failed to load; check: journalctl -u ffsite -n 50" >&2
    exit 1
fi
echo "== deployed $REVISION, live"
