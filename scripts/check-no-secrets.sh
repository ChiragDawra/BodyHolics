#!/usr/bin/env bash
# M0-T7 / docs/08 §4 — fail the build if a server-only secret leaked into a
# committed file or a built client bundle.
#
# Three tiers:
#   1. server-only env identifiers used outside supabase/functions/ (hard rule 3)
#   2. literal secret material, including base64 JWTs whose payload says service_role
#   3. a secret re-exported under a client-visible EXPO_PUBLIC_/NEXT_PUBLIC_ name
#
# Usage: bash scripts/check-no-secrets.sh [extra-path ...]
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORBIDDEN='SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|EXPO_ACCESS_TOKEN'

# `service_role` is a legitimate Postgres role name in migrations and a
# legitimate env read inside Edge Functions, so those two trees are exempt from
# the literal scan — but from nothing else.
EXCLUDES=(
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.expo
  --exclude-dir=.turbo --exclude-dir=.git --exclude-dir=dist
  --exclude-dir=coverage --exclude-dir=.pnpm-store --exclude-dir=graphify-out
  --exclude-dir=.temp
  --exclude=pnpm-lock.yaml --exclude=check-no-secrets.sh
  # This file *is* the denylist: eslint/base.js names the forbidden identifiers
  # so that importing them fails lint. Flagging it would mean the only way to
  # pass the check is to delete the rule that enforces it.
  --exclude=base.js
)
# Prose in docs/ names these identifiers on purpose; tier 3 still decodes any
# real key material that lands in a markdown file.
LITERAL_EXCLUDES=("${EXCLUDES[@]}" --exclude-dir=migrations --exclude-dir=functions
  --exclude-dir=gym-app-docs --exclude-dir=docs
  --exclude='*.md' --exclude=.env.example --exclude=scan-jwt-roles.mjs)

SCAN_PATHS=(apps packages scripts supabase/migrations supabase/seed "$@")

fail=0
report() { printf '\033[31mSECRET LEAK\033[0m  %s\n' "$1"; fail=1; }

# The rule is "a secret must not be COMMITTED". A file git ignores is where a
# local key is supposed to live — .env.local, supabase/.temp — so a hit there is
# not a leak. Filter grep's `path:line:text` output by whether git tracks it.
# Paths named on the command line are build output — `.next`, an Expo bundle —
# which is precisely what docs/08 §4 asks CI to scan. They are gitignored by
# definition, so they must survive the filter below or the most valuable check
# here silently passes.
EXPLICIT_PATHS=("$@")

drop_ignored() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then cat; return; fi
  while IFS= read -r line; do
    file="${line%%:*}"
    keep=0
    for explicit in ${EXPLICIT_PATHS+"${EXPLICIT_PATHS[@]}"}; do
      case "$file" in
        "$explicit"*|"./$explicit"*) keep=1; break ;;
      esac
    done
    if [ "$keep" -eq 1 ]; then
      printf '%s\n' "$line"
    else
      # The rule is "a secret must not be COMMITTED". A file git ignores is
      # where a local key is supposed to live — .env.local, supabase/.temp.
      git check-ignore -q "$file" 2>/dev/null || printf '%s\n' "$line"
    fi
  done
}

echo "==> [1/4] server-only identifiers outside supabase/functions/"
for p in "${SCAN_PATHS[@]}"; do
  [ -e "$p" ] || continue
  while IFS= read -r hit; do report "$hit"; done \
    < <(grep -rInE "$FORBIDDEN" "${EXCLUDES[@]}" "$p" 2>/dev/null | drop_ignored)
done

echo "==> [2/4] literal secret material (plaintext)"
# The bare word `service_role` is not secret material — it is a Postgres role
# name that legitimately appears in grants, policies, comments and config. What
# matters is a real key, which is either a recognisable prefix (below) or a JWT,
# and tier 3 decodes those properly. Matching the word here only produced noise,
# and a check that always fails is a check nobody runs.
while IFS= read -r hit; do report "$hit"; done \
  < <(grep -rInE 'rzp_live_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9_-]{8,}' \
      "${LITERAL_EXCLUDES[@]}" . ${EXPLICIT_PATHS+"${EXPLICIT_PATHS[@]}"} 2>/dev/null | drop_ignored)

echo "==> [3/4] base64 JWTs whose payload claims a privileged role"
while IFS= read -r hit; do report "$hit"; done < <(node scripts/scan-jwt-roles.mjs ${EXPLICIT_PATHS+"${EXPLICIT_PATHS[@]}"} 2>/dev/null | drop_ignored)

echo "==> [4/4] secrets re-exported under a client-visible name"
while IFS= read -r hit; do report "$hit"; done \
  < <(grep -rInE '(EXPO_PUBLIC|NEXT_PUBLIC)_[A-Z_]*(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD)' \
      "${EXCLUDES[@]}" apps packages supabase 2>/dev/null | drop_ignored)

echo "==> [extra] a real .env file must not be committed"
if git rev-parse --git-dir >/dev/null 2>&1; then
  while IFS= read -r f; do
    case "$f" in .env.example) ;; *) report "committed env file: $f" ;; esac
  done < <(git ls-files | grep -E '(^|/)\.env' || true)
fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "check-no-secrets: FAILED — see the lines above."
  exit 1
fi
echo "check-no-secrets: clean"
