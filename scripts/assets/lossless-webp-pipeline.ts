import * as crypto from 'crypto';
import * as fs from 'fs';
import sharp from 'sharp';

export interface LosslessWebpAnalysis {
  readonly encoded: Buffer;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savingsRatio: number;
  readonly sourceSha256: string;
  readonly outputSha256: string;
  readonly visiblePixelsEqual: true;
}

export interface LosslessWebpPipelineOptions {
  readonly effort?: number;
}

export interface LossyWebpAnalysis {
  readonly encoded: Buffer;
  readonly width: number;
  readonly height: number;
  readonly hasAlpha: boolean;
  readonly quality: number;
  readonly sourceBytes: number;
  readonly outputBytes: number;
  readonly savedBytes: number;
  readonly savingsRatio: number;
  readonly sourceSha256: string;
  readonly outputSha256: string;
  readonly visiblePixelsEqual: false;
}

export interface LossyWebpPipelineOptions {
  readonly quality: number;
  readonly effort?: number;
}

export function sha256Buffer(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function visibleRgbaPixelsEqual(
  source: Buffer,
  output: Buffer
): boolean {
  if (source.length !== output.length || source.length % 4 !== 0) return false;
  for (let offset = 0; offset < source.length; offset += 4) {
    const sourceAlpha = source[offset + 3];
    if (sourceAlpha !== output[offset + 3]) return false;
    if (
      sourceAlpha > 0
      && (
        source[offset] !== output[offset]
        || source[offset + 1] !== output[offset + 1]
        || source[offset + 2] !== output[offset + 2]
      )
    ) {
      return false;
    }
  }
  return true;
}

export async function analyzeLosslessWebp(
  sourcePath: string,
  options: LosslessWebpPipelineOptions = {}
): Promise<LosslessWebpAnalysis> {
  const source = fs.readFileSync(sourcePath);
  const encoded = await sharp(source, { failOn: 'error' })
    .webp({
      lossless: true,
      effort: options.effort ?? 6,
      smartSubsample: false
    })
    .toBuffer();
  const [sourceMetadata, outputMetadata, sourceRaw, outputRaw] = await Promise.all([
    sharp(source, { failOn: 'error' }).metadata(),
    sharp(encoded, { failOn: 'error' }).metadata(),
    sharp(source, { failOn: 'error' }).ensureAlpha().raw().toBuffer(),
    sharp(encoded, { failOn: 'error' }).ensureAlpha().raw().toBuffer()
  ]);
  if (
    sourceMetadata.width !== outputMetadata.width
    || sourceMetadata.height !== outputMetadata.height
  ) {
    throw new Error(`lossless WebP dimension mismatch: ${sourcePath}`);
  }
  if (!visibleRgbaPixelsEqual(sourceRaw, outputRaw)) {
    throw new Error(`lossless WebP visible pixel mismatch: ${sourcePath}`);
  }
  const sourceBytes = source.length;
  const outputBytes = encoded.length;
  const savedBytes = sourceBytes - outputBytes;
  return Object.freeze({
    encoded,
    width: sourceMetadata.width || 0,
    height: sourceMetadata.height || 0,
    hasAlpha: sourceMetadata.hasAlpha === true,
    sourceBytes,
    outputBytes,
    savedBytes,
    savingsRatio: sourceBytes > 0 ? savedBytes / sourceBytes : 0,
    sourceSha256: sha256Buffer(source),
    outputSha256: sha256Buffer(encoded),
    visiblePixelsEqual: true as const
  });
}

// Lossy WebP for large photographic textures (board surfaces, table cloths,
// backgrounds). Download size dominates start-up time on real connections, so
// these trade invisible pixel differences for a 5-20x smaller transfer.
export async function analyzeLossyWebp(
  sourcePath: string,
  options: LossyWebpPipelineOptions
): Promise<LossyWebpAnalysis> {
  const quality = Number(options.quality);
  if (!(Number.isInteger(quality) && quality >= 50 && quality <= 100)) {
    throw new Error(`lossy WebP quality must be an integer between 50 and 100: ${sourcePath}`);
  }
  const source = fs.readFileSync(sourcePath);
  const encoded = await sharp(source, { failOn: 'error' })
    .webp({
      lossless: false,
      quality,
      alphaQuality: 100,
      effort: options.effort ?? 6,
      smartSubsample: true
    })
    .toBuffer();
  const [sourceMetadata, outputMetadata] = await Promise.all([
    sharp(source, { failOn: 'error' }).metadata(),
    sharp(encoded, { failOn: 'error' }).metadata()
  ]);
  if (
    sourceMetadata.width !== outputMetadata.width
    || sourceMetadata.height !== outputMetadata.height
  ) {
    throw new Error(`lossy WebP dimension mismatch: ${sourcePath}`);
  }
  const sourceBytes = source.length;
  const outputBytes = encoded.length;
  const savedBytes = sourceBytes - outputBytes;
  return Object.freeze({
    encoded,
    width: sourceMetadata.width || 0,
    height: sourceMetadata.height || 0,
    hasAlpha: sourceMetadata.hasAlpha === true,
    quality,
    sourceBytes,
    outputBytes,
    savedBytes,
    savingsRatio: sourceBytes > 0 ? savedBytes / sourceBytes : 0,
    sourceSha256: sha256Buffer(source),
    outputSha256: sha256Buffer(encoded),
    visiblePixelsEqual: false as const
  });
}

export function materializeLosslessWebp(
  outputPath: string,
  encoded: Buffer,
  checkOnly: boolean
): void {
  if (checkOnly) {
    if (!fs.existsSync(outputPath)) {
      throw new Error(`missing lossless WebP output: ${outputPath}`);
    }
    if (!fs.readFileSync(outputPath).equals(encoded)) {
      throw new Error(`stale lossless WebP output: ${outputPath}`);
    }
    return;
  }
  fs.writeFileSync(outputPath, encoded);
}
