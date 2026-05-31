'use client';

import dynamic from 'next/dynamic';
import { HydrationSafe } from '@/lib/hydration/hydration-safe';

const SwapLauncher = dynamic(
  () => import('@/components/swap/swap-launcher').then((m) => m.SwapLauncher),
  { ssr: false, loading: () => null },
);

/** Defers client-only swap UI hydration so RSC shell streams first. */
export function DeferredSwapLauncher() {
  return (
    <HydrationSafe fallback={null}>
      <SwapLauncher />
    </HydrationSafe>
  );
}
