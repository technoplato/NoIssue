# ledger.solana — design (2026-07-06)

Michael's framing, kept: *the chain is just
another data-synchronization signal — the
strongest one, because it involves money.*
So the Solana program is not a rewrite; it is
`ledger.js` given a harder substrate. The JS
ledger IS the executable spec — "basically
the in-memory version of the Solana program."

## Shape of the port (Anchor)

One Anchor program, `ledger.solana.rs`,
mirroring the archetype 1:1:

| ledger.js                | on-chain            |
|--------------------------|---------------------|
| ACTION RecordPurchase    | ix `record_purchase`|
| ACTION Transfer          | ix `transfer`       |
| ACTION Burn              | ix `burn`           |
| EVENT TokensMinted etc.  | Anchor `emit!` — the|
|                          | chain's event log IS|
|                          | our event log       |
| state.accounts[id]       | PDA per account:    |
|                          | seeds ["acct", id]  |
| state.refs (dedup)       | PDA per backing ref:|
|                          | seeds ["ref", ref]; |
|                          | init-once = dedup   |
|                          | for free            |
| violation() checks       | `require!` guards — |
|                          | same names:         |
|                          | conservation,       |
|                          | genesis-humility,   |
|                          | negative-balance    |

PDA = Program Derived Address. The ref-PDA
trick is the load-bearing move: `init` on an
existing account fails, so double-minting the
same Shopify order is impossible at the
runtime level, not merely checked.

Genesis humility on-chain: a `Config` PDA
stores the genesis pubkey; `transfer` and
`record_purchase` end with the same guard the
JS fold uses (recipient/genesis balance
compare). Anyone can verify it in the
explorer — that is the anti-ponzi property
made public.

Purchases are recorded by an ORACLE signer
(our server key, held server-side like the
Instant admin token): Shopify/Stripe webhooks
land there, the server signs
`record_purchase`. Users never mint.

## Test story (the part he specced hardest)

`ledger.solana.test.ts` runs the SAME
scenario table as `ledger.test.js` — golden
path, double-mint, overdraft, humility — so
the two ledgers can never drift. Cluster
comes from config, not code:

- localnet: `solana-test-validator`,
  throwaway identity per run
- devnet/testnet: CACHED identity at
  `~/.config/aces/id.<cluster>.json` —
  created on first run, reused after
  (airdrop on devnet when balance is low)
- mainnet: refuses to run tests, on purpose

## Reactive JS wrapper

`ledger.solana.client.js`: the same shape as
every sync adapter — this is the punchline,
it plugs into what already exists:

    { publish(event), subscribe(fn) }

`publish` maps ledger events to instructions;
`subscribe` uses `onLogs`/websocket to decode
Anchor events back into ACES facts (with
`_origin: 'solana'`). Then
`multisync.combineSync([instant, solana,
memory])` treats the chain as one more
backend — dedup by `_id`, timeouts, the
proven machinery. `mesh.connect()` unchanged.

## Blocked on (answers wanted, not blocking
## the rest of the build)

1. Token substance: native SOL-denominated
   points in our program's PDAs (simplest,
   above design), or a real SPL token mint
   (tradeable outside our program — more
   power, more legal surface)?
   RECOMMENDATION: program PDAs first; an
   SPL bridge can come later.
2. Which cluster do we demo on next week —
   devnet (free, honest label "test") until
   payments clear legal, then mainnet?
3. The oracle key: ok to provision a
   dedicated devnet keypair in this repo's
   CI secrets, never in the repo itself?

## Not in this container

`cargo` exists here but no solana-cli and no
anchor-cli (checked), so the program cannot
be built + validator-tested in this session.
Next session: write `ledger.solana.rs`,
`cargo check` it against anchor-lang, and
run the .ts scenario table on localnet from
a machine with the toolchain. This doc is
written so that session needs zero
re-derivation.

Related but separate: x402 (Cloudflare's
HTTP-402 agentic payments) still needs its
docs VERIFIED before building — NEXT.md §6.
