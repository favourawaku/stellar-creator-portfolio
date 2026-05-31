'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CrossChainSwapModal } from '@/components/swap/cross-chain-swap-modal';
import { ArrowLeftRight } from 'lucide-react';

export function SwapLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 hidden lg:flex"
        onClick={() => setOpen(true)}
      >
        <ArrowLeftRight className="h-4 w-4" />
        Bridge
      </Button>
      <CrossChainSwapModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
