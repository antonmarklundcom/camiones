/**
 * Cloudflare R2 helpers — the only module that knows where images live.
 *
 * Read side: build public URLs from R2_PUBLIC_BASE_URL + object key. Keys
 * starting with "/" are local /public assets (seeded placeholders) and pass
 * through untouched.
 *
 * Write side: S3-compatible upload used by Build 2's admin panel; the
 * plumbing ships now so the panel only adds UI.
 */

export function imageUrl(r2Key: string | null | undefined): string | null {
  if (!r2Key) return null;
  if (r2Key.startsWith("/")) return r2Key; // local /public asset
  const base = process.env.R2_PUBLIC_BASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/${r2Key}` : `/${r2Key}`;
}

/**
 * Server-side upload to R2 via the S3 API. Lazy-imports the AWS SDK so the
 * public site never pays its bundle/startup cost.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string | null }> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 no configurado: faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET",
    );
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: imageUrl(key) };
}
