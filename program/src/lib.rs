use anchor_lang::prelude::*;

// Solana Playground overwrites this on `build`. After deploying, paste the real
// Program ID here too so the repo mirror matches what is live on devnet.
declare_id!("11111111111111111111111111111111");

#[program]
pub mod medtrace {
    use super::*;

    /// Manufacturer registers a new pack. PDA init fails if the serial already exists.
    pub fn mint_pack(
        ctx: Context<MintPack>,
        serial: String,
        batch: String,
        expiry: i64,
    ) -> Result<()> {
        require!(serial.len() <= 32, MedError::SerialTooLong);
        require!(batch.len() <= 32, MedError::BatchTooLong);

        let pack = &mut ctx.accounts.pack;
        pack.manufacturer = ctx.accounts.manufacturer.key();
        pack.holder = ctx.accounts.manufacturer.key();
        pack.serial = serial;
        pack.batch = batch;
        pack.expiry = expiry;
        pack.status = Status::Manufactured;
        pack.dispensed_at = 0;
        Ok(())
    }

    /// Current holder hands custody to the next party in the chain.
    pub fn transfer_custody(ctx: Context<HolderAction>, new_holder: Pubkey) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != Status::Dispensed, MedError::AlreadyDispensed);
        pack.holder = new_holder;
        pack.status = Status::InTransit;
        Ok(())
    }

    /// Pharmacy sells the pack. Can only ever happen once.
    pub fn dispense(ctx: Context<HolderAction>) -> Result<()> {
        let pack = &mut ctx.accounts.pack;
        require!(pack.status != Status::Dispensed, MedError::AlreadyDispensed);
        pack.status = Status::Dispensed;
        pack.dispensed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(serial: String)]
pub struct MintPack<'info> {
    #[account(
        init,
        payer = manufacturer,
        space = 8 + Pack::INIT_SPACE,
        seeds = [b"pack", serial.as_bytes()],
        bump
    )] // PDA seeds = uniqueness: one account per serial, duplicates impossible
    pub pack: Account<'info, Pack>,
    #[account(mut)]
    pub manufacturer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HolderAction<'info> {
    #[account(mut, has_one = holder @ MedError::NotHolder)] // only the current custodian can act
    pub pack: Account<'info, Pack>,
    pub holder: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Pack {
    pub manufacturer: Pubkey,
    pub holder: Pubkey,
    #[max_len(32)]
    pub serial: String,
    #[max_len(32)]
    pub batch: String,
    pub expiry: i64,
    pub status: Status,
    pub dispensed_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status {
    Manufactured,
    InTransit,
    AtPharmacy,
    Dispensed,
}

#[error_code]
pub enum MedError {
    #[msg("Pack already dispensed")]
    AlreadyDispensed,
    #[msg("Only the current holder can do this")]
    NotHolder,
    #[msg("Serial too long (max 32 chars)")]
    SerialTooLong,
    #[msg("Batch too long (max 32 chars)")]
    BatchTooLong,
}
