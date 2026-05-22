import { prisma } from '@/lib/db.js';

// Single source of truth for "is this id-or-slug a real tour" — the OR clause
// was duplicated across every tour-scoped route. Callers can pass any Prisma
// `include`/`select` they need.

export function findTourByIdOrSlug(idOrSlug, options = {}) {
  return prisma.tour.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    ...options,
  });
}
