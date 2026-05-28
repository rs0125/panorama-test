import { prisma } from '@/lib/db.js';
import { findTourByIdOrSlug, TOUR_ASSET_FIELDS } from '@/lib/repos/tour.js';
import { jsonError, normalizeSlug, pickDefined, readJson, withApi } from '@/lib/http.js';
import { orphanedKeys, scheduleR2Cleanup } from '@/lib/r2cleanup.js';
import { SCENE_ASSET_FIELDS } from '@/lib/repos/scene.js';

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

export const PATCH = withApi(async (req, { params }) => {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const tour = await findTourByIdOrSlug(id);
  if (!tour) return jsonError('tour not found', 404);

  const data = pickDefined(body, TOUR_PATCH_FIELDS);

  if (body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (slug !== tour.slug) data.slug = slug;
  }

  const updated = await prisma.tour.update({ where: { id: tour.id }, data });
  scheduleR2Cleanup(orphanedKeys(tour, updated, TOUR_ASSET_FIELDS));
  return Response.json(updated);
});

export const DELETE = withApi(async (_req, { params }) => {
  const { id } = await params;
  // Pull every scene's asset URLs alongside the tour so cascade-delete doesn't
  // strand the children's R2 objects. Tour has its own cover/floorplan too.
  const tour = await findTourByIdOrSlug(id, {
    include: { scenes: { select: { imageUrl: true, previewUrl: true, audioUrl: true } } },
  });
  if (!tour) return jsonError('tour not found', 404);
  await prisma.tour.delete({ where: { id: tour.id } });
  const tourKeys = orphanedKeys(tour, null, TOUR_ASSET_FIELDS);
  const sceneKeys = (tour.scenes || []).flatMap((s) => orphanedKeys(s, null, SCENE_ASSET_FIELDS));
  scheduleR2Cleanup([...tourKeys, ...sceneKeys]);
  return new Response(null, { status: 204 });
});
