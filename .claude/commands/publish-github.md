Publish this repository to GitHub as a public repo named "recur" (or $ARGUMENTS if given).

1. Check `git status` is clean and that no keypairs or .env files are tracked (`git ls-files | grep -Ei "keypair|\.env|keeper.json"` must be empty).
2. Check `gh auth status`; if not logged in, ask the user to run `gh auth login` (GitHub.com, HTTPS, browser).
3. Ensure the branch is `main`, then run `gh repo create <name> --public --source=. --remote=origin --push`.
4. Print the repo URL and suggest adding a short description and the topics solana, usdc, subscriptions, colosseum.
