import { config } from "./medtrace/config";

function clusterParam(): string {
  switch (config.cluster) {
    case "mainnet-beta":
      return "";
    case "localnet":
      return `?cluster=custom&customUrl=${encodeURIComponent(config.rpcUrl)}`;
    default:
      return `?cluster=${config.cluster}`;
  }
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}${clusterParam()}`;

export const explorerAddress = (addr: string) =>
  addr.startsWith("mock:") ? null : `https://explorer.solana.com/address/${addr}${clusterParam()}`;
