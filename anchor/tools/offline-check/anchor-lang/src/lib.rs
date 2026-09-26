//! Offline type-check stub of the anchor_lang API surface MedTrace uses. NOT real Anchor.
use std::marker::PhantomData;
use std::ops::{Deref, DerefMut};
pub mod error { #[derive(Debug)] pub struct Error; }
pub trait Bumps { type Bumps; }
pub trait Owned {}
pub type Result<T> = std::result::Result<T, error::Error>;
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)] pub struct Pubkey([u8; 32]);
impl Pubkey { pub const fn new_from_array(a: [u8; 32]) -> Self { Pubkey(a) } }
pub struct Context<'a, 'b, 'c, 'info, T: Bumps> { pub accounts: &'a mut T, pub bumps: T::Bumps, _p: PhantomData<(&'b (), &'c (), &'info ())> }
pub struct Account<'info, T: Owned> { inner: T, _p: PhantomData<&'info ()> }
impl<'info, T: Owned> Deref for Account<'info, T> { type Target = T; fn deref(&self) -> &T { &self.inner } }
impl<'info, T: Owned> DerefMut for Account<'info, T> { fn deref_mut(&mut self) -> &mut T { &mut self.inner } }
pub struct Signer<'info> { k: Pubkey, _p: PhantomData<&'info ()> }
impl<'info> Signer<'info> { pub fn key(&self) -> Pubkey { self.k } }
pub struct System;
pub struct Program<'info, T> { _p: PhantomData<(&'info (), T)> }
pub struct Clock { pub unix_timestamp: i64 }
impl Clock { pub fn get() -> Result<Clock> { Ok(Clock { unix_timestamp: 0 }) } }
#[macro_export] macro_rules! declare_id { ($s:literal) => { pub static ID: $crate::Pubkey = $crate::Pubkey::new_from_array([0; 32]); }; }
#[macro_export] macro_rules! emit { ($e:expr) => { let _ = $e; }; }
#[macro_export] macro_rules! error { ($e:expr) => { $crate::error::Error::from($e) }; }
pub mod prelude {
    pub use super::{error::Error, Account, Bumps, Clock, Context, Program, Pubkey, Result, Signer, System};
    pub use anchor_derive_stub::{account, error_code, event, program, Accounts, AnchorDeserialize, AnchorSerialize, InitSpace};
    pub use crate::{declare_id, emit, error};
    pub use crate as anchor_lang;
}
