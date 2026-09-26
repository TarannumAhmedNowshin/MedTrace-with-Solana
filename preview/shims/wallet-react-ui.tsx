import type { ReactNode } from "react";
export const WalletModalProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
export const WalletMultiButton = () => <button className="btn btn-primary btn-sm" type="button">Select Wallet</button>;
