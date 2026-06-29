/**
 * MIME type successfully detected from a file's leading bytes.
 *
 * @remarks
 * Only types in the upload allowlist (SECURITY.md §4) are returned.
 */
export type DetectedMimeType = 'image/jpeg' | 'image/png' | 'application/pdf';

/**
 * Detects the MIME type of a file from its leading magic bytes.
 *
 * @remarks
 * Never trust the client-supplied `Content-Type` header or file extension
 * (SECURITY.md §4). Allowlist: JPEG (`FF D8 FF`), PNG (8-byte signature),
 * PDF (`%PDF` / `25 50 44 46`).
 *
 * @param buffer - The file buffer; must contain at least the first 8 bytes.
 * @returns The detected MIME type, or `null` if the content is not in the allowlist.
 */
export function detectMimeType(buffer: Buffer): DetectedMimeType | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // PDF: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  return null;
}
