export type {
  StorageAdapter,
  StorageBucket,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageSignedUrlResult,
  StorageRemoveResult,
  StoragePublicUrlResult,
} from "./types";

export { getMinioClient, getMinioPublicUrl, BUCKETS, type BucketName } from "./minio-client";
export { createMinioAdapter } from "./minio-adapter";
export { initBuckets } from "./init-buckets";

import { createMinioAdapter } from "./minio-adapter";
import type { StorageAdapter } from "./types";

let storageAdapter: StorageAdapter | null = null;

/**
 * Check if MinIO storage should be used
 */
export function useMinioStorage(): boolean {
  return (
    process.env.USE_MINIO === "true" ||
    process.env.MINIO_ENDPOINT !== undefined
  );
}

/**
 * Get the storage adapter instance
 * Uses MinIO if configured, otherwise throws
 * (Supabase storage requires passing the Supabase client)
 */
export function getStorageAdapter(): StorageAdapter {
  if (storageAdapter) {
    return storageAdapter;
  }

  if (!useMinioStorage()) {
    throw new Error(
      "MinIO storage is not configured. Set MINIO_ENDPOINT or USE_MINIO=true"
    );
  }

  storageAdapter = createMinioAdapter();
  return storageAdapter;
}
