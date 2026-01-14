import { Client as MinioClient } from "minio";

let minioClient: MinioClient | null = null;

/**
 * Get MinIO client configuration from environment
 */
function getMinioConfig() {
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT ? Number.parseInt(process.env.MINIO_PORT, 10) : 9000;
  const useSSL = process.env.MINIO_USE_SSL === "true";
  const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "minioadmin";
  const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "minioadmin";

  if (!endpoint) {
    throw new Error("MINIO_ENDPOINT environment variable is required for MinIO storage");
  }

  return {
    endPoint: endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  };
}

/**
 * Get or create shared MinIO client instance
 */
export function getMinioClient(): MinioClient {
  if (minioClient) {
    return minioClient;
  }

  const config = getMinioConfig();
  minioClient = new MinioClient(config);

  return minioClient;
}

/**
 * Get the public URL base for MinIO
 * Used for generating public URLs for objects
 */
export function getMinioPublicUrl(): string {
  return process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
}

/**
 * Known buckets used by Midday
 */
export const BUCKETS = {
  VAULT: "vault",
  AVATARS: "avatars",
  APPS: "apps",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
