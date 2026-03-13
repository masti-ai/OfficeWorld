#!/bin/bash
# Deacon Worker SLA Enforcement
#
# Runs every 30 minutes to enforce Worker SLA rules:
#   1. Check claimed issues for SLA violations (24h warning, 30h unclaim)
#   2. Detect commits to closed issues
#   3. Weekly worker scorecard (--weekly flag, cron every Monday 9am)
#
# Install cron:
#   */30 * * * * bash $GT_ROOT/.gt-mesh/scripts/deacon-worker-sla.sh >> /tmp/deacon-sla.log 2>&1
#   0 9 * * 1 bash $GT_ROOT/.gt-mesh/scripts/deacon-worker-sla.sh --weekly >> /tmp/deacon-sla.log 2>&1
#
# Requires: gh CLI authenticated, mesh configured

set -uo pipefail

GT_ROOT="${GT_ROOT:-/home/pratham2/gt}"
MESH_YAML="${MESH_YAML:-$GT_ROOT/mesh.yaml}"
ACTIVITY_LOG="$GT_ROOT/.mesh-activity.log"
DEACON_LOG="/tmp/deacon-sla.log"

REPOS=(
  "Deepwork-AI/ai-planogram"
  "Deepwork-AI/alc-ai-villa"
  "Deepwork-AI/gt-mesh"
  "Deepwork-AI/OfficeWorld"
)

WEEKLY_MODE=false
[ "${1:-}" = "--weekly" ] && WEEKLY_MODE=true

log() {
  local msg="$(date -u +%Y-%m-%dT%H:%M:%SZ) [deacon-sla] $*"
  echo "$msg" >> "$DEACON_LOG"
  echo "$msg" >> "$ACTIVITY_LOG"
}

send_mesh_mail() {
  local subject="$1"
  local body="$2"
  if command -v gt &>/dev/null; then
    gt mail send mayor/ -s "$subject" --stdin <<< "$body" 2>/dev/null || true
  fi
}

log_to_mesh() {
  local action="$1"
  local subject="$2"
  if [ -f "$GT_ROOT/.gt-mesh/scripts/mesh-auto-sync.sh" ]; then
    GT_ROOT="$GT_ROOT" MESH_YAML="$MESH_YAML" \
      bash "$GT_ROOT/.gt-mesh/scripts/mesh-auto-sync.sh" log "$action: $subject" 2>/dev/null || true
  fi
}

# Get the timestamp when gt-status:claimed was added to an issue
get_claimed_at() {
  local repo="$1"
  local issue_number="$2"

  local claimed_at
  claimed_at=$(gh api "repos/$repo/issues/$issue_number/timeline" --paginate \
    --jq '[.[] | select(.event == "labeled" and .label.name == "gt-status:claimed")] | last | .created_at' \
    2>/dev/null) || return 1

  [ -z "$claimed_at" ] || [ "$claimed_at" = "null" ] && return 1
  echo "$claimed_at"
}

# Get the worker assigned to an issue (from gt-to: label)
get_worker() {
  local repo="$1"
  local issue_number="$2"

  gh api "repos/$repo/issues/$issue_number/labels" \
    --jq '.[] | select(.name | startswith("gt-to:")) | .name | sub("gt-to:"; "")' \
    2>/dev/null | head -1
}

# Check if there's a branch with commits for this issue
has_branch_activity() {
  local repo="$1"
  local issue_number="$2"

  local branches
  branches=$(gh api "repos/$repo/branches" --paginate \
    --jq ".[].name | select(contains(\"$issue_number\"))" \
    2>/dev/null) || branches=""

  [ -n "$branches" ]
}

# Check if there's a PR for this issue
has_pr() {
  local repo="$1"
  local issue_number="$2"

  local pr_count
  pr_count=$(gh pr list --repo "$repo" --state all \
    --search "$issue_number" \
    --json number --jq 'length' 2>/dev/null) || pr_count=0

  [ "$pr_count" -gt 0 ]
}

# Calculate hours elapsed since a timestamp
hours_since() {
  local timestamp="$1"
  local then_epoch
  then_epoch=$(date -d "$timestamp" +%s 2>/dev/null) || return 1
  local now_epoch
  now_epoch=$(date +%s)
  echo $(( (now_epoch - then_epoch) / 3600 ))
}

# Check if a comment with specific text already exists (prevent duplicate warnings)
has_comment_matching() {
  local repo="$1"
  local issue_number="$2"
  local pattern="$3"

  local count
  count=$(gh api "repos/$repo/issues/$issue_number/comments" \
    --jq "[.[] | select(.body | test(\"$pattern\"))] | length" \
    2>/dev/null) || count=0

  [ "$count" -gt 0 ]
}

