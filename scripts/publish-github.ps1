# Windows: creates a public GitHub repo "recur" from this folder and pushes it.
# Requires Git (winget install Git.Git) and GitHub CLI (winget install GitHub.cli), then `gh auth login` once.
param([string]$Name = "recur")
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path .git)) { git init -q; git add -A; git commit -qm "Recur: non-custodial USDC subscriptions on Solana" }
git branch -M main
gh repo create $Name --public --source=. --remote=origin --push
gh repo view --json url -q .url
