// =============================================
// ledger.solana.rs — the ACES token ledger, on
// chain. The Anchor port of ledger.js.
// ---------------------------------------------
// ledger.js is "the in-memory version of this
// program" (Michael). Same fairness laws, now
// enforced by the Solana runtime instead of a
// JS fold:
//   - NO UNBACKED MINT: tokens exist only via a
//     recorded purchase. A Ref account is
//     init-once, so replaying a Shopify order
//     mints nothing twice (double-mint proof
//     is the runtime's, not a check we can
//     forget).
//   - CONSERVATION: minted/burned counters move
//     only inside these instructions.
//   - NO NEGATIVES: checked_sub gates spends.
//   - GENESIS HUMILITY: the genesis wallet may
//     never mint to itself, and a transfer that
//     would leave genesis holding MORE than its
//     counterparty is rejected. Genesis starts
//     at zero, so it stays the poorest.
//   - ONLY THE ORACLE MINTS: record_purchase is
//     signer-gated to the configured oracle key
//     (our server, holding the fiat webhook).
//
// PDA = Program Derived Address (a deterministic
// account owned by this program, no private
// key). We use one PDA per Config, per Account
// (keyed by wallet), and per backing Ref (keyed
// by a 32-byte ref id = sha256 of the external
// order id, computed client-side).
//
// RATE = tokens minted per cent, and MUST match
// ledger.js so the two ledgers never drift.
// =============================================

use anchor_lang::prelude::*;

declare_id!(
  "F2z8XxW4fzS44QHrSjSgvDwTHn6unx6tjxoEDHmhHKGn"
);

const RATE: u64 = 100; // tokens per cent

#[program]
pub mod ledger {
  use super::*;

  // one-time setup: record who genesis and the
  // oracle are. Anyone may call it once (the
  // Config PDA is init-once).
  pub fn initialize(
    ctx: Context<Initialize>,
    genesis: Pubkey,
    oracle: Pubkey,
  ) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.genesis = genesis;
    c.oracle = oracle;
    c.minted = 0;
    c.burned = 0;
    c.bump = ctx.bumps.config;
    Ok(())
  }

  // create (or top up) an account PDA for a
  // wallet, starting at zero. Idempotent-ish:
  // callable once per wallet (init).
  pub fn open_account(
    ctx: Context<OpenAccount>,
    owner: Pubkey,
  ) -> Result<()> {
    let a = &mut ctx.accounts.account;
    a.owner = owner;
    a.balance = 0;
    a.bump = ctx.bumps.account;
    Ok(())
  }

  // ORACLE ONLY. Back `cents` of real money with
  // `cents * RATE` tokens to `beneficiary`. The
  // Ref PDA is init here, so the same ref can
  // never mint twice (runtime-enforced).
  pub fn record_purchase(
    ctx: Context<RecordPurchase>,
    _ref_id: [u8; 32],
    cents: u64,
  ) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require_keys_eq!(
      ctx.accounts.oracle.key(),
      cfg.oracle,
      LedgerError::NotOracle
    );
    require!(cents > 0, LedgerError::BadCents);
    let ben = &mut ctx.accounts.beneficiary;
    require_keys_neq!(
      ben.owner,
      cfg.genesis,
      LedgerError::GenesisCannotMint
    );
    let amount = cents
      .checked_mul(RATE)
      .ok_or(LedgerError::Overflow)?;
    ben.balance = ben
      .balance
      .checked_add(amount)
      .ok_or(LedgerError::Overflow)?;
    cfg.minted = cfg
      .minted
      .checked_add(amount)
      .ok_or(LedgerError::Overflow)?;
    // mark the ref consumed (data is incidental;
    // its EXISTENCE is the dedup).
    ctx.accounts.backing.cents = cents;
    ctx.accounts.backing.bump =
      ctx.bumps.backing;
    Ok(())
  }

  // move tokens between two account PDAs. Spend
  // what you hold; never enrich genesis past the
  // counterparty.
  pub fn transfer(
    ctx: Context<Transfer>,
    amount: u64,
  ) -> Result<()> {
    require!(amount > 0, LedgerError::BadAmount);
    let from = &mut ctx.accounts.from;
    let to = &mut ctx.accounts.to;
    require_keys_eq!(
      from.owner,
      ctx.accounts.signer.key(),
      LedgerError::NotOwner
    );
    from.balance = from
      .balance
      .checked_sub(amount)
      .ok_or(LedgerError::Insufficient)?;
    to.balance = to
      .balance
      .checked_add(amount)
      .ok_or(LedgerError::Overflow)?;
    // genesis humility: if the recipient is
    // genesis, it must not end up richer than
    // the sender it just received from.
    let genesis = ctx.accounts.config.genesis;
    if to.owner == genesis {
      require!(
        to.balance <= from.balance,
        LedgerError::GenesisHumility
      );
    }
    Ok(())
  }

  // burn your own tokens (e.g. spent to play a
  // game). Reduces supply; conservation holds.
  pub fn burn(
    ctx: Context<Burn>,
    amount: u64,
  ) -> Result<()> {
    require!(amount > 0, LedgerError::BadAmount);
    let acct = &mut ctx.accounts.account;
    require_keys_eq!(
      acct.owner,
      ctx.accounts.signer.key(),
      LedgerError::NotOwner
    );
    acct.balance = acct
      .balance
      .checked_sub(amount)
      .ok_or(LedgerError::Insufficient)?;
    let cfg = &mut ctx.accounts.config;
    cfg.burned = cfg
      .burned
      .checked_add(amount)
      .ok_or(LedgerError::Overflow)?;
    Ok(())
  }
}

