#!/bin/bash
# cron-audit.sh — Verify crontab matches cron-registry.yaml
#
# Reads the cron registry and compares against the actual crontab.
# Reports mismatches. With --enforce, fixes them.
#
# Usage:
#   cron-audit.sh              # Report only
#   cron-audit.sh --enforce    # Fix mismatches (add missing, remove unregistered)
#
# Install as daily cron (registered in cron-registry.yaml):
#   0 6 * * * bash $GT_ROOT/.gt-mesh/scripts/cron-audit.sh --enforce >> /tmp/cron-audit.log 2>&1

set -euo pipefail

GT_ROOT="${GT_ROOT:-/home/pratham2/gt}"
REGISTRY="${GT_ROOT}/.gt-mesh/cron-registry.yaml"
ENFORCE=false
EXIT_CODE=0

[ "${1:-}" = "--enforce" ] && ENFORCE=true

# --- helpers ---

log_info()  { echo "[cron-audit] INFO:  $*"; }
log_warn()  { echo "[cron-audit] WARN:  $*"; }
log_ok()    { echo "[cron-audit] OK:    $*"; }
log_fix()   { echo "[cron-audit] FIX:   $*"; }

# Strip surrounding quotes from a value
strip_quotes() {
  local val="$1"
  val="${val#\"}"
  val="${val%\"}"
  val="${val#\'}"
  val="${val%\'}"
  echo "$val"
}

# --- preflight ---

if [ ! -f "$REGISTRY" ]; then
  echo "[cron-audit] ERROR: Registry not found at $REGISTRY" >&2
  exit 1
fi

# --- parse registry (no yq needed) ---

# Parse the simple YAML structure:
#   crons:
#     name:
#       schedule: "..."
#       command: "..."

REGISTRY_NAMES=()
declare -A REGISTRY_SCHEDULES
declare -A REGISTRY_COMMANDS

current_name=""
while IFS= read -r line; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue

  # Top-level "crons:" — skip
  [[ "$line" =~ ^crons: ]] && continue

  # Cron entry name (2-space indent, ends with colon, no further value)
  if [[ "$line" =~ ^[[:space:]][[:space:]][a-zA-Z] ]] && [[ "$line" =~ :$ ]]; then
    current_name=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/:$//')
    continue
  fi

  # Property lines (4-space indent)
  if [[ -n "$current_name" ]] && [[ "$line" =~ ^[[:space:]]{4}[a-z] ]]; then
    key=$(echo "$line" | sed 's/^[[:space:]]*//' | cut -d: -f1)
    value=$(echo "$line" | sed "s/^[[:space:]]*${key}:[[:space:]]*//" )
    value=$(strip_quotes "$value")

    case "$key" in
      schedule) REGISTRY_SCHEDULES["$current_name"]="$value" ;;
      command)  REGISTRY_COMMANDS["$current_name"]="$value" ;;
    esac
  fi
done < "$REGISTRY"

# Build names list from entries that have both schedule and command
for name in "${!REGISTRY_SCHEDULES[@]}"; do
  if [[ -n "${REGISTRY_COMMANDS[$name]:-}" ]]; then
    REGISTRY_NAMES+=("$name")
  fi
done

# Sort names for consistent output
IFS=$'\n' REGISTRY_NAMES=($(sort <<<"${REGISTRY_NAMES[*]}")); unset IFS

# --- read crontab ---

CURRENT_CRONTAB=$(crontab -l 2>/dev/null || echo "")

# Build array of actual cron lines (skip comments and blanks)
CRONTAB_LINES=()
while IFS= read -r line; do
  line=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
  [ -z "$line" ] && continue
  [[ "$line" == \#* ]] && continue
  CRONTAB_LINES+=("$line")
done <<< "$CURRENT_CRONTAB"

# --- audit: registry → crontab (missing crons) ---

log_info "=== Cron Audit Report ==="
log_info "Registry: $REGISTRY"
log_info "Registered crons: ${#REGISTRY_NAMES[@]}"
log_info "Crontab entries:  ${#CRONTAB_LINES[@]}"
echo ""

MISSING_CRONS=()
for name in "${REGISTRY_NAMES[@]}"; do
  schedule="${REGISTRY_SCHEDULES[$name]}"
  command="${REGISTRY_COMMANDS[$name]}"
  expected_line="${schedule} ${command}"

  found=false
  for cron_line in "${CRONTAB_LINES[@]}"; do
    if [ "$cron_line" = "$expected_line" ]; then
      found=true
      break
    fi
  done

  if $found; then
    log_ok "$name — present in crontab"
  else
    log_warn "$name — MISSING from crontab"
    log_warn "  Expected: $expected_line"
    MISSING_CRONS+=("$expected_line")
    EXIT_CODE=1
  fi
done

# --- audit: crontab → registry (unregistered crons) ---

echo ""
UNREGISTERED_LINES=()
for cron_line in "${CRONTAB_LINES[@]}"; do
  matched=false
  for name in "${REGISTRY_NAMES[@]}"; do
    schedule="${REGISTRY_SCHEDULES[$name]}"
    command="${REGISTRY_COMMANDS[$name]}"
    expected_line="${schedule} ${command}"
    if [ "$cron_line" = "$expected_line" ]; then
      matched=true
      break
    fi
  done

  if ! $matched; then
    log_warn "UNREGISTERED cron in crontab:"
    log_warn "  $cron_line"
    UNREGISTERED_LINES+=("$cron_line")
    EXIT_CODE=1
  fi
done

if [ ${#UNREGISTERED_LINES[@]} -eq 0 ]; then
  log_ok "No unregistered crons found"
fi

# --- enforce mode ---

echo ""
if $ENFORCE && [ $EXIT_CODE -ne 0 ]; then
  log_info "=== Enforce Mode ==="

  NEW_CRONTAB="$CURRENT_CRONTAB"

  # Remove unregistered crons
  for unreg in "${UNREGISTERED_LINES[@]}"; do
    log_fix "Removing unregistered: $unreg"
    NEW_CRONTAB=$(echo "$NEW_CRONTAB" | grep -vF "$unreg" || true)
  done

  # Add missing crons
  for missing in "${MISSING_CRONS[@]}"; do
    log_fix "Installing missing: $missing"
    NEW_CRONTAB="${NEW_CRONTAB}
${missing}"
  done

  # Clean up blank lines
  NEW_CRONTAB=$(echo "$NEW_CRONTAB" | sed '/^$/d')

  # Install
  echo "$NEW_CRONTAB" | crontab -
  log_info "Crontab updated. New contents:"
  crontab -l
  EXIT_CODE=0
elif $ENFORCE; then
  log_info "=== Enforce Mode ==="
  log_ok "Nothing to fix — crontab matches registry"
elif [ $EXIT_CODE -ne 0 ]; then
  log_info "Run with --enforce to fix mismatches"
fi

echo ""
log_info "=== Audit Complete ==="
exit $EXIT_CODE
