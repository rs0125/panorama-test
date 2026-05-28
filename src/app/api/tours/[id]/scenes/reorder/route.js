import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug } from '@/lib/repos/tour.js';
import { jsonError, readJson, withApi } from '@/lib/http.js';

// Bulk-reorder scenes within a tour. Atomic so a partial failure can't leave
// the order corrupted.
//
// Request: { order: [sceneId1, sceneId2, ...] }
// Response: 204
//
// Every scene in the tour must appear in `order` exactly once — that way we
// know we have a complete permutation, not a partial reshuffle, and the
// resulting orderIndex range is dense (0..N-1).
export const POST = withApi(async (req, { params }) => {
  const { id } = await params;
  const body = await readJson(req);
  const order = body?.order;
  if (!Array.isArray(order)) return jsonError('order array is required');

  const tour = await findTourByIdOrSlug(id, {
    include: { scenes: { select: { id: true } } },
  });
  if (!tour) return jsonError('tour not found', 404);

  const existing = new Set(tour.scenes.map((s) => s.id));
  const incoming = new Set(order);
  if (incoming.size !== order.length) return jsonError('order has duplicate ids');
  if (incoming.size !== existing.size || ![...incoming].every((sid) => existing.has(sid))) {
    return jsonError('order must contain every scene id in this tour exactly once', 422);
  }

  // One round-trip via `UPDATE … FROM (VALUES …)` instead of N per-row
  // updates wrapped in $transaction.
  const rows = order.map((sceneId, idx) => Prisma.sql`(${sceneId}, ${idx}::int)`);
  await prisma.$executeRaw`
    UPDATE panos."Scene" AS s
    SET "orderIndex" = v.idx
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, idx)
    WHERE s.id = v.id
  `;
  return new Response(null, { status: 204 });
});
