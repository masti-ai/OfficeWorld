#!/bin/bash
# Install deacon cron scripts
#
# Symlinks deacon scripts into .gt-mesh/scripts/ and installs cron entries.
# Also registers entries in cron-registry.yaml.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GT_ROOT="${GT_ROOT:-/home/pratham2/gt}"
MESH_SCRIPTS="$GT_ROOT/.gt-mesh/scripts"
CRON_REGISTRY="$GT_ROOT/.gt-mesh/cron-registry.yaml"

echo "Installing deacon scripts..."

# Symlink scripts
if [ -d "$MESH_SCRIPTS" ]; then
  for script in deacon-pr-review.sh deacon-worker-sla.sh; do
    if [ -f "$SCRIPT_DIR/scripts/$script" ]; then
      ln -sf "$SCRIPT_DIR/scripts/$script" "$MESH_SCRIPTS/$script"
      chmod +x "$SCRIPT_DIR/scripts/$script"
      echo "  Linked: $script -> $MESH_SCRIPTS/"
    fi
  done
else
  echo "  [warn] $MESH_SCRIPTS not found — skipping symlinks"
fi

EXISTING=$(crontab -l 2>/dev/null || true)
CHANGED=false

# Install deacon-pr-review cron (every 30 min)
if echo "$EXISTING" | grep -qF "deacon-pr-review.sh"; then
  echo "  Cron: deacon-pr-review.sh already installed"
else
  EXISTING="$EXISTING
*/30 * * * * bash $MESH_SCRIPTS/deacon-pr-review.sh"
  CHANGED=true
  echo "  Installed cron: deacon-pr-review.sh (*/30)"
fi

# Install deacon-worker-sla cron (every 30 min)
if echo "$EXISTING" | grep -F "deacon-worker-sla.sh" | grep -vF -- "--weekly" | grep -q .; then
  echo "  Cron: deacon-worker-sla.sh already installed"
else
  EXISTING="$EXISTING
*/30 * * * * bash $MESH_SCRIPTS/deacon-worker-sla.sh >> /tmp/deacon-sla.log 2>&1"
  CHANGED=true
  echo "  Installed cron: deacon-worker-sla.sh (*/30)"
fi

# Install deacon-worker-sla weekly cron (Monday 9am)
if echo "$EXISTING" | grep -qF "deacon-worker-sla.sh --weekly"; then
  echo "  Cron: deacon-worker-sla.sh --weekly already installed"
else
  EXISTING="$EXISTING
0 9 * * 1 bash $MESH_SCRIPTS/deacon-worker-sla.sh --weekly >> /tmp/deacon-sla.log 2>&1"
  CHANGED=true
  echo "  Installed cron: deacon-worker-sla.sh --weekly (Mon 9am)"
fi

if [ "$CHANGED" = true ]; then
  echo "$EXISTING" | crontab -
fi

# Register in cron-registry.yaml (append if not already present)
if [ -f "$CRON_REGISTRY" ]; then
  if ! grep -qF "deacon-worker-sla" "$CRON_REGISTRY"; then
    cat >> "$CRON_REGISTRY" << 'YAML'

  deacon-worker-sla:
    schedule: "*/30 * * * *"
    command: "bash $GT_ROOT/.gt-mesh/scripts/deacon-worker-sla.sh >> /tmp/deacon-sla.log 2>&1"
    owner: "gt-local"
    purpose: "Enforce Worker SLA: warn at 24h, unclaim at 30h, detect closed-issue commits"
    created: "2026-03-06"

  deacon-worker-sla-weekly:
    schedule: "0 9 * * 1"
    command: "bash $GT_ROOT/.gt-mesh/scripts/deacon-worker-sla.sh --weekly >> /tmp/deacon-sla.log 2>&1"
    owner: "gt-local"
    purpose: "Weekly worker scorecard: PRs, violations, avg claim-to-PR time"
    created: "2026-03-06"
YAML
    echo "  Registered in cron-registry.yaml"
  else
    echo "  Already in cron-registry.yaml"
  fi
fi

echo "Done."
