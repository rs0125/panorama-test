// Tiny helpers shared by the API routes.

export function jsonError(message, status = 400, extra) {
  return Response.json({ error: message, ...(extra || {}) }, { status });
}

// Throwable variant — handlers wrapped in withApi can `throw httpFail(...)`
// instead of plumbing a `return jsonError(...)` through nested helpers.
export class HttpError extends Error {
  constructor(message, status = 400, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function httpFail(message, status = 400, extra) {
  return new HttpError(message, status, extra);
}

// Wrap an App Router handler so:
//   - thrown HttpError → JSON with the right status
//   - Prisma P2025 (record not found) → 404
//   - Prisma P2002 (unique constraint) → 409 naming the offending field
//   - anything else → 500, logged with route info
// Routes keep using `return jsonError(...)` for explicit early returns; this
// just handles the throws so each route doesn't need its own try/catch around
// Prisma errors.
export function withApi(handler) {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return jsonError(err.message, err.status, err.extra);
      }
      if (err?.code === 'P2025') {
        return jsonError('not found', 404);
      }
      if (err?.code === 'P2002') {
        const field = err.meta?.target?.[0] || 'value';
        return jsonError(`${field} already in use`, 409);
      }
      const route = (() => {
        try { return new URL(req.url).pathname; } catch { return req?.url || '?'; }
      })();
      console.error('[api]', req?.method, route, err);
      return jsonError(err?.message || 'internal error', 500);
    }
  };
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

// Slugify + throw a 400 if the result is empty. Used by POST routes (where
// the slug is mandatory) and by PATCH routes when `slug` is present on the
// body. Throws via httpFail so withApi maps it to the JSON response.
export function normalizeSlug(input) {
  const slug = slugify(input);
  if (!slug) throw new HttpError('slug is empty after normalisation', 400);
  return slug;
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
