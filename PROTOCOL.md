# ACES agent coordination protocol

This branch (`claude/aces-coordination`) is an
APPEND-ONLY mailbox between the agents working
on ACES in parallel, plus Michael. It exists so
two agents can split work in advance and almost
never hit a git conflict — and so that when they
do, the resolution was agreed BEFORE it happened.

Requested by Michael 2026-07-06: "a third branch
for sending append-only messages about what
we're going to work on next, a TCP-style
acknowledgment protocol for who works on what."

## Who is who

Agents are named by their branch suffix:

- `9q4nnb` — the first agent. Branch
  `claude/human-ai-detection-game-9q4nnb`.
  Built the original `aces/` folder; that
  branch is the branch-of-record for the
  existing files.
- `pqbmyu` — the second agent (this protocol's
  author). Branch
  `claude/aces-engine-architecture-pqbmyu`,
  fast-forwarded onto 9q4nnb's head so both
  share history.

## The mailbox

One file per message under `mailbox/`. Never
edit or delete an existing message — new
information is a NEW message. Filenames are
collision-proof by construction:

    mailbox/<UTC time>-<agent>-<n>.md
    mailbox/2026-07-06T0841Z-pqbmyu-0001.md

`<n>` is that agent's own message counter.
Because every filename embeds the sender, two
agents can append concurrently and a
fetch + rebase + push always merges clean.

If your push is rejected (the other agent
appended first):

    git fetch origin claude/aces-coordination
    git rebase origin/claude/aces-coordination
    git push

## Message types (TCP flavored)

TCP = Transmission Control Protocol; we borrow
its handshake vocabulary, not its wire format.

- `HELLO` — introduce yourself once.
- `SYN`   — claim work. MUST list: the roadmap
  item (by NEXT.md number), the EXACT file
  paths you will create or edit, and a rough
  size. A SYN is a lease on those paths.
- `ACK`   — accept another agent's SYN.
- `NAK`   — contest a SYN (overlap with work
  you already started). A NAK MUST propose a
  split, not just refuse.
- `FIN`   — claim released. Work is pushed;
  include the commit sha and branch. Files in
  the claim are now free again.
- `NOTE`  — anything else worth logging
  (decisions, gotchas, credentials moves).

## Handshake rules

1. Fetch and read the mailbox BEFORE starting
   work and BEFORE every push.
2. Push a SYN before your first commit touching
   the claimed files.
3. You may start immediately after pushing the
   SYN — agents are not always awake, so
   silence is consent. An ACK is courtesy, not
   a gate.
4. A NAK only counts if it lands before the
   claimer's FIN. After a NAK, both agents stop
   touching the contested paths until a split
   is agreed in the mailbox.
5. While a claim is open, ONLY the claimer
   edits those paths. Everything else is fair
   game — but SYN it first.

## Collision policy (agreed in advance)

1. PREVENT: prefer NEW modules over editing
   shared ones. A wrapper around `core.js`
   beats a patch to `core.js`. New filenames
   cannot conflict.
2. If two agents edited the same file anyway,
   the LATER SYN yields: the later claimer
   rebases onto the earlier claimer's pushed
   work and resolves the conflict, preserving
   the earlier work's semantics. Timestamp in
   the SYN filename is the tiebreak.
3. Shared docs (`NEXT.md`, `HANDOFF.md`,
   `SPEC.md`): append under your own dated
   heading or edit only your own section.
   Never rewrite another agent's prose —
   disagree in a NOTE instead.
4. Branch topology: `9q4nnb`'s branch stays
   upstream-of-record for files it created;
   `pqbmyu` merges it forward as needed.
   Michael merges both branches to `main`
   when he chooses; this mailbox is the map
   of what landed where.

## Spirit

Same as the engine: every message is a fact,
the log is truth, refusals are facts too. Say
what you will do before you do it, say what
you did after, and never rewrite history.
