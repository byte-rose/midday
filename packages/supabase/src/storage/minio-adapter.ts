import type {
  StorageAdapter,
  StorageBucket,
  StorageUploadOptions,
  StorageUploadResult,
  StorageDownloadResult,
  StorageSignedUrlResult,
  StorageRemoveResult,
  StoragePublicUrlResult,
} from "./types";

/**
 * MinIO bucket implementation compatible with Supabase Storage API
 */
class MinioBucket implements StorageBucket {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async upload(
    path: string,
    file: File | Blob | Buffer,
    options?: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const { getMinioClient } = await import("./minio-client");
      const client = getMinioClient();

      // Convert file to buffer
      let buffer: Buffer;
      let contentType = options?.contentType;

      if (Buffer.isBuffer(file)) {
        buffer = file;
      } else if (file instanceof Blob) {
        const arrayBuffer = await file.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        contentType = contentType || (file as File).type || "application/octet-stream";
      } else {
        throw new Error("Unsupported file type");
      }

      const metadata: Record<string, string> = {};
      if (options?.cacheControl) {
        metadata["Cache-Control"] = options.cacheControl;
      }

      await client.putObject(this.bucketName, path, buffer, buffer.length, {
        "Content-Type": contentType || "application/octet-stream",
        ...metadata,
      });

      return {
        data: { path },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return {
        data: null,
        error: { message },
      };
    }
  }

  async download(path: string): Promise<StorageDownloadResult> {
    try {
      const { getMinioClient } = await import("./minio-client");
      const client = getMinioClient();
      const stream = await client.getObject(this.bucketName, path);

      // Collect stream into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Convert to Blob
      const blob = new Blob([buffer]);

      return {
        data: blob,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      return {
        data: null,
        error: { message },
      };
    }
  }

  async createSignedUrl(
    path: string,
    expiresIn: number,
    options?: { download?: boolean }
  ): Promise<StorageSignedUrlResult> {
    try {
      const { getMinioClient } = await import("./minio-client");
      const client = getMinioClient();

      // MinIO presignedGetObject expects expiry in seconds
      const signedUrl = await client.presignedGetObject(
        this.bucketName,
        path,
        expiresIn
      );

      // Add download parameter if requested
      let finalUrl = signedUrl;
      if (options?.download) {
        const url = new URL(signedUrl);
        url.searchParams.set("response-content-disposition", "attachment");
        finalUrl = url.toString();
      }

      return {
        data: { signedUrl: finalUrl },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signed URL generation failed";
      return {
        data: null,
        error: { message },
      };
    }
  }

  async remove(paths: string[]): Promise<StorageRemoveResult> {
    try {
      const { getMinioClient } = await import("./minio-client");
      const client = getMinioClient();

      // MinIO removeObjects expects objects with name property
      const objectsList = paths.map((path) => ({ name: path }));

      // removeObjects returns a stream of errors
      const errors: Error[] = [];
      const errorStream = client.removeObjects(this.bucketName, objectsList);

      for await (const err of errorStream) {
        if (err) {
          errors.push(new Error(`Failed to remove ${err.name}: ${err.message || "Unknown error"}`));
        }
      }

      if (errors.length > 0) {
        return {
          data: null,
          error: { message: errors.map((e) => e.message).join("; ") },
        };
      }

      return {
        data: paths.map((name) => ({ name })),
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Remove failed";
      return {
        data: null,
        error: { message },
      };
    }
  }

  async getPublicUrl(path: string): Promise<StoragePublicUrlResult> {
    const { getMinioPublicUrl } = await import("./minio-client");
    const baseUrl = getMinioPublicUrl();
    const publicUrl = `${baseUrl}/${this.bucketName}/${path}`;

    return {
      data: { publicUrl },
    };
  }
}

/**
 * MinIO storage adapter implementing Supabase Storage-compatible API
 */
class MinioStorageAdapter implements StorageAdapter {
  from(bucket: string): StorageBucket {
    return new MinioBucket(bucket);
  }
}

/**
 * Create MinIO storage adapter instance
 */
export function createMinioAdapter(): StorageAdapter {
  return new MinioStorageAdapter();
}
