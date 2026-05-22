import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

// R2 speaks the S3 API at https://<account>.r2.cloudflarestorage.com.
// We sign requests with the bucket's API token (access key + secret).
// Region must be 'auto' for R2.
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

let _client;
function client() {
  if (_client) return _client;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET in .env.'
    );
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function safeExt(name = '') {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(name);
  return m ? m[0].toLowerCase() : '';
}

// Generates a non-guessable key under a prefix. We deliberately don't echo the
// original filename verbatim — it could contain unsafe chars and would let
// callers overwrite each other's objects.
export function generateObjectKey({ prefix = 'uploads', filename }) {
  const id = randomUUID();
  const ext = safeExt(filename);
  return `${prefix}/${id}${ext}`;
}

// Returns the public URL the browser should use to fetch the object.
// Requires R2_PUBLIC_URL to point at the bucket's public host (r2.dev URL or
// a custom domain bound to the bucket).
export function publicUrlFor(key) {
  if (!publicBase) {
    throw new Error('R2_PUBLIC_URL is not set; cannot build a public URL.');
  }
  return `${publicBase}/${key}`;
}

// Produce a short-lived URL the browser can PUT a file to directly. The
// signed URL binds the bucket, key, and contentType — the client *must* send
// the same Content-Type header on the PUT or the signature will be rejected.
//
// Note: R2 requires a CORS policy on the bucket allowing PUT from the admin
// origin. See README / Cloudflare dashboard.
export async function presignPut({ key, contentType, expiresIn = 300 }) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn });
  return {
    uploadUrl,
    key,
    publicUrl: publicUrlFor(key),
    expiresIn,
    requiredHeaders: { 'Content-Type': contentType },
  };
}

export async function uploadBufferToR2({ key, body, contentType }) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key, url: publicUrlFor(key) };
}

export async function deleteFromR2(key) {
  if (!key) return;
  try {
    await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    // Deletes are best-effort — a missing object shouldn't fail the request.
    console.warn('[r2] delete failed', key, err?.message);
  }
}

// Given a public URL, returns the object key (everything after R2_PUBLIC_URL).
// Returns null if the URL doesn't belong to our bucket, which is the signal
// callers use to skip cleanup for externally-hosted assets.
export function keyFromPublicUrl(url) {
  if (!url || !publicBase) return null;
  if (!url.startsWith(publicBase + '/')) return null;
  return url.slice(publicBase.length + 1);
}
