Deploy apps/web to Vercel using the Vercel MCP server.

1. The repo must be on GitHub (`git remote get-url origin`); if not, run /publish-github first.
2. Team: "sumiya6669's projects" (use list_teams to get the id). Create or reuse the project with create_git_project,
   rootDirectory "apps/web", projectName "recur".
3. Set env vars for production and preview (ask the user for values you don't have; never invent secrets):
   NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_CLUSTER=devnet, NEXT_PUBLIC_RECUR_PROGRAM_ID, NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,
   NEXT_PUBLIC_APP_URL=https://<project>.vercel.app, RPC_URL, KEEPER_SECRET_KEY, CRON_SECRET, optional WEBHOOK_URL/WEBHOOK_SECRET.
   Before the program is on devnet, the demo pages still work; set NEXT_PUBLIC_* anyway and redeploy later.
4. Trigger a deployment, watch build logs, fix errors in code if the build fails.
5. Open the deployed site in a browser and review `/`, `/dashboard?demo=1`, `/account` at desktop and 390px width.
   Fix layout issues following the design section of CLAUDE.md, commit, push, and re-check.
