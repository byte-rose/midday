import { describe, expect, test } from "bun:test";
import { getUploadMode } from "./upload";

describe("getUploadMode", () => {
  test("prefers minio when NEXT_PUBLIC_MINIO_URL is set", () => {
    const mode = getUploadMode({
      NEXT_PUBLIC_MINIO_URL: "http://localhost:19000",
      NEXT_PUBLIC_SUPABASE_ID: "example",
    });

    expect(mode).toBe("minio");
  });

  test("uses supabase when only NEXT_PUBLIC_SUPABASE_ID is set", () => {
    const mode = getUploadMode({
      NEXT_PUBLIC_SUPABASE_ID: "example",
    });

    expect(mode).toBe("supabase");
  });

  test("returns none when neither minio nor supabase is configured", () => {
    const mode = getUploadMode({});

    expect(mode).toBe("none");
  });
});
