import { jsonError, readJson } from '@/lib/http.js';
import { generateObjectKey, presignPut } from '@/lib/r2.js';

// Returns a presigned PUT URL the admin client uses to upload directly to R2.
//
// Request JSON:
//   { kind, filename, contentType, size? }
//
//   kind: 'pano' | 'preview' | 'audio' | 'cover' | 'floorplan' (drives the R2 prefix)
//   filename: original filename — used only for the extension; the stored key is random
//   contentType: MIME type; MUST match the Content-Type the client sends on the PUT,
//                or R2 rejects the signed request
//   size: optional, for client-side validation only; not signed
//
// Response JSON:
//   { uploadUrl, key, publicUrl, expiresIn, requiredHeaders }
//
// Client flow:
//   1. POST here → receive uploadUrl + publicUrl
//   2. fetch(uploadUrl, { method: 'PUT', headers: requiredHeaders, body: file })
//   3. PATCH the scene/tour with publicUrl as the imageUrl/audioUrl/etc.

const PREFIX_BY_KIND = {
  pano: 'panos',
  preview: 'panos/previews',
  audio: 'audio',
  cover: 'covers',
  floorplan: 'floorplans',
};

const MAX_BYTES = 500 * 1024 * 1024; // sanity cap; R2 itself allows up to 5 GB per PUT.

export async function POST(req) {
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');
  if (!body.contentType) return jsonError('contentType is required');

  const kind = String(body.kind || 'pano');
  const prefix = PREFIX_BY_KIND[kind] || 'uploads';

  if (body.size != null && body.size > MAX_BYTES) {
    return jsonError(`size exceeds ${MAX_BYTES} bytes`, 413);
  }

  const key = generateObjectKey({ prefix, filename: body.filename });

  try {
    const signed = await presignPut({ key, contentType: body.contentType });
    return Response.json(signed);
  } catch (err) {
    console.error('[upload/sign] failed', err);
    return jsonError('failed to presign upload', 502, { detail: err.message });
  }
}
