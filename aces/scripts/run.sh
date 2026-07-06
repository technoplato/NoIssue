#!/usr/bin/env bash
# ==============================================
# run.sh — developer mode. Proves the engine,
# prints the platform diagnostic, and runs the
# live two-node sync demo. As the app grows this
# is where a file watcher / server would start.
# ==============================================

aces_run() {
  aces_say "ACES dev run"
  cd "$DIR"

  # 1. proofs (reuse test.sh, modular)
  source "$DIR/scripts/test.sh"
  aces_test

  # 2. where am I + which backends work here
  aces_say "platform diagnostic"
  node -e 'console.log(require("./platform").report())'

  # 3. live: two nodes converge over one bus
  aces_say "sync demo (type on A only)"
  node sync-demo.js

  aces_ok "dev running — Ctrl-C to stop"
}