# --- Phase 1: Check claimed issues for SLA violations ---

check_claimed_issues() {
  local repo="$1"
  local warnings=0
  local violations=0

  local issues
  issues=$(gh issue list --repo "$repo" --label "gt-status:claimed" --state open \
    --json number,title --jq '.[] | "\(.number)\t\(.title)"' 2>/dev/null) || issues=""

  [ -z "$issues" ] && return 0

  while IFS=$'\t' read -r issue_number issue_title; do
    [ -z "$issue_number" ] && continue

    local claimed_at
    claimed_at=$(get_claimed_at "$repo" "$issue_number") || continue

    local hours
    hours=$(hours_since "$claimed_at") || continue

    local worker
    worker=$(get_worker "$repo" "$issue_number")
    worker="${worker:-unknown}"

    if [ "$hours" -ge 30 ]; then
      # 30h+ with no PR: SLA VIOLATION — unclaim and escalate
      if ! has_pr "$repo" "$issue_number"; then
        log "SLA VIOLATION: #$issue_number in $repo claimed by $worker for ${hours}h with no PR"

        gh issue edit "$issue_number" --repo "$repo" \
          --remove-label "gt-status:claimed" --add-label "gt-status:pending" 2>>"$DEACON_LOG" || true

        gh issue comment "$issue_number" --repo "$repo" \
          --body "**SLA VIOLATION:** Claimed by \`$worker\` for ${hours}h with no PR submitted. Issue unclaimed and returned to pending." \
          2>>"$DEACON_LOG" || true

        send_mesh_mail "SLA VIOLATION: $worker on #$issue_number" \
          "Worker $worker claimed issue #$issue_number ($issue_title) in $repo ${hours}h ago with no PR. Issue has been unclaimed and returned to pending."

        log_to_mesh "sla-violation" "$worker: #$issue_number in $repo (${hours}h, no PR)"
        violations=$((violations + 1))
      fi
    elif [ "$hours" -ge 24 ]; then
      # 24h+ with no branch activity: WARNING
      if ! has_branch_activity "$repo" "$issue_number"; then
        if ! has_comment_matching "$repo" "$issue_number" "SLA WARNING"; then
          log "SLA WARNING: #$issue_number in $repo claimed by $worker for ${hours}h with no activity"

          gh issue comment "$issue_number" --repo "$repo" \
            --body "**SLA WARNING:** No branch activity detected in ${hours}h since claim. Issue will be unclaimed in 6h if no progress is made." \
            2>>"$DEACON_LOG" || true

          log_to_mesh "sla-warning" "$worker: #$issue_number in $repo (${hours}h, no activity)"
          warnings=$((warnings + 1))
        fi
      fi
    fi
  done <<< "$issues"

  log "  $repo: $warnings warnings, $violations violations"
}

# --- Phase 2: Check for commits to closed issues ---

check_closed_issues() {
  local repo="$1"
  local violations=0

  local issues
  issues=$(gh issue list --repo "$repo" --label "gt-to:gt-docker" --state closed \
    --json number,title,closedAt --jq '.[] | "\(.number)\t\(.title)\t\(.closedAt)"' \
    2>/dev/null) || issues=""

  [ -z "$issues" ] && return 0

  while IFS=$'\t' read -r issue_number issue_title closed_at; do
    [ -z "$issue_number" ] && continue

    local closed_epoch
    closed_epoch=$(date -d "$closed_at" +%s 2>/dev/null) || continue

    # Check for branches matching this issue
    local branches
    branches=$(gh api "repos/$repo/branches" --paginate \
      --jq ".[].name | select(contains(\"$issue_number\"))" \
      2>/dev/null) || continue

    [ -z "$branches" ] && continue

    while IFS= read -r branch; do
      [ -z "$branch" ] && continue

      local latest_commit_date
      latest_commit_date=$(gh api "repos/$repo/commits?sha=$branch&per_page=1" \
        --jq '.[0].commit.committer.date' 2>/dev/null) || continue

      [ -z "$latest_commit_date" ] || [ "$latest_commit_date" = "null" ] && continue

      local commit_epoch
      commit_epoch=$(date -d "$latest_commit_date" +%s 2>/dev/null) || continue

      if [ "$commit_epoch" -gt "$closed_epoch" ]; then
        local worker
        worker=$(get_worker "$repo" "$issue_number")
        worker="${worker:-unknown}"

        log "CLOSED ISSUE VIOLATION: Commits on branch '$branch' after #$issue_number was closed in $repo"

        if ! has_comment_matching "$repo" "$issue_number" "CLOSED ISSUE VIOLATION"; then
          gh issue comment "$issue_number" --repo "$repo" \
            --body "**CLOSED ISSUE VIOLATION:** Commits detected on branch \`$branch\` after this issue was closed. All work must stop on closed issues immediately." \
            2>>"$DEACON_LOG" || true
        fi

        send_mesh_mail "CLOSED ISSUE VIOLATION: $worker on #$issue_number" \
          "Commits detected on branch '$branch' after issue #$issue_number ($issue_title) was closed in $repo. Worker: $worker."

        log_to_mesh "closed-issue-violation" "$worker: #$issue_number in $repo (branch: $branch)"
        violations=$((violations + 1))
      fi
    done <<< "$branches"
  done <<< "$issues"

  log "  $repo: $violations closed-issue violations"
}

