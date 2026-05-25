import { prisma } from '@/lib/db.js';
import { jsonError, pickDefined, readJson, slugify } from '@/lib/http.js';
import { orphanedKeys, scheduleR2Cleanup, SCENE_ASSET_FIELDS } from '@/lib/repos/scene.js';

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

export async function GET(_req, { params }) {
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
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const data = pickDefined(body, SCENE_PATCH_FIELDS);
  if (body.slug !== undefined) {
    const slug = slugify(body.slug);
    if (!slug) return jsonError('slug is empty after normalisation');
    data.slug = slug;
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

  let next;
  try {
    next = await prisma.scene.update({ where: { id }, data });
  } catch (err) {
    if (err.code === 'P2025') return jsonError('scene not found', 404);
    if (err.code === 'P2002') return jsonError('scene slug already in use for this tour', 409);
    throw err;
  }

  scheduleR2Cleanup(orphanedKeys(prev, next));
  return Response.json(next);
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  let deleted;
  try {
    deleted = await prisma.scene.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2025') return jsonError('scene not found', 404);
    throw err;
  }
  // After the row is gone every asset on it is orphaned.
  scheduleR2Cleanup(orphanedKeys(deleted));
  return new Response(null, { status: 204 });
}
