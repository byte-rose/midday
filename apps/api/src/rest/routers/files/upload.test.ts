import { describe, expect, test } from "bun:test";
import { parseUploadFormData } from "./upload";

describe("parseUploadFormData", () => {
  test("returns normalized upload fields", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const result = parseUploadFormData({
      file,
      bucket: "vault",
      path: "team-id/hello.txt",
    });

    expect(result.bucket).toBe("vault");
    expect(result.path).toBe("team-id/hello.txt");
    expect(result.file).toBe(file);
  });

  test("throws when file is missing", () => {
    expect(() =>
      parseUploadFormData({
        bucket: "vault",
        path: "team-id/hello.txt",
      }),
    ).toThrow("file");
  });
});
