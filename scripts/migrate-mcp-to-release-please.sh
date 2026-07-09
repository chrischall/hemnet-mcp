#!/usr/bin/env bash
#
# Migrate a TypeScript MCP-server repo to the same release-please +
# Claude PR-review + auto-merge shape as ofw-mcp.
#
# Adapts to each repo's actual structure: the generated
# release-please-config.json's `extra-files` list only includes the
# files that exist in the target repo.
#
# Usage:
#   migrate-mcp-to-release-please.sh /path/to/target-repo
#
# Effects:
#   - Reads the target repo's package.json for name + current version
#   - Generates release-please-config.json (tailored to which manifest
#     files exist) and .release-please-manifest.json (current version)
#   - Copies the canonical workflow files from ofw-mcp:
#       .github/workflows/{release-please,pr-auto-review,claude,auto-merge}.yml
#     ci.yml is left alone if present (each repo has its own test setup);
#     created only if missing.
#   - Deletes superseded workflow files: tag-and-bump.yml, release.yml,
#     tag-on-release-merge.yml (each only if they exist)
#   - Adds the `// x-release-please-version` sentinel comment to
#     src/index.ts on the line containing `version: '...'`
#   - Creates a feature branch, commits, pushes, opens PR with `ci` label
#
# Idempotent re-runs: if a release-please-config.json already exists,
# the script aborts so it doesn't clobber an in-progress migration.

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

if [ -f "$TARGET/release-please-config.json" ]; then
  echo "$TARGET already has release-please-config.json — skipping" >&2
  exit 0
fi

cd "$TARGET"

PKG_NAME=$(node -p "require('./package.json').name")
PKG_VERSION=$(node -p "require('./package.json').version")

if [ -z "$PKG_NAME" ] || [ "$PKG_NAME" = "null" ]; then
  echo "error: package.json has no .name field (monorepo?)" >&2
  exit 1
fi

echo "Migrating $PKG_NAME @ $PKG_VERSION"

# Make sure we're working from a clean main
git fetch origin
git checkout main
git pull --ff-only origin main

BRANCH="chore/migrate-to-release-please"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "branch $BRANCH already exists locally — delete it first" >&2
  exit 1
fi
git switch -c "$BRANCH"

# ── Build extra-files list based on which manifest files exist ──
EXTRA_FILES_ARR=()
for f_jsonpath in \
    "manifest.json:$.version" \
    "server.json:$.version" \
    "server.json:$.packages[*].version" \
    ".claude-plugin/plugin.json:$.version" \
    ".claude-plugin/marketplace.json:$.plugins[*].version" \
    ".claude-plugin/marketplace.json:$.metadata.version"; do
  path="${f_jsonpath%:*}"
  jsonpath="${f_jsonpath##*:}"
  if [ -e "$path" ]; then
    EXTRA_FILES_ARR+=("{\"type\":\"json\",\"path\":\"${path}\",\"jsonpath\":\"${jsonpath}\"}")
  fi
done
# src/index.ts as a generic file (sentinel comment is added below)
if [ -e "src/index.ts" ]; then
  EXTRA_FILES_ARR+=("\"src/index.ts\"")
fi

# Join array with commas
EXTRA_FILES=$(IFS=,; echo "${EXTRA_FILES_ARR[*]}")

cat > release-please-config.json <<EOF
{
  "\$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "package-name": "${PKG_NAME}",
      "release-type": "node",
      "include-v-in-tag": true,
      "include-component-in-tag": false,
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" },
        { "type": "revert", "section": "Reverts" },
        { "type": "refactor", "section": "Refactor" },
        { "type": "docs", "section": "Documentation" },
        { "type": "test", "section": "Tests", "hidden": true },
        { "type": "build", "section": "Build", "hidden": true },
        { "type": "ci", "section": "CI", "hidden": true },
        { "type": "chore", "section": "Chores", "hidden": true }
      ],
      "extra-files": [${EXTRA_FILES}]
    }
  }
}
EOF
# Round-trip through jq for canonical formatting
jq . release-please-config.json > /tmp/rpc.json && mv /tmp/rpc.json release-please-config.json

cat > .release-please-manifest.json <<EOF
{
  ".": "${PKG_VERSION}"
}
EOF

