// Browser-side helper: request a presigned URL, PUT the file straight to R2,
// return the public URL. Use this from admin components.
//
// Requires R2 bucket CORS to allow PUT from the admin origin. Minimal policy:
//   [{ "AllowedOrigins": ["http://localhost:3000", "https://your.domain"],
//      "AllowedMethods": ["PUT"],
//      "AllowedHeaders": ["Content-Type"],
//      "MaxAgeSeconds": 3600 }]

export async function uploadFileToR2(file, { kind = 'pano', onProgress } = {}) {
  if (!file) throw new Error('uploadFileToR2: no file');

  const signRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  });
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error || `sign request failed (${signRes.status})`);
  }
  const { uploadUrl, publicUrl, requiredHeaders } = await signRes.json();

  // XHR (not fetch) so we get a real progress event for the admin UI.
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    for (const [k, v] of Object.entries(requiredHeaders || {})) {
      xhr.setRequestHeader(k, v);
    }
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 PUT failed (${xhr.status}): ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('R2 PUT network error (check bucket CORS)'));
    xhr.send(file);
  });

  return publicUrl;
}
