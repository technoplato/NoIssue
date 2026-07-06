#!/usr/bin/env bash
# ==============================================
# ACES dev entrypoint.   ./dev.sh <command>
# ----------------------------------------------
#   up     install everything for local dev
#   run    start dev mode (proofs + demos)
#   test   run the node proofs only
#   db     bring up self-hosted InstantDB (:8888)
#   help   this text
#
# Scripts are modular and live in scripts/. Each
# is sourced and exposes one function; scripts may
# call each other. Keep comments <=50 cols.
# ==============================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DIR
source "$DIR/scripts/lib.sh"

cmd="${1:-help}"
case "$cmd" in
  up)   source "$DIR/scripts/up.sh";      aces_up ;;
  run)  source "$DIR/scripts/run.sh";     aces_run ;;
  test) source "$DIR/scripts/test.sh";    aces_test ;;
  db)   source "$DIR/scripts/instant.sh"; instant_up ;;
  help|*) aces_help ;;
esac
