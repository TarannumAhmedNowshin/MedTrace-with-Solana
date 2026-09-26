//! MedTrace: anti-counterfeit medicine tracking on Solana.
//!
//! One `Pack` PDA per physical medicine pack, keyed by its serial.
//! Custody: Manufactured → InTransit → AtPharmacy → Dispensed (terminal).
//! A pack can be dispensed exactly once, so a photocopied QR code scanned
//! later resolves to an already-dispensed pack. That is the anti-clone signal.
//!
//! Business rules live in `rules.rs` (pure Rust, unit-tested without Anchor).
//! Spec: docs/MedTrace_Tech_Design.md §3 / §3A.

use anchor_lang::prelude::*;

pub mod rules;
use rules::{Rule, Stage};

// Solana Playground replaces this with your program ID on first build.
declare_id!("11111111111111111111111111111111");

/// PDA seed prefix for Pack accounts: seeds = [PACK_SEED, serial_bytes].
pub const PACK_SEED: &[u8] = b"pack";

#[program]
pub mod medtrace {
    use super::*;

    /// Register a new pack. The signing manufacturer pays rent and becomes the first holder.
    pub fn mint_pack(ctx: Context<MintPack>, serial: String, batch: String, expiry: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        rules::validate_serial(&serial).map_err(to_err)?;
        rules::validate_batch(&batch).map_err(to_err)?;
        rules::validate_expiry(expiry, now).map_err(to_err)?;

        let manufacturer = ctx.accounts.manufacturer.key();
        let pack = &mut ctx.accounts.pack;
        pack.manufacturer = manufacturer;
        pack.holder = manufacturer;
        pack.status = PackStatus::Manufactured;
        pack.expiry = expiry;
        pack.dispensed_at = 0;
        pack.created_at = now;
        pack.bump = ctx.bumps.pack;
        pack.serial = serial.clone();
        pack.batch = batch.clone();

        emit!(PackMinted { serial, manufacturer, batch, expiry, ts: now });
        Ok(())
    }

    /// Hand the pack to the next custodian. Only the current holder can sign.
    /// Status advances one hop: Manufactured → InTransit → AtPharmacy.
    pub fn transfer_custody(ctx: Context<TransferCustody>, new_holder: Pubkey) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        rules::check_new_holder(&pack.holder, &new_holder).map_err(to_err)?;
        let next = rules::next_stage_on_transfer(pack.status.into()).map_err(to_err)?;

        let from = pack.holder;
        pack.holder = new_holder;
        pack.status = next.into();

        emit!(CustodyTransferred {
            serial: pack.serial.clone(),
            from,
            to: new_holder,
            status: pack.status,
            ts: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Sell the pack to a patient. Allowed exactly once, only by the pharmacy holding it.
    pub fn dispense(ctx: Context<Dispense>) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        rules::check_dispense(pack.status.into()).map_err(to_err)?;

        let now = Clock::get()?.unix_timestamp;
        pack.status = PackStatus::Dispensed;
        pack.dispensed_at = now;

        emit!(PackDispensed { serial: pack.serial.clone(), pharmacy: pack.holder, ts: now });
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(serial: String)]
pub struct MintPack<'info> {
    /// Fails with "already in use" if this serial was registered before, so serials are unique by construction.
    #[account(
        init,
        payer = manufacturer,
        space = 8 + Pack::INIT_SPACE,
        seeds = [PACK_SEED, serial.as_bytes()],
        bump
    )]
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub manufacturer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferCustody<'info> {
    #[account(
        mut,
        has_one = holder @ MedError::NotHolder
    )]
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[derive(Accounts)]
pub struct Dispense<'info> {
    #[account(
        mut,
        has_one = holder @ MedError::NotHolder
    )]
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

/// Layout: fixed-size fields FIRST so RPC memcmp filters have stable offsets
/// (manufacturer @8, holder @40, status @72). Strings last. Do not reorder after deploy.
#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub manufacturer: Pubkey, // offset 8
    pub holder: Pubkey,       // offset 40
    pub status: PackStatus,   // offset 72
    pub expiry: i64,          // unix seconds
    pub dispensed_at: i64,    // unix seconds, 0 = not dispensed
    pub created_at: i64,      // unix seconds
    pub bump: u8,
    #[max_len(32)]
    pub serial: String,
    #[max_len(16)]
    pub batch: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PackStatus {
    Manufactured,
    InTransit,
    AtPharmacy,
    Dispensed,
}

impl From<PackStatus> for Stage {
    fn from(s: PackStatus) -> Self {
        match s {
            PackStatus::Manufactured => Stage::Manufactured,
            PackStatus::InTransit => Stage::InTransit,
            PackStatus::AtPharmacy => Stage::AtPharmacy,
            PackStatus::Dispensed => Stage::Dispensed,
        }
    }
}

impl From<Stage> for PackStatus {
    fn from(s: Stage) -> Self {
        match s {
            Stage::Manufactured => PackStatus::Manufactured,
            Stage::InTransit => PackStatus::InTransit,
            Stage::AtPharmacy => PackStatus::AtPharmacy,
            Stage::Dispensed => PackStatus::Dispensed,
        }
    }
}

// ─── Events (for indexers / analytics) ───────────────────────────────────────

#[event]
pub struct PackMinted {
    pub serial: String,
    pub manufacturer: Pubkey,
    pub batch: String,
    pub expiry: i64,
    pub ts: i64,
}

#[event]
pub struct CustodyTransferred {
    pub serial: String,
    pub from: Pubkey,
    pub to: Pubkey,
    pub status: PackStatus,
    pub ts: i64,
}

#[event]
pub struct PackDispensed {
    pub serial: String,
    pub pharmacy: Pubkey,
    pub ts: i64,
}

// ─── Errors (codes 6000+, order is part of the public contract) ─────────────

#[error_code]
pub enum MedError {
    #[msg("Serial must be 1-32 characters of A-Z, 0-9 or '-'")]
    InvalidSerial, // 6000
    #[msg("Batch must be 1-16 printable characters")]
    InvalidBatch, // 6001
    #[msg("Expiry must be in the future")]
    AlreadyExpired, // 6002
    #[msg("Signer is not the current holder")]
    NotHolder, // 6003
    #[msg("New holder equals current holder")]
    SameHolder, // 6004
    #[msg("Transfer not allowed in current status")]
    InvalidStatus, // 6005
    #[msg("Pack must be at a pharmacy to dispense")]
    NotAtPharmacy, // 6006
    #[msg("Pack has already been dispensed")]
    AlreadyDispensed, // 6007
}

fn to_err(rule: Rule) -> Error {
    match rule {
        Rule::InvalidSerial => error!(MedError::InvalidSerial),
        Rule::InvalidBatch => error!(MedError::InvalidBatch),
        Rule::AlreadyExpired => error!(MedError::AlreadyExpired),
        Rule::NotHolder => error!(MedError::NotHolder),
        Rule::SameHolder => error!(MedError::SameHolder),
        Rule::InvalidStatus => error!(MedError::InvalidStatus),
        Rule::NotAtPharmacy => error!(MedError::NotAtPharmacy),
        Rule::AlreadyDispensed => error!(MedError::AlreadyDispensed),
    }
}
