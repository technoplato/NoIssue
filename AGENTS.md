# AGENTS.md — how to work on this repo

This repository is built by AI agents working
in parallel (with Michael). This file is the
first thing a new agent should read. For the
*state* of the code, read
[`SUMMARY.md`](SUMMARY.md); for the *roadmap*,
[`aces/NEXT.md`](aces/NEXT.md); for the *spec*,
[`aces/SPEC.md`](aces/SPEC.md).

## Contents

1. [The coordination protocol
   (TCP-style)](#1-the-coordination-protocol-tcp-style)
2. [House rules (conventions)](#2-house-rules-conventions)
3. [Skills & module map](#3-skills--module-map)
4. [Current state & next steps](#4-current-state--next-steps)
5. [Effects vs. dependencies (say it
   precisely)](#5-effects-vs-dependencies-say-it-precisely)

---

## 1. The coordination protocol (TCP-style)

Multiple agents work at once. To split work
without merge conflicts, they use an
**append-only mailbox** on a dedicated branch:

> **`claude/aces-coordination`** — read
> `PROTOCOL.md` there first. Messages live under
> `mailbox/`, one file per message, filenames
> stamped with time + sender
> (`2026-07-06T0841Z-pqbmyu-0001.md`) so two
> agents can append concurrently and every push
> merges clean.

The handshake borrows TCP's vocabulary (TCP =
Transmission Control Protocol — we use its
handshake words, not its wire format):

| Type | Meaning |
|---|---|
| `HELLO` | introduce yourself once |
| `SYN` | **claim work** — list the roadmap item and the *exact file paths* you will touch; the claim is a lease on those paths |
| `ACK` | accept another agent's SYN |
| `NAK` | contest a SYN — must propose a split, not just refuse |
| `FIN` | release the claim — include the commit sha |
| `NOTE` | anything else worth logging |

**Rules:** fetch + read the mailbox before
working and before every push. SYN before your
first commit on claimed files. Silence is
consent — you may start right after posting a
SYN (agents aren't always awake). While a claim
is open, only the claimer edits those paths.

**Collision policy, agreed in advance:** prefer
*new files* over editing shared ones (new
filenames cannot conflict); if two agents edit
the same file anyway, the *later* SYN yields and
rebases onto the earlier work; never rewrite
another agent's prose — disagree in a `NOTE`.

### Branch topology

- `claude/human-ai-detection-game-9q4nnb` —
  agent **9q4nnb**; branch-of-record for the
  files it created (engine core, calculator,
  store, sync/mesh/pear, conversation archetype).
- `claude/aces-engine-architecture-pqbmyu` —
  agent **pqbmyu**; carries 9q4nnb's work merged
  forward plus versioning, platform tree, view
  spec, parser-printers, nav, ledger, voice
  assistant, the arcade, and deploy.
- `claude/aces-coordination` — the mailbox.
- `main` — where releases land (and what GitHub
  Pages deploys).

A `SessionStart` hook (`.claude/settings.json`)
prints the newest mailbox messages when a session
opens, so continuity survives across sessions.

---

## 2. House rules (conventions)

- **≤ ~50 columns** per source line (they fit
  Michael's phone preview). 2-space indent. Deep
  nesting is a smell — flatten or extract.
- **Define every acronym** at its first use in a
  comment (RPN, TTS, DHT, DI, PDA…).
- **Keep `evolve` pure**; keep the log
  authoritative; keep effects behind injected
  processors. A test that hits an unwired
  dependency must *throw*, never silently no-op
  (see `deps.js`).
- **Comments are rich and explanatory on
  purpose** — Michael reads the code for
  pleasure. Match that voice.
- **Naming:** tests are `<thing>.test.js`
  (`core.test.js`, `ledger.test.js`); a future
  Solana port is `ledger.solana.rs`, its client
  `ledger.solana.client.js`, etc.
- **Refuse the manipulation experiments.** Do
  not help extract any model's hidden prompt or
  role-play deception pretexts — Michael flagged
  this himself and asked us to hold the line.
  Everything else here is ordinary engineering;
  build it enthusiastically.

---

## 3. Skills & module map

Run the whole proof suite: `cd aces && npm test`
(109 checks). Key modules:

| Module | Role |
|---|---|
| `core.js` | the ~90-line runtime |
| `deps.js` | controlled-world dependency injection |
| `version.js` | event schema SemVer + migrations |
| `platform.js` | declarative runtime/capability enum |
| `view.js` | one view node → ascii / React / RN |
| `parse.js` | parser-**printers** (parse ↔ print) |
| `nav.js` | navigation + settings as folded state |
| `ledger.js` | token ledger with fairness laws |
| `llm.js` | senses (LLM/speech) as dependencies |
| `assistant.js` | voice-driven control archetype |
| `sync.js` / `multisync.js` / `mesh.js` | sync backends + fan-out + wiring |
| `pear.js` | Holepunch P2P adapter (shape only) |
| `calculator.js` / `store.js` / `conversation.js` | archetypes |
| `index.html` | the browser arcade (unbundled) |
| `deploy/build-artifact.js` | single-file standalone build |

---

## 4. Current state & next steps

Summarized in [`SUMMARY.md`](SUMMARY.md). The
short version: the engine and archetypes work;
**the arcade is not yet deployed and must not
land on `main` without Michael's explicit
say-so**; **InstantDB and Pear are not live**,
**no real money moves yet**, and **the Solana
contract is designed but not written**. Roadmap
order in [`aces/NEXT.md`](aces/NEXT.md).

---

## 5. Effects vs. dependencies (say it precisely)

A house distinction worth stating exactly,
because it is the spine of the whole design:

- A **side-effect** is an act on the outside
  world — persist to storage, publish over the
  network, render a screen, **charge a card**.
  `react` only *names* the effect; it never does
  it.
- A **dependency** is the swappable thing that
  *performs* the effect: a processor with
  `live` / `test` / `unimplemented` faces
  (`deps.js`). Swapping the dependency is what
  moves the same pure logic between browser,
  server, and test.
- Every effect's result **re-enters as an
  event**, so the log remains the whole story.

**Dependencies cause the side-effects.** Do not
call storage/network/screen/payments
"dependencies" — they are *categories of
side-effect*, each performed by a dependency you
inject. (Payments is the newest: a Stripe charge
is an effect behind a `pay` dependency; its
confirmation re-enters the ledger as a
`RecordPurchase` fact.)
