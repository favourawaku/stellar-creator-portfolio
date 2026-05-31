import { getNetworkConfig, type NetworkName } from '@/lib/config/network';

export type ChainId = 'stellar' | 'ethereum' | 'polygon' | 'arbitrum';

export interface ChainInfo {
  id: ChainId;
  name: string;
  icon: string;
  nativeSymbol: string;
  color: string;
}

export interface SwapRoute {
  id: string;
  hops: Array<{ chain: ChainId; protocol: string; feeBps: number }>;
  estimatedMinutes: number;
  reliability: number;
}

export interface GasEstimate {
  sourceGas: string;
  destGas: string;
  bridgeFee: string;
  totalUsd: number;
  updatedAt: number;
}

export interface SwapQuote {
  fromChain: ChainId;
  toChain: ChainId;
  fromAmount: string;
  toAmount: string;
  route: SwapRoute;
  gas: GasEstimate;
  slippageBps: number;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: 'stellar', name: 'Stellar', icon: '✦', nativeSymbol: 'XLM', color: '#7B61FF' },
  { id: 'ethereum', name: 'Ethereum', icon: 'Ξ', nativeSymbol: 'ETH', color: '#627EEA' },
  { id: 'polygon', name: 'Polygon', icon: '⬡', nativeSymbol: 'MATIC', color: '#8247E5' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '◆', nativeSymbol: 'ETH', color: '#28A0F0' },
];

const ROUTE_TEMPLATES: Record<string, SwapRoute> = {
  'stellar-polygon': {
    id: 'stellar-polygon-v1',
    hops: [
      { chain: 'stellar', protocol: 'Allbridge', feeBps: 8 },
      { chain: 'polygon', protocol: 'Stellar AMM', feeBps: 5 },
    ],
    estimatedMinutes: 4,
    reliability: 0.97,
  },
  'stellar-ethereum': {
    id: 'stellar-eth-v2',
    hops: [
      { chain: 'stellar', protocol: 'Wormhole', feeBps: 12 },
      { chain: 'ethereum', protocol: 'Uniswap V3', feeBps: 6 },
    ],
    estimatedMinutes: 8,
    reliability: 0.94,
  },
  'ethereum-arbitrum': {
    id: 'eth-arb-native',
    hops: [{ chain: 'arbitrum', protocol: 'Arbitrum Bridge', feeBps: 3 }],
    estimatedMinutes: 2,
    reliability: 0.99,
  },
};

function routeKey(from: ChainId, to: ChainId): string {
  return `${from}-${to}`;
}

export function findSwapRoute(from: ChainId, to: ChainId): SwapRoute {
  const key = routeKey(from, to);
  const reverse = routeKey(to, from);
  return (
    ROUTE_TEMPLATES[key] ??
    ROUTE_TEMPLATES[reverse] ?? {
      id: `${from}-${to}-direct`,
      hops: [{ chain: from, protocol: 'Atomic HTLC', feeBps: 10 }],
      estimatedMinutes: 6,
      reliability: 0.92,
    }
  );
}

export async function estimateGas(
  from: ChainId,
  to: ChainId,
  amount: number,
): Promise<GasEstimate> {
  const network = getNetworkConfig();
  const baseGas = network.isTestnet ? 0.002 : 0.015;
  const bridgeMultiplier = from === to ? 1 : 2.4;

  return {
    sourceGas: `${(baseGas * bridgeMultiplier).toFixed(4)} ${SUPPORTED_CHAINS.find((c) => c.id === from)?.nativeSymbol ?? 'XLM'}`,
    destGas: `${(baseGas * 0.6).toFixed(4)} ${SUPPORTED_CHAINS.find((c) => c.id === to)?.nativeSymbol ?? 'ETH'}`,
    bridgeFee: `$${(amount * 0.003 * bridgeMultiplier).toFixed(2)}`,
    totalUsd: parseFloat((amount * 0.004 * bridgeMultiplier).toFixed(2)),
    updatedAt: Date.now(),
  };
}

export async function getSwapQuote(
  fromChain: ChainId,
  toChain: ChainId,
  fromAmount: string,
  slippageBps = 50,
): Promise<SwapQuote> {
  const amount = parseFloat(fromAmount) || 0;
  const route = findSwapRoute(fromChain, toChain);
  const gas = await estimateGas(fromChain, toChain, amount);

  const feeTotal = route.hops.reduce((acc, h) => acc + h.feeBps, 0);
  const toAmount = (amount * (1 - feeTotal / 10_000)).toFixed(4);

  return {
    fromChain,
    toChain,
    fromAmount,
    toAmount,
    route,
    gas,
    slippageBps,
  };
}

export function formatRoutePath(route: SwapRoute): string {
  return route.hops.map((h) => `${h.protocol} (${h.chain})`).join(' → ');
}

export function getChainInfo(id: ChainId): ChainInfo {
  return SUPPORTED_CHAINS.find((c) => c.id === id) ?? SUPPORTED_CHAINS[0];
}

export function isCrossChain(from: ChainId, to: ChainId): boolean {
  return from !== to;
}

export function getActiveNetworkLabel(): NetworkName {
  return getNetworkConfig().network;
}
