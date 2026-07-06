#!/usr/bin/env bash
# ==============================================
# instant.sh — self-hosted InstantDB.
# ----------------------------------------------
# Instant is open source. Its server + a Postgres
# (with logical replication) come up via the repo's
# docker-compose, landing on http://localhost:8888.
#
# For a multi-node self-host later, the same image
# runs behind Docker Swarm (see NEXT.md); this dev
# path is the single-node version.
# ==============================================

INSTANT_DIR="${INSTANT_DIR:-$DIR/.instant}"
INSTANT_URL="${INSTANT_URL:-http://localhost:8888}"

# clone the instant repo once (shallow)
instant_fetch() {
  have git || { aces_warn "git missing; skip"; return 0; }
  if [ -d "$INSTANT_DIR/.git" ]; then
    aces_ok "instant repo present"
    return 0
  fi
  aces_say "cloning instantdb/instant"
  git clone --depth 1 \
    https://github.com/instantdb/instant \
    "$INSTANT_DIR" \
    && aces_ok "cloned to .instant" \
    || aces_warn "clone failed (offline?)"
}

# bring the server up on :8888
instant_up() {
  instant_fetch
  have docker || { aces_warn \
    "docker required for self-host"; return 0; }
  aces_say "starting InstantDB ($INSTANT_URL)"
  # the repo ships a make target that runs
  # docker compose (postgres + server).
  ( cd "$INSTANT_DIR/server" \
    && make docker-compose ) \
    && aces_ok "instant up at $INSTANT_URL" \
    || aces_warn "compose failed; see server/README.md"
}
