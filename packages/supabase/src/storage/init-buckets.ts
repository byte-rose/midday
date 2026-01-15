/**
 * Initialize required buckets in MinIO
 * Call this on application startup to ensure buckets exist
 */
export async function initBuckets(): Promise<void> {
  const { getMinioClient, BUCKETS } = await import("./minio-client");
  const client = getMinioClient();

  const bucketsToCreate = Object.values(BUCKETS);

  for (const bucket of bucketsToCreate) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket);
        console.log(`[MinIO] Created bucket: ${bucket}`);

        // Set bucket policy to allow public read access
        // This matches Supabase Storage public bucket behavior
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        };

        await client.setBucketPolicy(bucket, JSON.stringify(policy));
        console.log(`[MinIO] Set public read policy for bucket: ${bucket}`);
      } else {
        console.log(`[MinIO] Bucket already exists: ${bucket}`);
      }
    } catch (err) {
      console.error(`[MinIO] Failed to initialize bucket ${bucket}:`, err);
    }
  }
}
