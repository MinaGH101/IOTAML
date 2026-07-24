#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

pattern='(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY[[:space:]]*=[[:space:]]*[^[:space:]#]{12,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)'
matches="$(rg -l --hidden --glob '!.git/**' --glob '!package-lock.json' --glob '!.env*.example' "$pattern" . || true)"
if [ -n "$matches" ]; then
  echo "Potential secret material found in:"
  echo "$matches"
  exit 1
fi

if [ -d .git ]; then
  history_matches="$(
    for commit in $(git rev-list --all); do
      git grep -Il -E "$pattern" "$commit" -- . 2>/dev/null || true
    done | sort -u
  )"
  if [ -n "$history_matches" ]; then
    echo "Potential secret material exists in Git history:"
    echo "$history_matches"
    exit 1
  fi
fi

echo "Secret scan passed."
