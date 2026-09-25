Deploy the Recur program to devnet and wire everything to it. Run Solana/Anchor commands inside WSL on Windows.

1. `solana config get` must point to devnet and a funded wallet (~2 SOL; `solana airdrop 2` or faucet.solana.com).
2. `anchor keys sync && anchor build && npm test && anchor deploy --provider.cluster devnet`. Record the program ID.
3. Ask the user for a Helius devnet RPC URL (public RPC rate-limits getProgramAccounts).
4. Seed: `RPC_URL=… RECUR_PROGRAM_ID=… APP_URL=https://<vercel url> npm run seed:devnet`. Save the printed checkout links.
5. Create a keeper keypair outside the repo, ask the user to fund it with 0.5 SOL, put its JSON in Vercel as KEEPER_SECRET_KEY.
6. Update Vercel env (NEXT_PUBLIC_RECUR_PROGRAM_ID, RPC URLs, CRON_SECRET) and redeploy.
7. Tell the user how to add a cron-job.org job: every minute, GET https://<site>/api/cron/charge with `Authorization: Bearer <CRON_SECRET>`.
8. Verify: `curl https://<site>/api/cron/charge -H "Authorization: Bearer …"` returns JSON with `checked` ≥ 0.
