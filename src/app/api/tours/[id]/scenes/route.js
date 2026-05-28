import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug } from '@/lib/repos/tour.js';
import { jsonError, normalizeSlug, pickDefined, readJson, withApi } from '@/lib/http.js';

export const POST = withApi(async (req, { params }) => {
  const { id } = await params;
  const body = await readJson(req);
  if (!body?.title) return jsonError('title is required');
  if (!body?.imageUrl) return jsonError('imageUrl is required (upload to R2 first)');

  const slug = normalizeSlug(body.slug || body.title);

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
});
