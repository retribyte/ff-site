#!/usr/bin/env bash
# Build the site at the committed HEAD and upload it to the NearlyFreeSpeech
# host as a Next.js standalone server (server.js + only the dependencies it
# needs; no native modules, since the host is FreeBSD).
#
#   scripts/deploy-nfsn.sh
#
# Then restart the "ffsite" daemon in the NFSN site panel (Daemons).
#
# The build runs in a temporary git worktree with its own `npm ci`, so it never
# touches this checkout's node_modules or a running dev server.
#
# On the host (see ff-server/docs/deploy-nfsn.md):
#   /home/protected/ff-site/app/   the standalone build (replaced every deploy)
#   /home/protected/ff-site/run.sh the daemon's run script (host-only)
# Env: NFSN_SSH (user@host), NFSN_KEY (ssh key path) override the defaults.
set -euo pipefail

SSH_TARGET="${NFSN_SSH:-retri_vortox@ssh.nyc1.nearlyfreespeech.net}"
KEY="${NFSN_KEY:-$HOME/.ssh/booru}"
DEST=/home/protected/ff-site
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes "$SSH_TARGET")
RSYNC_SSH="ssh -i $KEY -o IdentitiesOnly=yes"

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
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh" > /dev/null && nvm use > /dev/null
    npm ci --no-audit --no-fund --loglevel=error
    # Browser code calls the API same-origin; the site proxy sends /api to
    # ff-server. Server code gets API_URL at runtime from run.sh instead.
    NEXT_PUBLIC_API_URL=/api npm run build > build.log 2>&1 || { tail -30 build.log; exit 1; }
    # standalone leaves static assets and public/ for the deployer to place
    cp -r public .next-build/standalone/
    cp -r .next-build/static .next-build/standalone/.next-build/
    echo "$REVISION" > .next-build/standalone/REVISION
)

echo "== upload"
"${SSH[@]}" "mkdir -p $DEST/app"
rsync -a --delete -e "$RSYNC_SSH" "$BUILD_DIR/.next-build/standalone/" "$SSH_TARGET:$DEST/app/"
# New files take the uploader's group here, not the directory's; the daemon
# runs as web and needs group read
"${SSH[@]}" "chgrp -R web $DEST/app && chmod -R g+rX,o-rwx $DEST/app"

echo "== deployed $REVISION; restart the ffsite daemon in the NFSN panel"
