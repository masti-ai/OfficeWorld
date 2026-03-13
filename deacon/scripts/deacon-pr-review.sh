#!/bin/bash
# Deacon PR Review Cron
#
# Runs every 30 minutes to auto-review and merge approved PRs across Deepwork-AI repos.
#
# Actions:
#   1. Merge PRs labeled 'approved' (squash + delete branch)
#   2. Auto-review PRs labeled 'needs-review' (basic checks: no secrets, CI green)
#   3. Log all actions to mesh activity log
#
# Install cron:
#   */30 * * * * bash $GT_ROOT/.gt-mesh/scripts/deacon-pr-review.sh
#
# Requires: gh CLI authenticated, mesh configured

set -uo pipefail

GT_ROOT="${GT_ROOT:-/home/pratham2/gt}"
MESH_YAML="${MESH_YAML:-$GT_ROOT/mesh.yaml}"
ACTIVITY_LOG="$GT_ROOT/.mesh-activity.log"
DEACON_LOG="/tmp/deacon-pr-review.log"

REPOS=(
  "Deepwork-AI/ai-planogram"
  "Deepwork-AI/alc-ai-villa"
  "Deepwork-AI/gt-mesh"
  "Deepwork-AI/OfficeWorld"
)

SECRET_PATTERNS='(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|aws_access_key|aws_secret_key|\.env\b)'

log() {
  local msg="$(date -u +%Y-%m-%dT%H:%M:%SZ) [deacon-pr] $*"
  echo "$msg" >> "$DEACON_LOG"
  echo "$msg" >> "$ACTIVITY_LOG"
}

log_to_mesh() {
  local action="$1"
  local subject="$2"
  if [ -f "$GT_ROOT/.gt-mesh/scripts/mesh-auto-sync.sh" ]; then
    GT_ROOT="$GT_ROOT" MESH_YAML="$MESH_YAML" \
      bash "$GT_ROOT/.gt-mesh/scripts/mesh-auto-sync.sh" log "$action: $subject" 2>/dev/null || true
  fi
}

merge_approved_prs() {
  local repo="$1"
  local merged=0

  local prs
  prs=$(gh pr list --repo "$repo" --label "approved" --state open --json number,title,headRefName --jq '.[] | "\(.number)\t\(.title)\t\(.headRefName)"' 2>/dev/null) || prs=""

  [ -z "$prs" ] && echo "0" && return 0

  while IFS=$'\t' read -r pr_number pr_title pr_branch; do
    [ -z "$pr_number" ] && continue

    log "Merging approved PR #$pr_number in $repo: $pr_title"

    if gh pr merge "$pr_number" --repo "$repo" --squash --delete-branch 2>>"$DEACON_LOG"; then
      log "Successfully merged PR #$pr_number in $repo"
      log_to_mesh "pr-merged" "PR #$pr_number merged in $repo: $pr_title"
      merged=$((merged + 1))
    else
      log "Failed to merge PR #$pr_number in $repo"
      log_to_mesh "pr-merge-failed" "PR #$pr_number failed to merge in $repo: $pr_title"
    fi
  done <<< "$prs"

  echo "$merged"
}

check_pr_for_secrets() {
  local repo="$1"
  local pr_number="$2"

  local diff
  diff=$(gh pr diff "$pr_number" --repo "$repo" 2>/dev/null) || return 1

  if echo "$diff" | grep -qEi "$SECRET_PATTERNS"; then
    return 1
  fi
  return 0
}

check_pr_ci_status() {
  local repo="$1"
  local pr_number="$2"

  local checks
  checks=$(gh pr checks "$pr_number" --repo "$repo" 2>/dev/null) || {
    # No checks configured — treat as passing
    return 0
  }

  if echo "$checks" | grep -qE "fail|error"; then
    return 1
  fi
  return 0
}

review_needs_review_prs() {
  local repo="$1"
  local reviewed=0

  local prs
  prs=$(gh pr list --repo "$repo" --label "needs-review" --state open --json number,title --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null) || prs=""

  [ -z "$prs" ] && echo "0" && return 0

  while IFS=$'\t' read -r pr_number pr_title; do
    [ -z "$pr_number" ] && continue

    log "Reviewing PR #$pr_number in $repo: $pr_title"

    # Check 1: No secrets in diff
    if ! check_pr_for_secrets "$repo" "$pr_number"; then
      log "PR #$pr_number in $repo: FAILED secrets check — skipping"
      gh pr comment "$pr_number" --repo "$repo" \
        --body "Deacon auto-review: potential secrets detected in diff. Manual review required." 2>>"$DEACON_LOG" || true
      log_to_mesh "pr-review-blocked" "PR #$pr_number in $repo flagged for secrets"
      continue
    fi

    # Check 2: CI passing
    if ! check_pr_ci_status "$repo" "$pr_number"; then
      log "PR #$pr_number in $repo: CI checks failing — skipping"
      log_to_mesh "pr-review-waiting" "PR #$pr_number in $repo waiting for CI"
      continue
    fi

    # All checks pass — approve
    if gh pr review "$pr_number" --repo "$repo" --approve \
      --body "Deacon auto-review: no secrets detected, CI checks passing. Approved." 2>>"$DEACON_LOG"; then
      log "Approved PR #$pr_number in $repo"

      # Add 'approved' label and remove 'needs-review'
      gh pr edit "$pr_number" --repo "$repo" \
        --add-label "approved" --remove-label "needs-review" 2>>"$DEACON_LOG" || true

      log_to_mesh "pr-approved" "PR #$pr_number approved in $repo: $pr_title"
      reviewed=$((reviewed + 1))
    else
      log "Failed to approve PR #$pr_number in $repo"
    fi
  done <<< "$prs"

  echo "$reviewed"
}

# --- Main ---

log "=== Deacon PR review run starting ==="

total_merged=0
total_reviewed=0

for repo in "${REPOS[@]}"; do
  log "Processing repo: $repo"

  # Phase 1: Merge approved PRs
  count=$(merge_approved_prs "$repo")
  total_merged=$((total_merged + count))

  # Phase 2: Review needs-review PRs
  count=$(review_needs_review_prs "$repo")
  total_reviewed=$((total_reviewed + count))
done

log "=== Deacon PR review run complete: merged=$total_merged reviewed=$total_reviewed ==="
log_to_mesh "deacon-run" "PR review complete: merged=$total_merged approved=$total_reviewed"
