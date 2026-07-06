#!/usr/bin/env bash
# ==============================================
# test.sh — run every node proof in the folder.
# Pure, offline, no docker. Sourced by dev.sh and
# also by run.sh.
# ==============================================

aces_test() {
  aces_say "running proofs"
  have node || aces_die "node not found"
  cd "$DIR"
  # naming: <thing>.test.js (2026-07-06).
  # npm test runs the full chain from
  # package.json — one source of truth.
  npm test
  aces_ok "all proofs passed"
}
