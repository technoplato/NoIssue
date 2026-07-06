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
  node test.js
  node test-net.js
  node test-conv.js
  aces_ok "all proofs passed"
}
