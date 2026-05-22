import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug } from '@/lib/repos/tour.js';
import { jsonError, pickDefined, readJson, slugify } from '@/lib/http.js';

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body?.title) return jsonError('title is required');
  if (!body?.imageUrl) return jsonError('imageUrl is required (upload to R2 first)');

  const slug = slugify(body.slug || body.title);
  if (!slug) return jsonError('slug is empty after normalisation');

  // Fetch the tour AND its current max orderIndex in a single SQL round-trip
  // (relation include with limit:1 is a JOIN, not a second query).
  const tour = await findTourByIdOrSlug(id, {
    include: {
      scenes: {
        orderBy: { orderIndex: 'desc' },
        take: 1,
        select: { orderIndex: true },
      },
    },
  });
  if (!tour) return jsonError('tour not found', 404);

  const orderIndex = body.orderIndex ?? (tour.scenes[0]?.orderIndex ?? -1) + 1;

  try {
    const scene = await prisma.scene.create({
      data: {
        tourId: tour.id,
        slug,
        title: body.title,
        imageUrl: body.imageUrl,
        orderIndex,
        minimapX: body.minimapX ?? 0.5,
        minimapY: body.minimapY ?? 0.5,
        ...pickDefined(body, ['previewUrl', 'audioUrl']),
      },
    });
    return Response.json(scene, { status: 201 });
  } catch (err) {
    if (err.code === 'P2002') return jsonError('scene slug already in use for this tour', 409);
    throw err;
  }
}
