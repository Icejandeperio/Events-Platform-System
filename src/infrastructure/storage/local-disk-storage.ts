import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError, ValidationError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import type {
  FileStoragePort,
  FileUpload,
  RetrievedFile,
  StoredFile,
} from '@application/storage/ports/file-storage.port';
import { detectMimeType } from './magic-bytes';

/**
 * Local-disk implementation of `FileStoragePort` for development.
 *
 * @remarks
 * Files are written to `<storageRoot>/<key>` where `storageRoot` defaults to
 * `<cwd>/storage`. The `storage/` directory sits outside `public/` and is
 * gitignored — files are never publicly accessible; they are served exclusively
 * through the authenticated `GET /api/payments/[paymentId]/proof/serve` route
 * (SECURITY.md §4).
 *
 * Magic-byte validation runs on every `store()` and `retrieve()` call. The MIME
 * type recorded in `StoredFile` and `RetrievedFile` is always derived from the
 * actual file content, never from the client-declared `Content-Type` header.
 *
 * In production, swap this adapter for a Vercel Blob or R2 adapter without
 * touching any domain or application code (ARCHITECTURE.md §5).
 */
export class LocalDiskStorageAdapter implements FileStoragePort {
  /**
   * @param storageRoot - Absolute path to the root storage directory (e.g. `path.join(cwd, 'storage')`).
   */
  constructor(private readonly storageRoot: string) {}

  /**
   * Validates magic bytes and writes the file to disk under the given key.
   *
   * @param key - Storage object path (e.g. `"tenants/<tid>/payments/<uuid>"`). Used as the relative file path.
   * @param file - The file data to store. `mimeType` is ignored; magic bytes determine the accepted type.
   * @returns Metadata with the magic-byte-detected MIME type, or `ValidationError` if content is not JPEG/PNG/PDF.
   */
  async store(key: string, file: FileUpload): Promise<Result<StoredFile, DomainError>> {
    const detected = detectMimeType(file.buffer);
    if (detected === null) {
      return err(
        new ValidationError(
          'File content does not match an allowed type. Accepted: JPEG, PNG, PDF.',
          'file',
        ),
      );
    }

    const filePath = join(this.storageRoot, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.buffer);

    return ok({
      key,
      sizeBytes: file.buffer.byteLength,
      mimeType: detected,
      storedAt: new Date(),
    });
  }

  /**
   * Reads stored bytes from disk and re-validates magic bytes on retrieval.
   *
   * @param key - The storage object path.
   * @returns The raw bytes and magic-byte-detected MIME type, or `NotFoundError` if absent.
   */
  async retrieve(key: string): Promise<Result<RetrievedFile, DomainError>> {
    const filePath = join(this.storageRoot, key);
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch {
      return err(new NotFoundError('StoredFile', key));
    }

    // Re-validate on every retrieval — do not trust on-disk content without
    // re-checking the signature (detects corruption or out-of-band tampering).
    const mimeType = detectMimeType(buffer);
    if (mimeType === null) {
      return err(new ValidationError('Stored file has an invalid content signature.', 'file'));
    }

    return ok({ buffer, mimeType, sizeBytes: buffer.byteLength });
  }

  /**
   * Returns a route-relative URL for the authenticated serve route.
   *
   * @remarks
   * In production this would be a signed Blob/R2 URL. In dev, files are
   * served through `GET /api/proof?key=<encoded-key>` which enforces auth.
   * @param key - The storage object path.
   * @returns A local route URL, or `NotFoundError` if the file is absent.
   */
  async getUrl(key: string): Promise<Result<string, DomainError>> {
    const filePath = join(this.storageRoot, key);
    try {
      await access(filePath);
    } catch {
      return err(new NotFoundError('StoredFile', key));
    }
    return ok(`/api/proof?key=${encodeURIComponent(key)}`);
  }

  /**
   * Deletes a stored file from disk.
   *
   * @param key - The storage object path.
   * @returns `ok(void)` on success, or `NotFoundError` if the file does not exist.
   */
  async delete(key: string): Promise<Result<void, DomainError>> {
    const filePath = join(this.storageRoot, key);
    try {
      await unlink(filePath);
    } catch {
      return err(new NotFoundError('StoredFile', key));
    }
    return ok(undefined);
  }
}
