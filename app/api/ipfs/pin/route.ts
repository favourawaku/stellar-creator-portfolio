import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function sha256ToCid(sha256: string): string {
  return `bafy${sha256.slice(0, 52)}`;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  const expectedSha256 = String(form.get('sha256') ?? '');

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const sha256 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (expectedSha256 && sha256 !== expectedSha256.toLowerCase()) {
    return NextResponse.json({ error: 'Hash mismatch' }, { status: 422 });
  }

  const cid = sha256ToCid(sha256);
  const gatewayUrl = `https://ipfs.io/ipfs/${cid}`;

  return NextResponse.json({
    cid,
    sha256,
    size: buffer.byteLength,
    gatewayUrl,
  });
}
