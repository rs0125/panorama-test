import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug } from '@/lib/repos/tour.js';
import { jsonError, readJson } from '@/lib/http.js';

// Bulk-update minimap positions for scenes in a tour. One round-trip + one
// Prisma transaction instead of N PATCHes from the admin's "Save minimap".
//
// Request: { positions: [{ id, minimapX, minimapY }, ...] }
// Response: 204
//
// We verify every id actually belongs to this tour before touching anything —
// otherwise a malicious caller could move scenes between tours via this route.
export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  const positions = body?.positions;
  if (!Array.isArray(positions) || positions.length === 0) {
    return jsonError('positions array is required');
  }

  for (const p of positions) {
    if (!p?.id) return jsonError('every position needs an id');
    if (typeof p.minimapX !== 'number' || typeof p.minimapY !== 'number') {
      return jsonError(`position ${p.id}: minimapX/Y must be numbers`);
    }
    if (p.minimapX < 0 || p.minimapX > 1 || p.minimapY < 0 || p.minimapY > 1) {
      return jsonError(`position ${p.id}: minimapX/Y must be in [0,1]`);
    }
  }

  const tour = await findTourByIdOrSlug(id, {
    include: { scenes: { select: { id: true } } },
  });
  if (!tour) return jsonError('tour not found', 404);

  const tourSceneIds = new Set(tour.scenes.map((s) => s.id));
  for (const p of positions) {
    if (!tourSceneIds.has(p.id)) {
      return jsonError(`scene ${p.id} does not belong to this tour`, 422);
    }
  }

  await prisma.$transaction(
    positions.map((p) =>
      prisma.scene.update({
        where: { id: p.id },
        data: { minimapX: p.minimapX, minimapY: p.minimapY },
      })
    )
  );
  return new Response(null, { status: 204 });
}
