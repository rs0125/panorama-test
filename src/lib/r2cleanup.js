import { deleteFromR2, keyFromPublicUrl } from './r2.js';

// Collect R2 keys that became orphaned by replacing `prev` with `next` (or by
// deleting `prev` outright when `next` is undefined). Each entry in `fields`
// is a column name on the row carrying an R2 public URL. Non-R2 URLs (e.g.
// seeded `/panos/...` paths from /public) yield no key and are skipped.
export function orphanedKeys(prev, next, fields) {
  if (!prev) return [];
  const out = [];
  for (const f of fields) {
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
