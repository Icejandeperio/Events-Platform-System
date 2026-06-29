import type { Result } from '@shared/result';
import type { DomainError } from '@shared/errors';

/**
 * An in-memory file ready to be stored (e.g. a proof-of-payment upload).
 *
 * @remarks
 * `sizeBytes` must match `buffer.byteLength`. Validation of MIME type and
 * maximum file size is the responsibility of the caller (use-case layer).
 */
export interface FileUpload {
  /** Raw file bytes. */
  readonly buffer: Buffer;
  /** MIME type as declared by the client (e.g. `"image/jpeg"`). */
  readonly mimeType: string;
  /** Original filename as provided by the client; used only for logging. */
  readonly originalName: string;
  /** Size in bytes; must equal `buffer.byteLength`. */
  readonly sizeBytes: number;
}

/**
 * Metadata returned after a file has been successfully stored.
 *
 * @remarks
 * The `key` is the storage object path; pass it to `getUrl()` to retrieve a
 * time-limited access URL. Never store the URL — it may expire (SECURITY.md §4).
 */
export interface StoredFile {
  /** Opaque storage key (object path). Use `getUrl()` to generate an access URL. */
  readonly key: string;
  /** Final size in bytes as stored. */
  readonly sizeBytes: number;
  /** MIME type recorded at upload time. */
  readonly mimeType: string;
  /** Server-side timestamp of when the file was written. */
  readonly storedAt: Date;
}

/**
 * A file retrieved from storage, with MIME type derived from magic bytes.
 *
 * @remarks
 * Used by the authenticated serve route to stream file bytes to the client
 * without trusting any stored MIME metadata — the type is always re-derived
 * from the actual content signature (SECURITY.md §4).
 */
export interface RetrievedFile {
  /** Raw file bytes. */
  readonly buffer: Buffer;
  /**
   * MIME type derived from magic-byte inspection of `buffer`.
   * Never taken from stored metadata or client-supplied headers.
   */
  readonly mimeType: string;
  /** Size in bytes. */
  readonly sizeBytes: number;
}

/**
 * Driven port — blob/file storage for user-uploaded content.
 *
 * @remarks
 * Proof-of-payment images and other participant uploads are stored via this
 * port. `InMemoryFileStorage` is used in tests; `LocalDiskStorageAdapter` is
 * used for local dev; a Vercel Blob or R2 adapter replaces it in production
 * (ARCHITECTURE.md §5, FEATURES.md §gateway_payments).
 * Never return a direct storage URL to the client — generate a signed / CDN URL
 * through `getUrl()` to avoid broken links and enforce access control (SECURITY.md §4).
 */
export interface FileStoragePort {
  /**
   * Stores a file at the given key; overwrites if the key already exists.
   *
   * @param key - The storage object path (e.g. `"tenants/<tid>/payments/<uuid>"`).
   * @param file - The file data to store.
   * @returns Metadata for the stored file, or `DomainError` on storage failure.
   */
  store(key: string, file: FileUpload): Promise<Result<StoredFile, DomainError>>;

  /**
   * Retrieves a stored file's raw bytes and MIME type (derived from magic bytes).
   *
   * @remarks
   * Used by the authenticated serve route. The returned `mimeType` is derived
   * from the file's magic bytes at retrieval time — never from stored metadata.
   * @param key - The storage object path returned by `store()`.
   * @returns The file bytes and detected MIME type, or `DomainError` if not found.
   */
  retrieve(key: string): Promise<Result<RetrievedFile, DomainError>>;

  /**
   * Generates a time-limited access URL for a stored file.
   *
   * @param key - The storage object path returned by `store()`.
   * @returns A URL the client can use to download the file, or `DomainError` if the key is not found.
   */
  getUrl(key: string): Promise<Result<string, DomainError>>;

  /**
   * Deletes a stored file.
   *
   * @param key - The storage object path to delete.
   * @returns `ok(void)` on success, or `DomainError` if the key is not found or deletion fails.
   */
  delete(key: string): Promise<Result<void, DomainError>>;
}
