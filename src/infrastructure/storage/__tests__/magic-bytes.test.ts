import { describe, expect, it } from 'vitest';
import { detectMimeType } from '../magic-bytes';

describe('detectMimeType', () => {
  it('detects JPEG from FF D8 FF magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(detectMimeType(buf)).toBe('image/jpeg');
  });

  it('detects PNG from 8-byte magic signature', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectMimeType(buf)).toBe('image/png');
  });

  it('detects PDF from %PDF magic bytes', () => {
    const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(detectMimeType(buf)).toBe('application/pdf');
  });

  it('returns null for unknown content', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(detectMimeType(buf)).toBeNull();
  });

  it('returns null for a buffer shorter than 4 bytes', () => {
    expect(detectMimeType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('returns null for GIF (not in allowlist)', () => {
    // GIF89a signature
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
    expect(detectMimeType(buf)).toBeNull();
  });

  it('returns null for WEBP (not in allowlist)', () => {
    // RIFF....WEBP
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    expect(detectMimeType(buf)).toBeNull();
  });

  it('rejects a buffer with correct length but wrong JPEG bytes', () => {
    // FF D8 FE (not FF D8 FF)
    const buf = Buffer.from([0xff, 0xd8, 0xfe, 0xe0]);
    expect(detectMimeType(buf)).toBeNull();
  });

  it('rejects a 7-byte buffer that would be truncated PNG', () => {
    // PNG signature needs 8 bytes; 7 bytes is insufficient
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
    expect(detectMimeType(buf)).toBeNull();
  });
});