# --- Phase 3: Weekly summary ---

generate_weekly_summary() {
  log "=== Generating weekly summary ==="

  local summary="Worker SLA Weekly Summary"
  summary+="\nGenerated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  summary+="\n"

  for repo in "${REPOS[@]}"; do
    summary+="\n--- $repo ---\n"

    # Count PRs per worker in last 7 days
    local since_date
    since_date=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null) || since_date=""

    local prs=""
    if [ -n "$since_date" ]; then
      prs=$(gh pr list --repo "$repo" --state all \
        --search "created:>=$since_date" \
        --json author,number,state \
        --jq '.[] | .author.login' \
        2>/dev/null) || prs=""
    fi

    if [ -n "$prs" ]; then
      summary+="\nPRs (last 7 days):\n"
      local authors
      authors=$(echo "$prs" | sort | uniq -c | sort -rn)
      while IFS= read -r line; do
        [ -z "$line" ] && continue
        summary+="  $line\n"
      done <<< "$authors"
    else
      summary+="\nPRs (last 7 days): none\n"
    fi

    # Count violations from deacon log
    local violation_count=0
    local closed_violation_count=0
    if [ -f "$DEACON_LOG" ]; then
      violation_count=$(grep -c "SLA VIOLATION.*$repo" "$DEACON_LOG" 2>/dev/null || echo "0")
      closed_violation_count=$(grep -c "CLOSED ISSUE VIOLATION.*$repo" "$DEACON_LOG" 2>/dev/null || echo "0")
    fi

    summary+="\nViolations:\n"
    summary+="  SLA violations: $violation_count\n"
    summary+="  Closed issue violations: $closed_violation_count\n"

    # Average claim-to-PR time
    local claimed_issues=""
    if [ -n "$since_date" ]; then
      claimed_issues=$(gh issue list --repo "$repo" --label "gt-status:done" --state all \
        --search "created:>=$since_date" \
        --json number --jq '.[].number' 2>/dev/null) || claimed_issues=""
    fi

    local total_hours=0
    local count=0

    if [ -n "$claimed_issues" ]; then
      while IFS= read -r issue_num; do
        [ -z "$issue_num" ] && continue

        local claimed_at
        claimed_at=$(get_claimed_at "$repo" "$issue_num") || continue

        local done_at
        done_at=$(gh api "repos/$repo/issues/$issue_num/timeline" --paginate \
          --jq '[.[] | select(.event == "labeled" and .label.name == "gt-status:done")] | last | .created_at' \
          2>/dev/null) || continue

        [ -z "$done_at" ] || [ "$done_at" = "null" ] && continue

        local claim_epoch done_epoch
        claim_epoch=$(date -d "$claimed_at" +%s 2>/dev/null) || continue
        done_epoch=$(date -d "$done_at" +%s 2>/dev/null) || continue

        local hours=$(( (done_epoch - claim_epoch) / 3600 ))
        total_hours=$((total_hours + hours))
        count=$((count + 1))
      done <<< "$claimed_issues"
    fi

    if [ "$count" -gt 0 ]; then
      local avg=$((total_hours / count))
      summary+="\nAvg claim-to-PR time: ${avg}h (from $count issues)\n"
    else
      summary+="\nAvg claim-to-PR time: no data\n"
    fi
  done

  send_mesh_mail "Weekly Worker SLA Summary" "$(echo -e "$summary")"
  log_to_mesh "weekly-summary" "Worker SLA weekly summary generated"
  log "Weekly summary sent to Mayor"
}

# --- Main ---

if [ "$WEEKLY_MODE" = true ]; then
  generate_weekly_summary
  exit 0
fi

log "=== Deacon SLA enforcement run starting ==="

for repo in "${REPOS[@]}"; do
  log "Processing repo: $repo"
  check_claimed_issues "$repo"
  check_closed_issues "$repo"
done

log "=== Deacon SLA enforcement run complete ==="
