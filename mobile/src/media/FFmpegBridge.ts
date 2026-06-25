import { NativeModules, Platform } from 'react-native';

const { StellarFFmpeg } = NativeModules;

export interface TrimResult {
  outputUri: string;
  durationMs: number;
  fileSizeBytes: number;
  processingMs: number;
}

export interface TrimOptions {
  videoBitrate?: number;
  audioBitrate?: number;
  hardwareEncoding?: boolean;
}

/**
 * Expose trimVideo from the native bridge.
 * Trims the video from startMs to endMs, enforcing 1080p/30fps export.
 *
 * @param inputPath  Absolute path to the source MP4 file.
 * @param startMs    Start offset in milliseconds.
 * @param endMs      End offset in milliseconds.
 * @param options    Bitrates and hardware acceleration settings.
 */
export async function trimVideo(
  inputPath: string,
  startMs: number,
  endMs: number,
  options?: TrimOptions
): Promise<TrimResult> {
  if (!StellarFFmpeg) {
    throw new Error('StellarFFmpeg native bridge module is not linked or available');
  }

  // Force maximum clip duration of 60 seconds on trim invocation
  const trimDuration = endMs - startMs;
  if (trimDuration > 60000) {
    throw new Error('Maximum clip length of 60 seconds exceeded');
  }

  const outputUri = inputPath.replace(/\.[^.]+$/, `_trimmed.mp4`);

  return StellarFFmpeg.trimVideo({
    inputUri: inputPath,
    outputUri,
    startMs,
    endMs,
    videoBitrate: options?.videoBitrate ?? 4000,
    audioBitrate: options?.audioBitrate ?? 128,
    hardwareEncoding: options?.hardwareEncoding ?? true,
  });
}
