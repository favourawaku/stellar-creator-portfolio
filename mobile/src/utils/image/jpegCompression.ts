export interface JpegCompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  progressive?: boolean;
}

export interface CompressedImageResult {
  uri: string;
  width: number;
  height: number;
  estimatedBytes: number;
  quality: number;
}

function scaleDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Optimized JPEG compression routine.
 * Uses quality 0.82 as sweet spot for avatar/banner assets (size vs fidelity).
 */
export function compressToJpeg(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  options: JpegCompressionOptions = {},
): CompressedImageResult {
  const quality = options.quality ?? 0.82;
  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;

  const { width, height } = scaleDimensions(sourceWidth, sourceHeight, maxWidth, maxHeight);

  const pixelCount = width * height;
  const bytesPerPixel = quality > 0.75 ? 0.35 : 0.22;
  const estimatedBytes = Math.round(pixelCount * bytesPerPixel);

  return {
    uri: `${sourceUri}?compress=jpeg&q=${quality}&w=${width}&h=${height}`,
    width,
    height,
    estimatedBytes,
    quality,
  };
}

export function estimateJpegSize(width: number, height: number, quality = 0.82): number {
  return Math.round(width * height * (quality > 0.75 ? 0.35 : 0.22));
}

export function formatCompressionSavings(originalBytes: number, compressedBytes: number): string {
  if (originalBytes <= 0) return '0%';
  const saved = ((originalBytes - compressedBytes) / originalBytes) * 100;
  return `${Math.max(0, Math.round(saved))}% smaller`;
}
