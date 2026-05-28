import { prisma } from '@/lib/db.js';

// R2 asset fields on a Tour — same shape as SCENE_ASSET_FIELDS, used by the
// tour route's orphan cleanup so replacing/deleting a tour cover or floorplan
// doesn't leak the prior R2 object.
export const TOUR_ASSET_FIELDS = ['coverUrl', 'floorplanUrl'];

// Single source of truth for "is this id-or-slug a real tour" — the OR clause
// was duplicated across every tour-scoped route. Callers can pass any Prisma
// `include`/`select` they need.

export function findTourByIdOrSlug(idOrSlug, options = {}) {
  return prisma.tour.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    ...options,
  });
}
