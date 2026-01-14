/**
 * Storage adapter interface for swappable storage backends
 * Compatible with Supabase Storage API
 */

export interface StorageUploadOptions {
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
}

export interface StorageDownloadResult {
  data: Blob | null;
  error: { message: string } | null;
}

export interface StorageSignedUrlResult {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}

export interface StorageUploadResult {
  data: { path: string } | null;
  error: { message: string } | null;
}

export interface StorageRemoveResult {
  data: { name: string }[] | null;
  error: { message: string } | null;
}

export interface StoragePublicUrlResult {
  data: { publicUrl: string };
}

export interface StorageBucket {
  upload(
    path: string,
    file: File | Blob | Buffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult>;

  download(path: string): Promise<StorageDownloadResult>;

  createSignedUrl(
    path: string,
    expiresIn: number,
    options?: { download?: boolean }
  ): Promise<StorageSignedUrlResult>;

  remove(paths: string[]): Promise<StorageRemoveResult>;

  getPublicUrl(path: string): StoragePublicUrlResult;
}

export interface StorageAdapter {
  from(bucket: string): StorageBucket;
}
