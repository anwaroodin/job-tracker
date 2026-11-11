export const EXTENSION_KEY = "extension/latest.zip";

export async function publishedExtension(bucket: R2Bucket) {
  return (await bucket.head(EXTENSION_KEY))?.uploaded.toISOString() ?? null;
}
