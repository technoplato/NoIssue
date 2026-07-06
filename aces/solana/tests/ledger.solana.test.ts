// =============================================
// ledger.solana.test.ts — canonical Anchor test
// on LOCALNET. `anchor test` boots a throwaway
// solana-test-validator, deploys the program,
// and runs this. It mirrors ledger.test.js so
// the on-chain and in-memory ledgers can never
// drift: same scenarios, same fairness laws.
//
// Localnet on purpose (Michael): devnet airdrops
// are flaky; a local validator is deterministic
// and free. To point at devnet instead, set the
// provider cluster and fund the wallet — the
// test body is identical.
// =============================================

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram }
  from "@solana/web3.js";
import { createHash } from "crypto";
import { assert } from "chai";

const RATE = 100; // must match the program

// sha256(refString) -> 32-byte ref id (the Ref
// PDA seed). Bounds any external order id to 32.
function refId(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

describe("ledger.solana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace
    .Ledger as Program;
  const pid = program.programId;

  // genesis + oracle identities
  const genesis = Keypair.generate();
  const oracle = Keypair.generate();
  const payer = (provider.wallet as any).payer;

  // PDA helpers
  const configPda = () =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("config")], pid)[0];
  const acctPda = (owner: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("acct"), owner.toBuffer()],
      pid)[0];
  const refPda = (ref: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("ref"), refId(ref)], pid)[0];

  const bal = async (owner: PublicKey) =>
    (await program.account.tokenAccount.fetch(
      acctPda(owner))).balance.toNumber();

  const openAccount = async (owner: PublicKey) =>
    program.methods.openAccount(owner)
      .accounts({
        account: acctPda(owner),
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();

  // wallets used across tests
  const buyer = Keypair.generate();
  const friend = Keypair.generate();

  it("initializes config", async () => {
    await program.methods
      .initialize(genesis.publicKey,
        oracle.publicKey)
      .accounts({
        config: configPda(),
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
    const c = await program.account.config
      .fetch(configPda());
    assert.ok(c.oracle.equals(oracle.publicKey));
    assert.equal(c.minted.toNumber(), 0);
  });

  it("oracle mints the $14.28 seed -> 142,800",
    async () => {
      await openAccount(buyer.publicKey);
      // fund the oracle so it can pay rent
      await provider.connection
        .requestAirdrop(oracle.publicKey, 1e9);
      await new Promise(r => setTimeout(r, 400));
      const ref = "shopify:order-1001";
      await program.methods
        .recordPurchase([...refId(ref)], // [u8;32]
          new anchor.BN(1428))
        .accounts({
          config: configPda(),
          backing: refPda(ref),
          beneficiary: acctPda(buyer.publicKey),
          oracle: oracle.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([oracle]).rpc();
      assert.equal(await bal(buyer.publicKey),
        1428 * RATE);
    });

  it("refuses to mint the same ref twice",
    async () => {
      const ref = "shopify:order-1001";
      let threw = false;
      try {
        await program.methods
          .recordPurchase([...refId(ref)],
            new anchor.BN(1428))
          .accounts({
            config: configPda(),
            backing: refPda(ref),
            beneficiary: acctPda(buyer.publicKey),
            oracle: oracle.publicKey,
            systemProgram:
              SystemProgram.programId,
          })
          .signers([oracle]).rpc();
      } catch (e) { threw = true; }
      assert.ok(threw, "double-mint must fail");
      assert.equal(await bal(buyer.publicKey),
        1428 * RATE);
    });

  it("refuses a non-oracle minter", async () => {
    const rogue = Keypair.generate();
    await provider.connection
      .requestAirdrop(rogue.publicKey, 1e9);
    await new Promise(r => setTimeout(r, 400));
    let threw = false;
    try {
      const ref = "rogue:1";
      await program.methods
        .recordPurchase([...refId(ref)],
          new anchor.BN(500))
        .accounts({
          config: configPda(),
          backing: refPda(ref),
          beneficiary: acctPda(buyer.publicKey),
          oracle: rogue.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([rogue]).rpc();
    } catch (e) { threw = true; }
    assert.ok(threw, "only the oracle mints");
  });

  it("transfers between accounts", async () => {
    await openAccount(friend.publicKey);
    await program.methods.transfer(
      new anchor.BN(42800))
      .accounts({
        config: configPda(),
        from: acctPda(buyer.publicKey),
        to: acctPda(friend.publicKey),
        signer: buyer.publicKey,
      })
      .signers([buyer]).rpc();
    assert.equal(await bal(friend.publicKey),
      42800);
  });

  it("enforces genesis humility", async () => {
    await openAccount(genesis.publicKey);
    // friend (42,800) tries to hand genesis
    // everything -> genesis would out-hold
    // friend -> must fail.
    let threw = false;
    try {
      await program.methods.transfer(
        new anchor.BN(42800))
        .accounts({
          config: configPda(),
          from: acctPda(friend.publicKey),
          to: acctPda(genesis.publicKey),
          signer: friend.publicKey,
        })
        .signers([friend]).rpc();
    } catch (e) { threw = true; }
    assert.ok(threw, "genesis cannot out-hold");
    assert.equal(await bal(genesis.publicKey), 0);
  });

  it("burns tokens (supply falls)", async () => {
    const before = (await program.account.config
      .fetch(configPda())).burned.toNumber();
    await program.methods.burn(new anchor.BN(800))
      .accounts({
        config: configPda(),
        account: acctPda(friend.publicKey),
        signer: friend.publicKey,
      })
      .signers([friend]).rpc();
    const after = (await program.account.config
      .fetch(configPda())).burned.toNumber();
    assert.equal(after - before, 800);
    assert.equal(await bal(friend.publicKey),
      42800 - 800);
  });
});
