'use client';

import { useCallback, useRef, useState } from 'react';
import {
  uploadToIpfs,
  retrieveFromIpfs,
  loadPinRegistry,
  savePinEntry,
  type IpfsPinEntry,
} from '@/lib/ipfs/client';
import { IPFS_GATEWAYS } from '@/lib/ipfs/gateways';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function IpfsStorageBrowser() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [pins, setPins] = useState<IpfsPinEntry[]>(() => loadPinRegistry());
  const [verifyingCid, setVerifyingCid] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploadState('uploading');
    setProgress(0);
    setError('');

    try {
      const result = await uploadToIpfs(file, setProgress);
      const entry: IpfsPinEntry = {
        cid: result.cid,
        sha256: result.sha256,
        name: file.name,
        size: result.size,
        pinnedAt: new Date().toISOString(),
        gatewayUrl: result.gatewayUrl,
      };
      savePinEntry(entry);
      setPins(loadPinRegistry());
      setUploadState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleUpload(file);
      e.target.value = '';
    },
    [handleUpload],
  );

  const handleVerifyAndDownload = useCallback(async (pin: IpfsPinEntry) => {
    setVerifyingCid(pin.cid);
    setError('');
    try {
      const { blob, verified, gateway } = await retrieveFromIpfs(pin.cid, pin.sha256);
      if (!verified) throw new Error('Cryptographic verification failed');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pin.name;
      a.click();
      URL.revokeObjectURL(url);

      window.open(`${gateway}?verified=1`, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retrieval failed');
    } finally {
      setVerifyingCid(null);
    }
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Decentralized Storage Browser</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload files directly from your browser to IPFS pinned storage. Content is verified via SHA-256 on retrieval.
        </p>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Select file to upload to IPFS"
        />

        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploadState === 'uploading'}
          className="gap-2"
        >
          {uploadState === 'uploading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {progress}%
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Pin to IPFS
            </>
          )}
        </Button>

        {uploadState === 'uploading' && (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {uploadState === 'done' && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Upload complete — content pinned
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <XCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Fallback Gateways
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 font-mono">
          {IPFS_GATEWAYS.map((gw) => (
            <li key={gw}>{gw}</li>
          ))}
        </ul>
      </div>

      {pins.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Pinned Files</h3>
          <ul className="divide-y divide-border">
            {pins.map((pin) => (
              <li key={pin.cid} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{pin.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{pin.cid}</p>
                  <p className="text-xs text-muted-foreground">SHA-256: {pin.sha256.slice(0, 16)}…</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1"
                  disabled={verifyingCid === pin.cid}
                  onClick={() => void handleVerifyAndDownload(pin)}
                >
                  {verifyingCid === pin.cid ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  View
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
