import { prisma } from '@/lib/db.js';
import { jsonError, normalizeSlug, pickDefined, readJson, withApi } from '@/lib/http.js';

export const GET = withApi(async () => {
  const tours = await prisma.tour.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      _count: { select: { scenes: true } },
    },
  });
  return Response.json(tours);
});

export const POST = withApi(async (req) => {
  const body = await readJson(req);
  if (!body?.title) return jsonError('title is required');

  const slug = normalizeSlug(body.slug || body.title);

  // Skip the pre-check; Postgres's unique constraint rejects duplicates and
  // withApi maps P2002 to 409. One round-trip in the happy path.
  const tour = await prisma.tour.create({
    data: {
      slug,
      title: body.title,
      ...pickDefined(body, [
        'description',
        'location',
        'coverUrl',
        'floorplanUrl',
        'floorplanCropX',
        'floorplanCropY',
        'floorplanCropW',
        'floorplanCropH',
      ]),
    },
  });
  return Response.json(tour, { status: 201 });
});
