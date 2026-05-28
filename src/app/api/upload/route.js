import { jsonError, readJson, withApi } from '@/lib/http.js';
import { generateObjectKey, presignPut } from '@/lib/r2.js';
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_BY_KIND } from '@/lib/limits.js';

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

export const POST = withApi(async (req) => {
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');
  if (!body.contentType) return jsonError('contentType is required');

  const kind = String(body.kind || 'pano');
  const prefix = PREFIX_BY_KIND[kind] || 'uploads';

  const allowed = UPLOAD_MIME_BY_KIND[kind];
  if (allowed && !allowed.test(body.contentType)) {
    return jsonError(`contentType ${body.contentType} not allowed for kind ${kind}`, 415);
  }

  if (body.size != null && body.size > MAX_UPLOAD_BYTES) {
    return jsonError(`size exceeds ${MAX_UPLOAD_BYTES} bytes`, 413);
  }

  const key = generateObjectKey({ prefix, filename: body.filename });

  // External call → preserve a 502 (bad gateway) on R2/S3 failure rather than
  // letting withApi map it to a generic 500.
  try {
    const signed = await presignPut({ key, contentType: body.contentType });
    return Response.json(signed);
  } catch (err) {
    console.error('[upload/sign] failed', err);
    return jsonError('failed to presign upload', 502, { detail: err.message });
  }
});
