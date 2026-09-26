//! MedTrace domain rules: pure Rust, no Solana/Anchor dependencies.
//!
//! Every business rule the program enforces lives here, so it can be unit-tested
//! with plain `cargo test` (see `rules-tests/`) and reviewed without reading Anchor code.
//! `lib.rs` maps these results onto `PackStatus` / `MedError`.

/// Maximum serial length in bytes. It is also a PDA seed, and seeds are capped at 32 bytes.
pub const MAX_SERIAL_LEN: usize = 32;
/// Maximum batch length in bytes (fixed account space).
pub const MAX_BATCH_LEN: usize = 16;

/// Lifecycle of a pack. Order matters: it's the only legal direction of travel.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stage {
    Manufactured,
    InTransit,
    AtPharmacy,
    Dispensed,
}

/// Why a rule rejected an action. Mirrors `MedError` 1:1 (same names, same order).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rule {
    InvalidSerial,
    InvalidBatch,
    AlreadyExpired,
    NotHolder,
    SameHolder,
    InvalidStatus,
    NotAtPharmacy,
    AlreadyDispensed,
}

/// Serial: 1–32 bytes of `A-Z`, `0-9`, `-`.
///
/// Uppercase-only is a security rule, not cosmetics: the serial is the PDA seed, so
/// allowing `sq-000123` next to `SQ-000123` would let someone register a look-alike pack.
pub fn validate_serial(serial: &str) -> Result<(), Rule> {
    let ok_len = !serial.is_empty() && serial.len() <= MAX_SERIAL_LEN;
    let ok_chars = serial
        .bytes()
        .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'-');
    if ok_len && ok_chars {
        Ok(())
    } else {
        Err(Rule::InvalidSerial)
    }
}

/// Batch: 1–16 bytes of printable ASCII (no control characters).
pub fn validate_batch(batch: &str) -> Result<(), Rule> {
    let ok_len = !batch.is_empty() && batch.len() <= MAX_BATCH_LEN;
    let ok_chars = batch.bytes().all(|b| (0x20..=0x7e).contains(&b));
    if ok_len && ok_chars {
        Ok(())
    } else {
        Err(Rule::InvalidBatch)
    }
}

/// A pack can't be registered already expired.
pub fn validate_expiry(expiry: i64, now: i64) -> Result<(), Rule> {
    if expiry > now {
        Ok(())
    } else {
        Err(Rule::AlreadyExpired)
    }
}

/// Custody moves one hop forward per transfer (Tech Design ADR-3):
/// Manufactured → InTransit → AtPharmacy. Nothing moves after that.
pub fn next_stage_on_transfer(current: Stage) -> Result<Stage, Rule> {
    match current {
        Stage::Manufactured => Ok(Stage::InTransit),
        Stage::InTransit => Ok(Stage::AtPharmacy),
        Stage::AtPharmacy => Err(Rule::InvalidStatus),
        Stage::Dispensed => Err(Rule::AlreadyDispensed),
    }
}

/// The receiving wallet must be different from the current one.
pub fn check_new_holder<K: PartialEq>(current: &K, new_holder: &K) -> Result<(), Rule> {
    if current == new_holder {
        Err(Rule::SameHolder)
    } else {
        Ok(())
    }
}

/// Dispense exactly once, and only from a pharmacy. This is the anti-clone rule.
pub fn check_dispense(current: Stage) -> Result<(), Rule> {
    match current {
        Stage::AtPharmacy => Ok(()),
        Stage::Dispensed => Err(Rule::AlreadyDispensed),
        Stage::Manufactured | Stage::InTransit => Err(Rule::NotAtPharmacy),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serial_accepts_demo_format() {
        assert_eq!(validate_serial("SQ-000123"), Ok(()));
        assert_eq!(validate_serial(&"A".repeat(32)), Ok(()));
    }

    #[test]
    fn serial_rejects_empty_long_lowercase_and_symbols() {
        for bad in ["", "sq-000123", "SQ 000123", "SQ_000123", "SQ-00012é", &"A".repeat(33)] {
            assert_eq!(validate_serial(bad), Err(Rule::InvalidSerial), "{bad:?}");
        }
    }

    #[test]
    fn batch_rules() {
        assert_eq!(validate_batch("B-2026-09"), Ok(()));
        assert_eq!(validate_batch(&"B".repeat(16)), Ok(()));
        assert_eq!(validate_batch(""), Err(Rule::InvalidBatch));
        assert_eq!(validate_batch(&"B".repeat(17)), Err(Rule::InvalidBatch));
        assert_eq!(validate_batch("B\n1"), Err(Rule::InvalidBatch));
    }

    #[test]
    fn expiry_must_be_in_the_future() {
        assert_eq!(validate_expiry(101, 100), Ok(()));
        assert_eq!(validate_expiry(100, 100), Err(Rule::AlreadyExpired));
        assert_eq!(validate_expiry(0, 100), Err(Rule::AlreadyExpired));
    }

    #[test]
    fn transfer_walks_the_chain_one_hop_at_a_time() {
        assert_eq!(next_stage_on_transfer(Stage::Manufactured), Ok(Stage::InTransit));
        assert_eq!(next_stage_on_transfer(Stage::InTransit), Ok(Stage::AtPharmacy));
        assert_eq!(next_stage_on_transfer(Stage::AtPharmacy), Err(Rule::InvalidStatus));
        assert_eq!(next_stage_on_transfer(Stage::Dispensed), Err(Rule::AlreadyDispensed));
    }

    #[test]
    fn new_holder_must_differ() {
        assert_eq!(check_new_holder(&[1u8; 32], &[2u8; 32]), Ok(()));
        assert_eq!(check_new_holder(&[1u8; 32], &[1u8; 32]), Err(Rule::SameHolder));
    }

    #[test]
    fn dispense_only_once_and_only_at_pharmacy() {
        assert_eq!(check_dispense(Stage::AtPharmacy), Ok(()));
        assert_eq!(check_dispense(Stage::Dispensed), Err(Rule::AlreadyDispensed));
        assert_eq!(check_dispense(Stage::Manufactured), Err(Rule::NotAtPharmacy));
        assert_eq!(check_dispense(Stage::InTransit), Err(Rule::NotAtPharmacy));
    }

    #[test]
    fn full_lifecycle() {
        let mut s = Stage::Manufactured;
        s = next_stage_on_transfer(s).unwrap();
        s = next_stage_on_transfer(s).unwrap();
        assert_eq!(check_dispense(s), Ok(()));
        s = Stage::Dispensed;
        assert_eq!(check_dispense(s), Err(Rule::AlreadyDispensed)); // the clone
    }
}
