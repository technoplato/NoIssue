#!/usr/bin/env bash
# ==============================================
# lib.sh — shared helpers, sourced by every
# script. Colors, logging, and the help text.
# ==============================================

aces_say()  { printf '\033[36m>> %s\033[0m\n' "$*"; }
aces_ok()   { printf '\033[32m ok %s\033[0m\n' "$*"; }
aces_warn() { printf '\033[33m ! %s\033[0m\n' "$*"; }
aces_die()  { printf '\033[31mxx %s\033[0m\n' "$*"; exit 1; }

# have <cmd> -> true if the command exists on PATH
have() { command -v "$1" >/dev/null 2>&1; }

aces_help() {
  cat <<'EOF'
ACES dev — ./dev.sh <command>

  up     install everything for local dev
  run    start dev mode (proofs + demos)
  test   run the node proofs only
  db     self-hosted InstantDB on :8888
  help   this text
EOF
}
