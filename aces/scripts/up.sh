#!/usr/bin/env bash
# ==============================================
# up.sh — one command to make a machine ready.
# Modular: it calls instant.sh for the db step.
# Everything is best-effort + guarded, so a
# missing tool warns instead of aborting.
# ==============================================

aces_up() {
  aces_say "ACES dev up"

  # 1. node — the engine runs on plain node
  if have node; then aces_ok "node $(node -v)"
  else aces_warn "install node 18+ first"; fi

  # 2. live-sync deps (InstantDB admin SDK)
  if have npm; then
    aces_say "installing @instantdb/admin"
    ( cd "$DIR/live" 2>/dev/null || mkdir -p \
        "$DIR/live" && cd "$DIR/live"
      [ -f package.json ] || npm init -y >/dev/null 2>&1
      npm install @instantdb/admin >/dev/null 2>&1 ) \
      && aces_ok "instant admin sdk" \
      || aces_warn "npm install skipped/failed"
  else aces_warn "npm missing; skip sdk"; fi

  # 3. p2p deps (Holepunch/Pear) — optional
  if have npm; then
    aces_say "installing hypercore + hyperswarm"
    ( cd "$DIR/live" && npm install \
        hypercore hyperswarm >/dev/null 2>&1 ) \
      && aces_ok "pear p2p deps" \
      || aces_warn "pear deps skipped (native build?)"
  fi

  # 4. self-hosted InstantDB (fetch now, run on 'db')
  source "$DIR/scripts/instant.sh"
  instant_fetch

  aces_ok "dev up done — ./dev.sh run"
}
