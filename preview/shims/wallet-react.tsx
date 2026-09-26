import type { ReactNode } from "react";
const Pass = ({ children }: { children: ReactNode }) => <>{children}</>;
export const ConnectionProvider = Pass;
export const WalletProvider = Pass;
export const useWallet = () => ({ publicKey: null, connected: false });
export const useAnchorWallet = () => undefined;
export const useConnection = () => ({ connection: { getBalance: async () => 0 } });
