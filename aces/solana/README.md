# aces/solana — the token ledger, on chain

The Anchor port of [`../ledger.js`](../ledger.js).
`ledger.js` is the in-memory version of this
program: same fairness laws, now enforced by the
Solana runtime.

## Files

- `programs/ledger/src/ledger.solana.rs` — the
  program (Anchor/Rust).
- `tests/ledger.solana.test.ts` — the canonical
  Anchor test, run on a local validator. Mirrors
  `../ledger.test.js` scenario-for-scenario.
- `Anchor.toml` / `Cargo.toml` — workspace config.

## The design (1:1 with ledger.js)

| ledger.js | on chain |
|---|---|
| `state.accounts[id]` | a `TokenAccount` PDA per wallet, seeds `["acct", owner]` |
| `state.refs` (dedup) | a `Ref` PDA per backing ref, seeds `["ref", sha256(ref)]` — **`init`-once, so a repeated purchase fails at the runtime** |
| genesis + oracle | a `Config` PDA, seeds `["config"]` |
| `RATE = 100` | `const RATE: u64 = 100` (must match) |
| `decide` guards | `require!` / `checked_*` — same error names |

Fairness, enforced on chain:

- **No unbacked mint** — tokens only via
  `record_purchase`, which the runtime lets the
  **oracle** signer alone call.
- **No double mint** — the `Ref` PDA is `init`; a
  second purchase with the same ref id aborts.
- **No negatives / no overflow** — `checked_sub`
  / `checked_mul`.
- **Genesis humility** — genesis can't be a mint
  beneficiary, and a transfer that would leave
  genesis richer than its counterparty is
  rejected. Genesis starts at zero.

## Run it (localnet — the default)

Needs the Solana + Anchor toolchain:

```bash
# 1. toolchain (once)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install anchor-cli --version 0.30.1 --locked

# 2. from this directory
cd aces/solana
yarn            # or npm install
anchor keys sync   # align declare_id with the
                   # generated program keypair
anchor test        # boots a throwaway validator,
                   # deploys, runs the TS test
```

`anchor test` starts a fresh `solana-test-
validator`, so no airdrop or funding dance is
needed — that's why localnet is the default here
(devnet airdrops are rate-limited and flaky). To
run against devnet instead: set
`[provider] cluster = "devnet"`, fund the wallet
once, and cache the identity at
`~/.config/solana/id.json`; the test body is
unchanged.

### Status: builds on a normal host, not in CI

The program, the test, and the config are
complete and the program ID is already generated
(`declare_id!` and `Anchor.toml` are synced). It
has NOT been validator-run inside this project's
sandbox: `cargo-build-sbf` downloads the Solana
platform-tools from GitHub at build time, and
this environment's egress proxy re-terminates TLS,
so that specific download fails with an untrusted-
issuer error (and the downloader ignores the CA
env vars). On any ordinary machine (your laptop,
a CI runner without a TLS-intercepting proxy) the
`anchor test` block above builds and runs as
written. The Rust mirrors the fully-proven
`../ledger.js` (12/12 in `../ledger.test.js`)
one instruction at a time.

## Wiring it back to ACES

The reactive client (shaped like every other sync
adapter — `{ publish, subscribe }`) is described
in [`../ledger.solana.md`](../ledger.solana.md):
`publish` maps ledger events to instructions;
`subscribe` decodes Anchor `emit!` logs back into
ACES facts with `_origin: "solana"`, so
`multisync.combineSync([...])` treats the chain as
one more backend. The fiat on-ramp (Stripe, see
[`../pay.stripe.md`](../pay.stripe.md)) is the
ONLY place a server is needed — crypto users pay
the program directly.
