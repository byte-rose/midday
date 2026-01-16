import { stripSpecialCharacters } from "@midday/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

type UploadMode = "minio" | "supabase" | "none";

type ResumableUploadParmas = {
  file: File;
  path: string[];
  bucket: string;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
};

export function getUploadMode(
  env: Record<string, string | undefined> = process.env,
): UploadMode {
  if (env.NEXT_PUBLIC_MINIO_URL) {
    return "minio";
  }

  if (env.NEXT_PUBLIC_SUPABASE_ID) {
    return "supabase";
  }

  return "none";
}

function normalizePath(path: string[]): string {
  return decodeURIComponent(path.join("/"));
}

function getApiUploadUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  return new URL("/files/upload", apiUrl).toString();
}

export async function uploadViaApi(
  client: SupabaseClient,
  {
    file,
    bucket,
    path,
    onProgress,
  }: {
    file: File;
    bucket: string;
    path: string;
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  },
): Promise<{ publicUrl?: string; path: string }> {
  const {
    data: { session },
  } = await client.auth.getSession();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("path", path);

  const endpoint = getApiUploadUrl();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);

    if (session?.access_token) {
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as {
            path?: string;
            publicUrl?: string;
          };
          resolve({
            publicUrl: response.publicUrl,
            path: response.path ?? path,
          });
        } catch (error) {
          reject(error);
        }
        return;
      }

      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("Upload failed"));

    xhr.send(formData);
  });
}

export async function resumableUpload(
  client: SupabaseClient,
  { file, path, bucket, onProgress }: ResumableUploadParmas,
) {
  const {
    data: { session },
  } = await client.auth.getSession();

  const filename = stripSpecialCharacters(file.name);

  const fullPath = normalizePath([...path, filename]);

  const uploadMode = getUploadMode();
  if (uploadMode === "minio") {
    await uploadViaApi(client, {
      file,
      bucket,
      path: fullPath,
      onProgress,
    });

    return {
      filename,
      file,
    };
  }

  if (uploadMode === "none") {
    throw new Error("No upload provider configured");
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${process.env.NEXT_PUBLIC_SUPABASE_ID}.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${session?.access_token}`,
        // optionally set upsert to true to overwrite existing files
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      // Important if you want to allow re-uploading the same file https://github.com/tus/tus-js-client/blob/main/docs/api.md#removefingerprintonsuccess
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: fullPath,
        contentType: file.type,
        cacheControl: "3600",
      },
      // NOTE: it must be set to 6MB (for now) do not change it
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        reject(error);
      },
      onProgress,
      onSuccess: () => {
        resolve({
          ...upload,
          filename,
        });
      },
    });

    // Check if there are any previous uploads to continue.
    return upload.findPreviousUploads().then((previousUploads) => {
      // Found previous uploads so we select the first one.
      if (previousUploads.length) {
        // @ts-expect-error
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    });
  });
}
