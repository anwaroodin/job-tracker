export function cvObjectKey(userId: string, cvType: string, filename: string) {
  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  return `${userId}/${cvType}/${safeName}`;
}

export async function putCv(
  env: Env,
  key: string,
  body: ReadableStream | ArrayBuffer | Uint8Array | Blob,
  contentType = "application/pdf",
) {
  return env.CVS.put(key, body, { httpMetadata: { contentType } });
}

export async function getCv(env: Env, key: string) {
  return env.CVS.get(key);
}

export async function deleteCv(env: Env, key: string) {
  return env.CVS.delete(key);
}
