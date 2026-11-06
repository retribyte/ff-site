#!/usr/bin/env bash
# Build the site at the committed HEAD and upload it to the NearlyFreeSpeech
# host as a Next.js standalone server (server.js + only the dependencies it
# needs; no native modules, since the host is FreeBSD).
#
#   scripts/deploy-nfsn.sh
#
# It ends by restarting the "ffsite" daemon (the host's `nfsn` CLI) and waiting
# until https://vortox.space/ answers again (~5 s of downtime).
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
    # Locally, nvm picks the version from .nvmrc; CI (which sets CI=true) has
    # already set Node up, and the runner image's own nvm has no v22 in it
    if [ -z "${CI:-}" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
        # shellcheck disable=SC1091
        source "$HOME/.nvm/nvm.sh" > /dev/null && nvm use > /dev/null
    fi
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

echo "== restart ffsite"
"${SSH[@]}" "nfsn stop-daemon ffsite > /dev/null; sleep 2; nfsn start-daemon ffsite > /dev/null"
# CI runs outside the US, so Cloudflare blocks it; CF_BYPASS_KEY (the x-image-key
# value its rules let through) gets the health check past
CURL_AUTH=(); [ -n "${CF_BYPASS_KEY:-}" ] && CURL_AUTH=(-H "x-image-key: $CF_BYPASS_KEY")
code=000
for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "${CURL_AUTH[@]}" https://vortox.space/)"
    [ "$code" = 200 ] && { echo "== deployed $REVISION, live"; exit 0; }
    sleep 2
done
echo "deployed $REVISION, but https://vortox.space/ answered $code, not 200; check /home/logs/daemon_ffsite.log" >&2
exit 1
