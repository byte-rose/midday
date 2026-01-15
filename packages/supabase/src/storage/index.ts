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

export type { BucketName } from "./minio-client";

// Lazy-load these to avoid loading minio client in edge runtime
export async function getMinioClient() {
  const { getMinioClient: getClient } = await import("./minio-client");
  return getClient();
}

export async function getMinioPublicUrl(bucket: string, filePath: string) {
  const { getMinioPublicUrl: getUrl } = await import("./minio-client");
  return getUrl(bucket, filePath);
}

export async function getBuckets() {
  const { BUCKETS } = await import("./minio-client");
  return BUCKETS;
}

export async function createMinioAdapter() {
  const { createMinioAdapter: createAdapter } = await import("./minio-adapter");
  return createAdapter();
}

export async function initBuckets() {
  const { initBuckets: init } = await import("./init-buckets");
  return init();
}

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
export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (storageAdapter) {
    return storageAdapter;
  }

  if (!useMinioStorage()) {
    throw new Error(
      "MinIO storage is not configured. Set MINIO_ENDPOINT or USE_MINIO=true"
    );
  }

  const { createMinioAdapter: createAdapter } = await import("./minio-adapter");
  storageAdapter = createAdapter();
  return storageAdapter;
}
