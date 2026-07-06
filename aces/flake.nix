{
  # ============================================
  # ACES dev shell — reproducible, no "detect
  # what's installed". Same philosophy as the
  # Nix config in Kun Chen's L8 video: pin to a
  # stable nixpkgs, declare every tool, and the
  # environment reproduces no matter the host.
  #
  #   nix develop        # enter the shell
  #   nix develop -c ./dev.sh test
  #
  # (direnv users: echo "use flake" > .envrc)
  # ============================================
  description = "ACES — event-sourced engine dev shell";

  inputs = {
    # PINNED to a stable release, not unstable —
    # the video's key move for reproducibility.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs }:
    let
      # the systems we build a shell for
      systems = [
        "x86_64-linux" "aarch64-linux"
        "x86_64-darwin" "aarch64-darwin"
      ];
      forAll = f:
        nixpkgs.lib.genAttrs systems
          (s: f nixpkgs.legacyPackages.${s});
    in {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell {
          # every tool the engine + dev.sh touch
          packages = with pkgs; [
            nodejs_22      # the runtime
            git            # clone self-hosted instant
            docker-compose # self-host instant on :8888
            yt-dlp         # transcribe reference videos
            deno           # yt-dlp's JS runtime
            python3        # occasional scripts
            jq
          ];
          shellHook = ''
            echo "ACES dev shell — node $(node -v)"
            echo "  ./dev.sh test   run the proofs"
            echo "  ./dev.sh db     self-host InstantDB"
          '';
        };
      });
    };
}
