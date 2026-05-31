'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  SUPPORTED_CHAINS,
  getSwapQuote,
  formatRoutePath,
  getChainInfo,
  type ChainId,
  type SwapQuote,
} from '@/lib/swap/cross-chain-sdk';
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
  Loader2,
  Route,
  X,
  Zap,
} from 'lucide-react';

interface CrossChainSwapModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'select' | 'review' | 'confirm' | 'success';

export function CrossChainSwapModal({ open, onClose }: CrossChainSwapModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [fromChain, setFromChain] = useState<ChainId>('stellar');
  const [toChain, setToChain] = useState<ChainId>('polygon');
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [gasRefreshing, setGasRefreshing] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setQuote(null);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'review' && step !== 'confirm') return;
    let cancelled = false;

    const refresh = async () => {
      setGasRefreshing(true);
      const q = await getSwapQuote(fromChain, toChain, amount);
      if (!cancelled) {
        setQuote(q);
        setGasRefreshing(false);
      }
    };

    void refresh();
    const interval = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, fromChain, toChain, amount]);

  const handleContinue = useCallback(async () => {
    if (step === 'select') {
      setLoading(true);
      const q = await getSwapQuote(fromChain, toChain, amount);
      setQuote(q);
      setLoading(false);
      setStep('review');
    } else if (step === 'review') {
      setStep('confirm');
    } else if (step === 'confirm') {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 1500));
      setLoading(false);
      setStep('success');
    }
  }, [step, fromChain, toChain, amount]);

  if (!open) return null;

  const fromInfo = getChainInfo(fromChain);
  const toInfo = getChainInfo(toChain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cross-chain atomic swap"
        className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Cross-Chain Swap</h2>
            <p className="text-xs text-muted-foreground">
              Step {step === 'select' ? 1 : step === 'review' ? 2 : step === 'confirm' ? 3 : 4} of 4
            </p>
          </div>
          <button onClick={onClose} aria-label="Close swap modal" className="p-1 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 min-h-[320px]">
          {step === 'select' && (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium">From</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => setFromChain(chain.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                        fromChain === chain.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-lg">{chain.icon}</span>
                      <span className="text-sm font-medium">{chain.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">To</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUPPORTED_CHAINS.filter((c) => c.id !== fromChain).map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => setToChain(chain.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                        toChain === chain.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-lg">{chain.icon}</span>
                      <span className="text-sm font-medium">{chain.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="swap-amount" className="text-sm font-medium">Amount ({fromInfo.nativeSymbol})</label>
                <input
                  id="swap-amount"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
                />
              </div>
            </>
          )}

          {step === 'review' && quote && (
            <>
              <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">You send</span>
                  <span className="font-semibold">{quote.fromAmount} {fromInfo.nativeSymbol}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">You receive</span>
                  <span className="font-semibold text-primary">≈ {quote.toAmount} {toInfo.nativeSymbol}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Route className="h-4 w-4 text-primary" />
                  Routing Path
                </div>
                <p className="text-xs text-muted-foreground font-mono">{formatRoutePath(quote.route)}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>~{quote.route.estimatedMinutes} min</span>
                  <span>{Math.round(quote.route.reliability * 100)}% reliability</span>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Gas Estimates
                    {gasRefreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Source</p>
                    <p className="font-mono font-medium">{quote.gas.sourceGas}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Destination</p>
                    <p className="font-mono font-medium">{quote.gas.destGas}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bridge fee: {quote.gas.bridgeFee} · Total ≈ ${quote.gas.totalUsd.toFixed(2)}
                </p>
              </div>
            </>
          )}

          {step === 'confirm' && quote && (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm text-muted-foreground">Confirm atomic swap</p>
              <p className="text-2xl font-bold">
                {quote.fromAmount} {fromInfo.nativeSymbol}
                <ChevronRight className="inline h-5 w-5 mx-2 text-muted-foreground" />
                {quote.toAmount} {toInfo.nativeSymbol}
              </p>
              <p className="text-xs text-muted-foreground">
                Slippage tolerance: {quote.slippageBps / 100}% · HTLC lock initiated on {fromInfo.name}
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold">Swap Initiated</p>
              <p className="text-sm text-muted-foreground text-center">
                Your cross-chain atomic swap is processing. Funds will arrive in ~{quote?.route.estimatedMinutes ?? 5} minutes.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          {step !== 'success' && step !== 'select' && (
            <Button variant="outline" onClick={() => setStep(step === 'confirm' ? 'review' : 'select')} className="flex-1">
              Back
            </Button>
          )}
          {step === 'success' ? (
            <Button onClick={onClose} className="flex-1">Done</Button>
          ) : (
            <Button onClick={() => void handleContinue()} disabled={loading} className="flex-1 gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 'select' ? 'Continue' : step === 'review' ? 'Review & Confirm' : 'Execute Swap'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