# ── Add the x-release-please-version sentinel to src/index.ts ──
# BSD sed (macOS) doesn't recognize \s — use [[:space:]] instead.
if [ -f src/index.ts ] && ! grep -q "x-release-please-version" src/index.ts; then
  if grep -qE "version:[[:space:]]*['\"][0-9.]+['\"]" src/index.ts; then
    sed -i.bak -E "/version:[[:space:]]*['\"][0-9.]+['\"]/{s|$| // x-release-please-version|;}" src/index.ts
    rm -f src/index.ts.bak
  fi
fi

# ── Copy canonical workflow files from ofw-mcp ──
mkdir -p .github/workflows
for wf in release-please.yml pr-auto-review.yml claude.yml auto-merge.yml; do
  cp "$SOURCE_REPO/.github/workflows/$wf" ".github/workflows/$wf"
done

# ci.yml: keep existing if present; copy ofw-mcp's only if absent
if [ ! -f .github/workflows/ci.yml ]; then
  cp "$SOURCE_REPO/.github/workflows/ci.yml" .github/workflows/ci.yml
fi

# ── Delete superseded workflows ──
for stale in tag-and-bump.yml release.yml tag-on-release-merge.yml; do
  [ -f ".github/workflows/$stale" ] && rm ".github/workflows/$stale"
done

# ── Commit + push + PR ──
git add -A
git commit -m "$(cat <<'COMMIT'
chore: migrate release pipeline to release-please

Replaces tag-and-bump + release.yml with the canonical release-please
single-workflow shape, mirrored from ofw-mcp. Same end-to-end shape
(PR → CI green → manual ready-to-merge → tag → publish) but standard,
off-the-shelf, and debuggable.

Conventional-commit PR titles drive the next version: fix → patch,
feat → minor, feat! / BREAKING CHANGE → major.

Files added:
- release-please-config.json   (packages + extra-files matched to this repo's structure)
- .release-please-manifest.json ({".": current-version})
- .github/workflows/release-please.yml  (runs on push to main; opens release PR; publish job runs on release_created)
- .github/workflows/pr-auto-review.yml  (Claude review with structured verdict + Sonnet/Haiku/Opus ladder)
- .github/workflows/auto-merge.yml       (arms gh pr merge --auto on ready-to-merge)
- .github/workflows/claude.yml           (ad-hoc @claude mention dispatch)

Files deleted:
- .github/workflows/tag-and-bump.yml
- .github/workflows/release.yml
- .github/workflows/tag-on-release-merge.yml (if present)

src/index.ts gains the // x-release-please-version sentinel comment so
release-please can find and bump the version literal.

Required secrets (set separately):
- CLAUDE_CODE_OAUTH_TOKEN  (for Claude PR review + ad-hoc; user's Max plan)
- RELEASE_PAT             (for release-please + auto-merge to fire downstream workflows)
- CLAWHUB_TOKEN           (optional — publish skill to ClawHub)

Required external config (set separately):
- npm Trusted Publishers — point at .github/workflows/release-please.yml
  (or fall back to NPM_TOKEN auth in the publish job)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT
)"

git push -u origin "$BRANCH"

# --label ci would fail on repos without the label; release-please writes
# its own CHANGELOG from commit prefixes, so labels don't matter anymore.
gh pr create --base main --head "$BRANCH" \
  --title "chore: migrate release pipeline to release-please" \
  --body "Same migration as chrischall/ofw-mcp#33. See that PR for the design rationale and discussion.

## What this PR does

- Replaces \`tag-and-bump\` + \`release.yml\` with the canonical release-please single-workflow shape
- Conventional-commit PR titles drive the next version (\`fix:\` → patch, \`feat:\` → minor, \`feat!:\` / \`BREAKING CHANGE\` → major)
- Release PR sits open as a human review gate (add \`ready-to-merge\` when you want to ship)
- PR auto-review uses Claude with a JSON-schema-bound verdict + Haiku/Sonnet/Opus ladder by PR size
- Auth via Claude Max OAuth token (CLAUDE_CODE_OAUTH_TOKEN) instead of pay-per-token API key

## Before merging

1. \`CLAUDE_CODE_OAUTH_TOKEN\` secret must be set on this repo (use \`set-claude-oauth-secret\` from chris's bin)
2. npm Trusted Publishers config must point at \`.github/workflows/release-please.yml\` (update via npmjs.com/package/${PKG_NAME}/access), OR switch the workflow to NPM_TOKEN auth

## Test plan

After merge, release-please will scan commits since the last tag and open a release PR. If that PR's CHANGELOG and version bumps look right, add \`ready-to-merge\` to ship the first release-please release."

echo
echo "✓ Migration PR opened for $PKG_NAME"
