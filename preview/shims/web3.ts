export const LAMPORTS_PER_SOL = 1_000_000_000;
export class PublicKey { constructor(private k: string) {} toBase58() { return this.k; } }
export class Connection {}