// ---- state accounts -------------------------

#[account]
pub struct Config {
  pub genesis: Pubkey,
  pub oracle: Pubkey,
  pub minted: u64,
  pub burned: u64,
  pub bump: u8,
}
impl Config {
  // 8 discriminator + 32 + 32 + 8 + 8 + 1
  pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct TokenAccount {
  pub owner: Pubkey,
  pub balance: u64,
  pub bump: u8,
}
impl TokenAccount {
  pub const LEN: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct Ref {
  pub cents: u64,
  pub bump: u8,
}
impl Ref {
  pub const LEN: usize = 8 + 8 + 1;
}

// ---- instruction contexts -------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
  #[account(
    init,
    payer = payer,
    space = Config::LEN,
    seeds = [b"config"],
    bump
  )]
  pub config: Account<'info, Config>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(owner: Pubkey)]
pub struct OpenAccount<'info> {
  #[account(
    init,
    payer = payer,
    space = TokenAccount::LEN,
    seeds = [b"acct", owner.as_ref()],
    bump
  )]
  pub account: Account<'info, TokenAccount>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ref_id: [u8; 32])]
pub struct RecordPurchase<'info> {
  #[account(
    mut,
    seeds = [b"config"],
    bump = config.bump
  )]
  pub config: Account<'info, Config>,
  // init here => a second purchase with the same
  // ref_id fails at the runtime. Double-mint is
  // impossible, not merely checked.
  #[account(
    init,
    payer = oracle,
    space = Ref::LEN,
    seeds = [b"ref", ref_id.as_ref()],
    bump
  )]
  pub backing: Account<'info, Ref>,
  #[account(mut)]
  pub beneficiary: Account<'info, TokenAccount>,
  #[account(mut)]
  pub oracle: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
  #[account(seeds = [b"config"], bump = config.bump)]
  pub config: Account<'info, Config>,
  #[account(mut)]
  pub from: Account<'info, TokenAccount>,
  #[account(mut)]
  pub to: Account<'info, TokenAccount>,
  pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Burn<'info> {
  #[account(
    mut,
    seeds = [b"config"],
    bump = config.bump
  )]
  pub config: Account<'info, Config>,
  #[account(mut)]
  pub account: Account<'info, TokenAccount>,
  pub signer: Signer<'info>,
}

// ---- errors (names mirror ledger.js) --------

#[error_code]
pub enum LedgerError {
  #[msg("only the oracle may record purchases")]
  NotOracle,
  #[msg("cents must be positive")]
  BadCents,
  #[msg("amount must be positive")]
  BadAmount,
  #[msg("genesis cannot be a mint beneficiary")]
  GenesisCannotMint,
  #[msg("insufficient balance")]
  Insufficient,
  #[msg("not the account owner")]
  NotOwner,
  #[msg("genesis may not out-hold a peer")]
  GenesisHumility,
  #[msg("arithmetic overflow")]
  Overflow,
}
