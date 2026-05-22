// Tiny helpers shared by the API routes.

export function jsonError(message, status = 400, extra) {
  return Response.json({ error: message, ...(extra || {}) }, { status });
}

export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

// Read JSON body, returning null on parse failure so the caller can decide
// whether that's a 400 or a no-op (e.g. PATCH with empty body).
export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Pick only the listed keys from an object, dropping undefined values so PATCH
// payloads do partial updates instead of nulling fields by accident.
export function pickDefined(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
