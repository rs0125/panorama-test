import { prisma } from '@/lib/db.js';
import { jsonError, pickDefined, readJson, slugify } from '@/lib/http.js';

export async function GET() {
  const tours = await prisma.tour.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { scenes: true } } },
  });
  return Response.json(tours);
}

export async function POST(req) {
  const body = await readJson(req);
  if (!body?.title) return jsonError('title is required');

  const slug = slugify(body.slug || body.title);
  if (!slug) return jsonError('slug is empty after normalisation');

  // Skip the pre-check; let Postgres's unique constraint reject duplicates.
  // One round-trip in the happy path instead of two.
  try {
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
  } catch (err) {
    if (err.code === 'P2002') return jsonError('slug already in use', 409);
    throw err;
  }
}
