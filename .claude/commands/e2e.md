Run the full local verification (inside WSL):

1. `cargo build-sbf --manifest-path programs/recur/Cargo.toml` (or `anchor build`).
2. `npm test` — expect 13 passing.
3. Start `solana-test-validator --reset --bpf-program <PROGRAM_ID from lib.rs declare_id> target/deploy/recur.so` in the background, wait for RPC.
4. `node --import tsx scripts/e2e-local.ts` — expect "e2e passed". Stop the validator afterwards.
Report any failure with the exact output and fix it.
