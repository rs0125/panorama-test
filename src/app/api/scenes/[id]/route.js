import { prisma } from '@/lib/db.js';
import { jsonError, normalizeSlug, pickDefined, readJson, withApi } from '@/lib/http.js';
import { SCENE_ASSET_FIELDS } from '@/lib/repos/scene.js';
import { orphanedKeys, scheduleR2Cleanup } from '@/lib/r2cleanup.js';

const SCENE_PATCH_FIELDS = [
  'title',
  ...SCENE_ASSET_FIELDS,
  'minimapX',
  'minimapY',
  'orderIndex',
  'initialPitch',
  'initialYaw',
  'initialHfov',
];

export const GET = withApi(async (_req, { params }) => {
  const { id } = await params;
  const scene = await prisma.scene.findUnique({
    where: { id },
    include: {
      annotations: { orderBy: { orderIndex: 'asc' } },
      hotspotsFrom: { include: { toScene: { select: { id: true, slug: true, title: true } } } },
      overlays: true,
      tour: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!scene) return jsonError('scene not found', 404);
  return Response.json(scene);
});

export const PATCH = withApi(async (req, { params }) => {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const data = pickDefined(body, SCENE_PATCH_FIELDS);
  if (body.slug !== undefined) {
    data.slug = normalizeSlug(body.slug);
  }

  // Sequential read then write. We deliberately don't wrap in
  // `prisma.$transaction(async tx => …)` here — interactive transactions
  // can't ride Supabase's transaction-mode pooler (which hands out a fresh
  // backend connection per statement) and would 500 with P2028.
  //
  // The race window between findUnique and update is harmless: `prev` is only
  // used to compute which R2 objects became orphaned, and that GC is itself
  // best-effort.
  const prev = await prisma.scene.findUnique({ where: { id } });
  if (!prev) return jsonError('scene not found', 404);

  const next = await prisma.scene.update({ where: { id }, data });
  scheduleR2Cleanup(orphanedKeys(prev, next, SCENE_ASSET_FIELDS));
  return Response.json(next);
});

export const DELETE = withApi(async (_req, { params }) => {
  const { id } = await params;
  const deleted = await prisma.scene.delete({ where: { id } });
  // After the row is gone every asset on it is orphaned.
  scheduleR2Cleanup(orphanedKeys(deleted, null, SCENE_ASSET_FIELDS));
  return new Response(null, { status: 204 });
});
