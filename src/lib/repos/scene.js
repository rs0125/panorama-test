import { deleteFromR2, keyFromPublicUrl } from '@/lib/r2.js';

// R2 asset fields on a Scene. Centralised so adding a new asset (e.g. a video
// preview) means one edit, not three.
export const SCENE_ASSET_FIELDS = ['imageUrl', 'previewUrl', 'audioUrl'];

// Collect R2 keys that became orphaned by replacing `prev` with `next` (or by
// deleting `prev` outright when `next` is undefined). Non-R2 URLs — like the
// seeded `/panos/...` paths from /public — yield no keys and are skipped.
export function orphanedKeys(prev, next) {
  if (!prev) return [];
  const out = [];
  for (const f of SCENE_ASSET_FIELDS) {
    const prevUrl = prev[f];
    const nextUrl = next ? next[f] : undefined;
    if (prevUrl && prevUrl !== nextUrl) {
      const k = keyFromPublicUrl(prevUrl);
      if (k) out.push(k);
    }
  }
  return out;
}

// Fire-and-forget GC. Caller has already committed the DB change; we don't
// want a slow R2 delete to bottleneck the response.
export function scheduleR2Cleanup(keys) {
  for (const k of keys) {
    deleteFromR2(k).catch((err) => console.warn('[r2] cleanup failed', k, err?.message));
  }
}
