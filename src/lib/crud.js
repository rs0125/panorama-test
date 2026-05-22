import { prisma } from '@/lib/db.js';
import { jsonError, pickDefined, readJson } from '@/lib/http.js';

// Build PATCH + DELETE handlers for a simple sub-resource (annotation, hotspot,
// overlay, …). Anything more complex — relations to revalidate, cross-scope
// constraints, side-effects like R2 cleanup — should stay in its own route
// file and use the helpers in http.js / repos/ directly.
//
// Implementation note: we use sequential queries instead of an interactive
// $transaction. Interactive transactions don't ride Supabase's transaction-
// mode pooler reliably and yield P2028 "Unable to start a transaction in the
// given time". The narrow race window between read and write here doesn't
// hurt — the read is only used for the onBeforeUpdate hook's validation, and
// stale validation in the face of a concurrent edit is exactly the same
// outcome the user would get if the request had arrived a moment later.
//
// Options:
//   modelName: a Prisma model name available on `prisma` (string). Lowercased
//              automatically, since `prisma.Annotation` doesn't exist.
//   patchFields: whitelist of fields PATCH will pass through.
//   notFoundMessage: 404 message string.
//   onBeforeUpdate(client, prev, data): optional async hook for validation
//              that needs DB access (e.g. hotspot cross-tour check). The
//              first arg is the Prisma client (not a transaction); throw via
//              `abortWith` to fail the request with a specific status.

export function createSubResourceHandlers({
  modelName,
  patchFields,
  notFoundMessage,
  onBeforeUpdate,
}) {
  const m = modelName[0].toLowerCase() + modelName.slice(1);
  const missing = notFoundMessage || `${modelName} not found`;

  async function PATCH(req, { params }) {
    const { id } = await params;
    const body = await readJson(req);
    if (!body) return jsonError('invalid JSON');

    const data = pickDefined(body, patchFields);

    const prev = await prisma[m].findUnique({ where: { id } });
    if (!prev) return jsonError(missing, 404);

    if (onBeforeUpdate) {
      try {
        await onBeforeUpdate(prisma, prev, data);
      } catch (err) {
        if (err.__httpError) return jsonError(err.message, err.__httpStatus || 422);
        throw err;
      }
    }

    try {
      const updated = await prisma[m].update({ where: { id }, data });
      return Response.json(updated);
    } catch (err) {
      if (err.code === 'P2025') return jsonError(missing, 404);
      throw err;
    }
  }

  async function DELETE(_req, { params }) {
    const { id } = await params;
    try {
      await prisma[m].delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') return jsonError(missing, 404);
      throw err;
    }
    return new Response(null, { status: 204 });
  }

  return { PATCH, DELETE };
}

// Helper for onBeforeUpdate hooks to abort with a specific HTTP status.
export function abortWith(message, status = 422) {
  const e = new Error(message);
  e.__httpError = true;
  e.__httpStatus = status;
  throw e;
}
