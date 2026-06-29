import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { DomainError } from '@shared/errors';
import type {
  FileStoragePort,
  FileUpload,
  RetrievedFile,
  StoredFile,
} from '@application/storage/ports/file-storage.port';

/** Internal record that also retains the raw buffer for inspection in tests. */
interface StoredEntry extends StoredFile {
  readonly buffer: Buffer;
}

/**
 * In-memory implementation of `FileStoragePort` for unit tests.
 *
 * @remarks
 * Files are stored in a `Map` keyed by their storage key. The raw `Buffer` is
 * retained alongside the `StoredFile` metadata so test code can inspect file
 * contents directly. `getUrl` returns a deterministic fake URL.
 */
export class InMemoryFileStorage implements FileStoragePort {
  private readonly files = new Map<string, StoredEntry>();

  /**
   * Stores a file under the given key.
   *
   * @param key - The storage object path (e.g. `"tenants/<tid>/payments/<id>.jpg"`).
   * @param file - The file data to store.
   * @returns Metadata for the stored file; never fails in this in-memory implementation.
   */
  async store(key: string, file: FileUpload): Promise<Result<StoredFile, DomainError>> {
    const entry: StoredEntry = {
      key,
      sizeBytes: file.sizeBytes,
      mimeType: file.mimeType,
      storedAt: new Date(),
      buffer: file.buffer,
    };
    this.files.set(key, entry);
    return ok({
      key: entry.key,
      sizeBytes: entry.sizeBytes,
      mimeType: entry.mimeType,
      storedAt: entry.storedAt,
    });
  }

  /**
   * Returns the stored file bytes and MIME type.
   *
   * @param key - The storage object path.
   * @returns The file data, or `NotFoundError` if the key has not been stored.
   */
  async retrieve(key: string): Promise<Result<RetrievedFile, DomainError>> {
    const entry = this.files.get(key);
    if (entry === undefined) {
      return err(new NotFoundError('StoredFile', key));
    }
    return ok({ buffer: entry.buffer, mimeType: entry.mimeType, sizeBytes: entry.sizeBytes });
  }

  /**
   * Returns a deterministic fake access URL for the stored file.
   *
   * @param key - The storage object path.
   * @returns A fake URL, or `NotFoundError` if the key has not been stored.
   */
  async getUrl(key: string): Promise<Result<string, DomainError>> {
    if (!this.files.has(key)) {
      return err(new NotFoundError('StoredFile', key));
    }
    return ok(`https://fake-storage.test/files/${encodeURIComponent(key)}`);
  }

  /**
   * Deletes a stored file by key.
   *
   * @param key - The storage object path to delete.
   * @returns `ok(void)` on success, or `NotFoundError` if the key does not exist.
   */
  async delete(key: string): Promise<Result<void, DomainError>> {
    if (!this.files.has(key)) {
      return err(new NotFoundError('StoredFile', key));
    }
    this.files.delete(key);
    return ok(undefined);
  }

  /**
   * Returns the raw buffer for an already-stored file; useful for test assertions.
   *
   * @param key - The storage object path.
   * @returns The stored `Buffer`, or `undefined` if the key was never stored.
   */
  getBuffer(key: string): Buffer | undefined {
    return this.files.get(key)?.buffer;
  }

  /** Total number of stored files. Useful in test assertions. */
  get size(): number {
    return this.files.size;
  }
}
