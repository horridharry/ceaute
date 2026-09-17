// Signs several private storage objects with one Storage API request instead
// of one request per image. A path that cannot be signed maps to an empty
// string, which is how callers already treat a missing image URL.
export async function signStoragePaths(
  supabase,
  bucket,
  paths,
  expiresInSeconds,
) {
  const signedUrlByPath = new Map();
  const uniquePaths = [...new Set(paths.filter(Boolean))];

  if (uniquePaths.length === 0) {
    return signedUrlByPath;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, expiresInSeconds);

  if (error) {
    return signedUrlByPath;
  }

  for (const entry of data ?? []) {
    if (entry?.path && entry.signedUrl) {
      signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  return signedUrlByPath;
}
