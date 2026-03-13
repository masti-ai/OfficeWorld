#!/bin/bash
# Install mesh self-improving loop cron entries
#
# This adds cron jobs for:
#   1. mesh-improve.sh review  — every 10 minutes, reviews pending improvements
#   2. mesh-auto-sync.sh digest — every 2 hours, broadcasts work digest to peers
#
# mesh-sync.sh (already in cron at */2) now also calls mesh-auto-sync.sh log
# and mesh-improve.sh review inline on every sync cycle.
#
# Usage: bash deacon/scripts/mesh-cron-install.sh [--dry-run]

GT_ROOT="${GT_ROOT:-/home/pratham2/gt}"
MESH_YAML="${MESH_YAML:-$GT_ROOT/mesh.yaml}"
SCRIPTS_DIR="$GT_ROOT/.gt-mesh/scripts"
DRY_RUN=false
[ "$1" = "--dry-run" ] && DRY_RUN=true

if [ ! -f "$MESH_YAML" ]; then
  echo "[error] mesh.yaml not found at $MESH_YAML"
  exit 1
fi

if [ ! -d "$SCRIPTS_DIR" ]; then
  echo "[error] Mesh scripts not found at $SCRIPTS_DIR"
  exit 1
fi

# The two new cron entries
IMPROVE_CRON="*/10 * * * * GT_ROOT=$GT_ROOT MESH_YAML=$MESH_YAML bash $SCRIPTS_DIR/mesh-improve.sh review >> /tmp/mesh-improve.log 2>&1"
DIGEST_CRON="0 */2 * * * GT_ROOT=$GT_ROOT MESH_YAML=$MESH_YAML bash $SCRIPTS_DIR/mesh-auto-sync.sh digest >> /tmp/mesh-autosync.log 2>&1"

CURRENT_CRONTAB=$(crontab -l 2>/dev/null || echo "")

CHANGED=false

# Add mesh-improve review if not already present
if echo "$CURRENT_CRONTAB" | grep -q "mesh-improve.sh review"; then
  echo "[cron] mesh-improve.sh review already installed"
else
  echo "[cron] Adding mesh-improve.sh review (every 10 min)"
  CURRENT_CRONTAB="$CURRENT_CRONTAB
$IMPROVE_CRON"
  CHANGED=true
fi

# Add mesh-auto-sync digest if not already present
if echo "$CURRENT_CRONTAB" | grep -q "mesh-auto-sync.sh digest"; then
  echo "[cron] mesh-auto-sync.sh digest already installed"
else
  echo "[cron] Adding mesh-auto-sync.sh digest (every 2 hours)"
  CURRENT_CRONTAB="$CURRENT_CRONTAB
$DIGEST_CRON"
  CHANGED=true
fi

if [ "$CHANGED" = true ]; then
  if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "[dry-run] Would install crontab:"
    echo "$CURRENT_CRONTAB"
  else
    echo "$CURRENT_CRONTAB" | crontab -
    echo "[cron] Installed. Current crontab:"
    crontab -l
  fi
else
  echo "[cron] All entries already installed. Nothing to do."
fi
