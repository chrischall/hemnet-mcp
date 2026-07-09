#!/usr/bin/env bash
#
# Apply the universal Claude-PR-review + auto-merge workflow set to a
# repo. Does NOT touch existing ci.yml, release.yml, etc. Adds:
#   - .github/workflows/pr-auto-review.yml  (Claude review with verdict + model ladder)
#   - .github/workflows/claude.yml           (ad-hoc @claude mention dispatch)
#   - .github/workflows/auto-merge.yml       (arms gh pr merge --auto on ready-to-merge)
#
# Idempotent: skips files that already exist on the target.
#
# Usage:
#   migrate-claude-review-only.sh /path/to/target-repo

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "usage: $0 /path/to/target-repo" >&2
  exit 1
fi

TARGET="$1"
SOURCE_REPO="/Users/chris/git/ofw-mcp"

if [ ! -d "$TARGET/.git" ]; then
  echo "error: $TARGET is not a git repo" >&2
  exit 1
fi

cd "$TARGET"
PKG_NAME=$(basename "$TARGET")
echo "Applying Claude review workflows to $PKG_NAME"

git fetch origin
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name 2>/dev/null || echo main)
git checkout "$DEFAULT_BRANCH"
git pull --ff-only origin "$DEFAULT_BRANCH"

BRANCH="ci/add-claude-pr-review"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "branch $BRANCH already exists locally — delete it first" >&2
  exit 1
fi
git switch -c "$BRANCH"

mkdir -p .github/workflows
copied_any=false
for wf in pr-auto-review.yml claude.yml auto-merge.yml; do
  if [ -f ".github/workflows/$wf" ]; then
    echo "  ✓ $wf already present, skipping"
  else
    cp "$SOURCE_REPO/.github/workflows/$wf" ".github/workflows/$wf"
    copied_any=true
    echo "  + $wf"
  fi
done

if ! $copied_any; then
  echo "Nothing to do — all three workflows already present"
  git switch -
  git branch -D "$BRANCH"
  exit 0
fi

git add -A
git commit -m "$(cat <<'COMMIT'
ci: add Claude PR review + auto-merge workflows

Mirrors ofw-mcp's universal AI review setup:
- pr-auto-review.yml — Claude reviews every same-repo non-bot PR with a
  JSON-schema-bound verdict (pass / warn / fail). Uses a Haiku/Sonnet/
  Opus ladder based on PR size, or `review-with-opus` label to force
  Opus. On `pass`, adds `ready-to-merge` via RELEASE_PAT.
- auto-merge.yml — arms `gh pr merge --auto` on dependabot PRs and on
  any PR with the `ready-to-merge` label.
- claude.yml — ad-hoc dispatch when @claude is mentioned in an issue
  or PR comment.

Required secrets (set separately if not already):
- CLAUDE_CODE_OAUTH_TOKEN — set via `set-claude-oauth-secret`
- RELEASE_PAT — for label-add events to fire downstream workflows

No release pipeline changes in this PR — that's per-repo and lives
elsewhere.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"

git push -u origin "$BRANCH"

gh pr create --base "$DEFAULT_BRANCH" --head "$BRANCH" \
  --title "ci: add Claude PR review + auto-merge workflows" \
  --body "Adds the universal AI review setup that's standard across the rest of the fleet.

## What this PR does
- \`pr-auto-review.yml\` — Claude reviews every same-repo non-bot PR with a JSON-schema verdict (\`pass\` / \`warn\` / \`fail\`). Uses a Haiku/Sonnet/Opus ladder based on PR size; the \`review-with-opus\` label forces Opus.
- \`auto-merge.yml\` — arms \`gh pr merge --auto\` on dependabot PRs and on any PR with the \`ready-to-merge\` label.
- \`claude.yml\` — ad-hoc dispatch when \`@claude\` is mentioned in an issue or PR comment.

## Before merging
- \`CLAUDE_CODE_OAUTH_TOKEN\` secret must be set on this repo
- \`RELEASE_PAT\` secret should already be set; if not, generate a PAT with \`repo\` scope and add as secret

## What this PR does NOT touch
- Existing \`ci.yml\` / release / deploy workflows are left alone. A separate release-please migration may come later if the repo's shape supports it."

echo
echo "✓ PR opened for $PKG_NAME"
