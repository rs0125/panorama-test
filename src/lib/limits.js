// Sanity caps shared between API routes and the admin UI so the client
// disables/validates before the server rejects.

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // R2 itself allows 5GB; this is our cap.
export const MAX_TTS_CHARS = 5000; // soft cap; ElevenLabs has its own per-model limits.

// Per-upload-kind MIME allowlist. Tour assets are served back to the public
// viewer, so we reject anything outside the expected family at presign time
// — otherwise a compromised admin account could store arbitrary content under
// a panorama URL.
export const UPLOAD_MIME_BY_KIND = {
  pano: /^image\//,
  preview: /^image\//,
  cover: /^image\//,
  floorplan: /^image\//,
  audio: /^audio\//,
};
