# Nix notes — from Kun Chen, "L8 Principal's
# Agentic Coding Config From Scratch" (44:31)
# https://youtu.be/5N-okeDdIuI  (transcribed via yt-dlp)

The video's thesis: make your whole environment
**reproducible** — declared, pinned, rebuildable
from any starting state. Key points as spoken:

- **Nix** is a declarative, reproducible config
  system (built for NixOS, but portable). Install
  on macOS via the **Determinate Nix** installer.
- **Nix Darwin** configures macOS settings in Nix
  (a `configuration.nix`); set `nix.enable = false`
  when Determinate manages the install.
- **Home Manager** manages the user/home dir
  (dotfiles, symlinks) — separate from the OS layer.
- **Nix Homebrew** installs brew packages the Nix
  way; `cleanup = "zap"` removes anything not
  declared, so the config is the single truth.
- Everything is wired through one **`flake.nix`**,
  and you **pin nixpkgs to a stable version**, not
  unstable — the crucial move for reproducibility.
- Payoff: "the rebuild script can fully reproduce
  everything, no matter the current state."

## How we apply it to ACES
That video configures a personal machine
(Darwin + Home Manager). For a *project*, the same
philosophy lands as a **flake dev shell**:

- `aces/flake.nix` pins `nixpkgs` to `nixos-25.05`
  and declares every tool (node 22, git,
  docker-compose, yt-dlp, deno, python3, jq).
- `nix develop` drops anyone into the identical,
  pinned toolchain — this replaces the old
  "detect what's installed" logic in `dev.sh`.
- direnv users: `echo "use flake" > .envrc`.

So: Nix owns "which tools exist and at what
version"; `dev.sh` owns "what to do with them".
