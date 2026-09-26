# Offline type-check (NOT real Anchor)

`anchor-lang/` and `anchor-derive/` are tiny stubs of the Anchor API surface MedTrace uses.
They let `rustc` type-check and borrow-check `programs/medtrace/src/lib.rs` on a machine
with no crates.io access and no Solana toolchain:

    cargo check --offline --manifest-path program/tools/offline-check/medtrace-check/Cargo.toml

They generate no real serialization, constraints or IDL. The real build is
Solana Playground (or `anchor build`). Use this only as a fast "does it compile" check.
