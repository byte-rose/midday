import type { Context } from "@api/rest/types";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  getStorageAdapter,
  useMinioStorage,
} from "@midday/supabase/storage-adapter";
import { withRequiredScope } from "../../middleware";

type UploadFormFields = {
  file: File;
  bucket: string;
  path: string;
};

export function parseUploadFormData(
  body: Record<string, unknown>,
): UploadFormFields {
  const file = body.file;
  if (!(file instanceof File)) {
    throw new Error("file is required");
  }

  const bucket = typeof body.bucket === "string" ? body.bucket.trim() : "";
  if (!bucket) {
    throw new Error("bucket is required");
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!path) {
    throw new Error("path is required");
  }

  return { file, bucket, path };
}

const app = new OpenAPIHono<Context>();

app.post("/upload", withRequiredScope("documents.write"), async (c) => {
  if (!useMinioStorage()) {
    return c.json({ error: "MinIO storage is not configured" }, 400);
  }

  const body = await c.req.parseBody();

  let fields: UploadFormFields;
  try {
    fields = parseUploadFormData(body);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid upload request",
      },
      400,
    );
  }

  const storage = await getStorageAdapter();
  const bucket = storage.from(fields.bucket);

  const result = await bucket.upload(fields.path, fields.file, {
    contentType: fields.file.type,
    cacheControl: "3600",
  });

  if (result.error) {
    return c.json({ error: result.error.message }, 500);
  }

  const publicUrl = await bucket.getPublicUrl(fields.path);

  return c.json({
    path: fields.path,
    publicUrl: publicUrl.data.publicUrl,
  });
});

export { app as uploadRouter };
