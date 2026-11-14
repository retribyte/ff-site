#!/usr/bin/env bash
# Copies the portrait creator's mod folders to the server ff-server reads them from.
#
#   scripts/portrait-push.sh                 every mod folder in .portrait-bundle/
#   scripts/portrait-push.sh 729427301 vanilla    only these mods (folder names)
#   scripts/portrait-push.sh --dry-run ...   show what would be copied, change nothing
#   scripts/portrait-push.sh --prune         also delete server folders this machine lacks
#
# A mod is one folder (mod.json, items.json, sprites.pack), built by
# scripts/portrait-extract/extract.py. Pushing a mod that is already there replaces it;
# mods on the server that are not pushed are left alone unless --prune is given. ff-server
# notices changes on the next request: nothing is restarted and no code is deployed.
# Sprites are game and mod assets: they go to the server by this script only, never by git
# and never inside a deployed folder (both deploys mirror their folder with --delete).
#
# The server folder is /home/protected/portrait-bundle; ff-server's .env on the host must
# name it (PORTRAIT_BUNDLE_DIR), which is a one-time step by hand.
#
# Env: NFSN_SSH (user@host), NFSN_KEY (ssh key path) override the defaults, as in
# deploy-nfsn.sh. PORTRAIT_BUNDLE is the local bundle (default .portrait-bundle here).
# PORTRAIT_PUSH_LOCAL=<dir> copies into a local directory instead of the server (for a
# trial run, or a server on this machine).
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="${PORTRAIT_BUNDLE:-$PWD/.portrait-bundle}"
SSH_TARGET="${NFSN_SSH:-retri_vortox@ssh.nyc1.nearlyfreespeech.net}"
KEY="${NFSN_KEY:-$HOME/.ssh/booru}"
DEST=/home/protected/portrait-bundle
SSH_OPTS="-i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4"
LOCAL="${PORTRAIT_PUSH_LOCAL:-}"

DRY=""
PRUNE=""
MODS=()
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY=1 ;;
        --prune) PRUNE=1 ;;
        -h | --help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        -*) echo "unknown option: $arg" >&2; exit 2 ;;
        *) MODS+=("$arg") ;;
    esac
done

[ -d "$SRC" ] || { echo "no bundle at $SRC: build one with scripts/portrait-extract/extract.py" >&2; exit 1; }

# Every folder with a mod.json is a mod; anything else in the bundle is not sent
ALL=()
while IFS= read -r file; do
    ALL+=("$(basename "$(dirname "$file")")")
done < <(find "$SRC" -mindepth 2 -maxdepth 2 -name mod.json | sort)
[ "${#ALL[@]}" -gt 0 ] || { echo "no mod folders in $SRC" >&2; exit 1; }

if [ "${#MODS[@]}" -eq 0 ]; then
    MODS=("${ALL[@]}")
else
    [ -z "$PRUNE" ] || { echo "--prune goes with pushing everything, not with named mods" >&2; exit 2; }
    for mod in "${MODS[@]}"; do
        [ -f "$SRC/$mod/mod.json" ] || { echo "no such mod folder: $SRC/$mod" >&2; exit 1; }
    done
fi

if [ -n "$LOCAL" ]; then
    TARGET="$LOCAL"
    remote() { bash -c "$1"; }
    RSYNC=(rsync)
    DEST="$LOCAL"
else
    TARGET="$SSH_TARGET:$DEST"
    # shellcheck disable=SC2086
    remote() { ssh $SSH_OPTS "$SSH_TARGET" "$1" < /dev/null; }
    RSYNC=(rsync -e "ssh $SSH_OPTS")
fi

echo "pushing ${#MODS[@]} of ${#ALL[@]} mods to $TARGET${DRY:+ (dry run)}"
[ -n "$DRY" ] || remote "mkdir -p '$DEST'"

# One rsync for all the folders named: --relative keeps each under its own name, and
# --delete clears files a new version of a mod no longer has (only inside folders sent).
ARGS=(-a --relative --delete --itemize-changes)
[ -z "$DRY" ] || ARGS+=(--dry-run)
SOURCES=()
for mod in "${MODS[@]}"; do SOURCES+=("$SRC/./$mod/"); done
"${RSYNC[@]}" "${ARGS[@]}" "${SOURCES[@]}" "$TARGET/" | grep -c '^[<>c*]' | sed 's/$/ files or folders changed/' || true

if [ -n "$PRUNE" ]; then
    # Server folders that hold a mod.json and are not on this machine
    there="$(remote "cd '$DEST' 2>/dev/null && for d in */; do [ -f \"\$d/mod.json\" ] && echo \"\${d%/}\"; done; true")"
    while IFS= read -r mod; do
        [ -n "$mod" ] || continue
        [ -f "$SRC/$mod/mod.json" ] && continue
        case "$mod" in */* | .* | "") continue ;; esac
        if [ -n "$DRY" ]; then
            echo "would delete from the server: $mod"
        else
            echo "deleting from the server: $mod"
            remote "rm -rf -- '$DEST/$mod'"
        fi
    done <<< "$there"
fi

if [ -z "$DRY" ] && [ -z "$LOCAL" ]; then
    # The API runs as web: it reads the folders, and deletes one when an admin removes a mod
    remote "chgrp -R web '$DEST' && chmod -R g+rwX,o-rwx '$DEST'"
fi
echo "done${DRY:+ (dry run: nothing was changed)}"
