#!/usr/bin/env bash
# Creates a public GitHub repo "recur" from this folder and pushes it.
# Needs GitHub CLI (https://cli.github.com) and `gh auth login` once.
set -e
cd "$(dirname "$0")/.."
[ -d .git ] || { git init -q && git add -A && git commit -qm "Recur: non-custodial USDC subscriptions on Solana"; }
git branch -M main
gh repo create "${1:-recur}" --public --source=. --remote=origin --push
echo "Done: $(gh repo view --json url -q .url)"
