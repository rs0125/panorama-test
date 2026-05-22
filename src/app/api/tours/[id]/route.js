import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug } from '@/lib/repos/tour.js';
import { jsonError, pickDefined, readJson, slugify } from '@/lib/http.js';

const TOUR_PATCH_FIELDS = [
  'title',
  'description',
  'location',
  'coverUrl',
  'floorplanUrl',
  'floorplanCropX',
  'floorplanCropY',
  'floorplanCropW',
  'floorplanCropH',
];

export async function GET(_req, { params }) {
  const { id } = await params;
  const tour = await findTourByIdOrSlug(id, {
    include: {
      scenes: {
        orderBy: { orderIndex: 'asc' },
        include: {
          annotations: { orderBy: { orderIndex: 'asc' } },
          hotspotsFrom: true,
          overlays: true,
        },
      },
    },
  });
  if (!tour) return jsonError('tour not found', 404);
  return Response.json(tour);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const tour = await findTourByIdOrSlug(id);
  if (!tour) return jsonError('tour not found', 404);

  const data = pickDefined(body, TOUR_PATCH_FIELDS);

  if (body.slug !== undefined) {
    const slug = slugify(body.slug);
    if (!slug) return jsonError('slug is empty after normalisation');
    if (slug !== tour.slug) data.slug = slug;
  }

  try {
    const updated = await prisma.tour.update({ where: { id: tour.id }, data });
    return Response.json(updated);
  } catch (err) {
    if (err.code === 'P2002') return jsonError('slug already in use', 409);
    throw err;
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const tour = await findTourByIdOrSlug(id);
  if (!tour) return jsonError('tour not found', 404);
  await prisma.tour.delete({ where: { id: tour.id } });
  return new Response(null, { status: 204 });
}
