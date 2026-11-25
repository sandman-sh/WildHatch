# WildHatch Devnet and hosted saves

## Gameplay and balances

Normal mode, guest exploration, and ordinary PvP share a world backed by Supabase Postgres. Supabase Realtime signals when clients should refresh nearby players and game events. The game API validates actions, and Postgres transactions settle the Game WILD shop and beast listings.

Devnet PvP uses an independent match account. The host invites a Solana wallet, the challenger accepts, and the host delegates the account to MagicBlock. Players sign each move. The winner of a settled knockout can claim 12 Devnet SPL WILD once. The Devnet shop burns SPL WILD and validates the finalized receipt before granting supplies. Mystery-box contents for both shops are drawn by the game server with the odds shown in the UI.

The game issues one supply-capped Devnet SPL collectible per eligible beast ID. The issuer signs a memo in the mint transaction that records the species, element, genetic variant, rarity, personality, stage, level, crest, and mutation at mint time. WildHatch verifies that record by mint address and displays it when a buyer inspects an escrow listing. The journal can prefill a fixed-price listing for the collectible in Devnet SOL. Playable beast entries trade through the game’s Trading Post.

## Program build and checks

The program address is `BUfh4GsJjyH52oLkgyG3U2UT7qJwo6opLDmEUW4w7PpJ`. The deployment and collectible issuer are currently configured for the same Devnet test signer. Keep keypair files outside the repository.

The Devnet deployment was finalized at slot 525798176. Its deployed bytecode matches the build. The six-decimal WILD mint is `BV54wR24axhu8gw8R7WVriCufYjCLYAwXJsUat94mswj`. [Deployment transaction](https://explorer.solana.com/tx/4MquswfYZVnogPjPr4Ea6V4WWLvzxJCaz7a15H2pmACwNvmzwmuHVgPhUofzxPkGqkRHQ1h2767xCaX11nY1J1yQ?cluster=devnet) · [WILD mint](https://explorer.solana.com/address/BV54wR24axhu8gw8R7WVriCufYjCLYAwXJsUat94mswj?cluster=devnet)

From `chain` in a shell with Solana and Rust installed:

```sh
cargo build-sbf
solana program deploy --url devnet --program-id "$WILDHATCH_PROGRAM_KEYPAIR" target/deploy/wildhatch.so
solana program show --url devnet BUfh4GsJjyH52oLkgyG3U2UT7qJwo6opLDmEUW4w7PpJ
```

The deployment signer needs enough Devnet SOL for program rent, the temporary upload buffer, and fees. Run `npm run devnet:init` with `WILDHATCH_ISSUER_KEYPAIR` set to the local test signer path to create the six-decimal WILD mint after deployment. The same environment variable enables beast mint preparation on the game server.

For local integration tests, start `solana-test-validator` on port 18899 with the compiled program loaded at the address above. Run `node tests/chain.mjs` with `WILDHATCH_TEST_ISSUER` pointing to the local test signer. The test only accepts a loopback RPC.

Build with `cargo build-sbf --features local-rollup` for the official local MagicBlock validator identity. Set `WILDHATCH_TEST_RPC` and `WILDHATCH_TEST_ROLLUP` to the two loopback RPC URLs to also check delegation, moves, settlement, and the single-claim reward. Use the default build for Devnet.

## Supabase and Vercel

1. In the Supabase SQL editor, apply [the multiplayer migration](../supabase/migrations/20261125160000_wildhatch_multiplayer.sql) to the intended project. It creates the private `wildhatch` tables and the `wildhatch_runtime` role. A dedicated game login needs membership in `wildhatch_runtime` and access to the database. Leave `wildhatch` out of the project's Data API exposed schemas.
2. Set the following variables locally in `.env` and in the corresponding Vercel project environment. Use the Supavisor transaction pooler connection string for Vercel, typically port 6543. Require TLS and keep the database login server-side.

   | Variable | Value |
   | --- | --- |
   | `WILDHATCH_DATABASE_URL` | Connection string for the dedicated game login. Server-only secret. |
   | `WILDHATCH_DATABASE_CA` | Supabase database root certificate as PEM text. Set this if Node does not trust the database certificate. |
   | `WILDHATCH_SUPABASE_URL` | Supabase Project URL. |
   | `WILDHATCH_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. The browser uses it to subscribe to anonymous wake signals. |
   | `WILDHATCH_ISSUER_KEYPAIR_JSON` | Optional raw Devnet issuer keypair JSON for mint preparation. Server-only secret. Use `WILDHATCH_ISSUER_KEYPAIR` with a file path locally. |

3. Verify the Supabase project permits public Realtime channels. The `wildhatch:world` channel broadcasts an empty wake signal. Players fetch their own events and nearby ranger positions through the same-origin API. No Supabase service-role API key is needed.
4. Set the Vercel root to this app directory, the framework to Vite, and Node.js to 24.x. Deploy the frontend and the API together. For latency, place the Vercel function near the Supabase database region.

### Bring existing saves forward

Before opening the new deployment to players, stop the old server to freeze writes and keep the old SQLite files together as a backup. Inspect and import the file into an empty migrated database.

```sh
npm run saves:import -- beasts.sqlite --inspect
npm run saves:import -- beasts.sqlite
```

The import preserves wallet links, collections and traits, arena results, receipt history, listings, and sales. It leaves the source file intact and rejects a populated destination. When a legacy hosted checkpoint is the newest copy, restore that checkpoint to a local SQLite file first and use that file as the source.
