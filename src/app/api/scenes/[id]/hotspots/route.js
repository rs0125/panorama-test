import { prisma } from '@/lib/db.js';
import { jsonError, readJson } from '@/lib/http.js';

// Creates a single navigation hotspot. The bulk endpoint (/hotspots/bulk) is
// what the admin editor actually uses; this is kept for one-off API calls.
//
// Sequential reads (Promise.all) + a separate create. Interactive transactions
// don't ride Supabase's transaction pooler.

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');
  if (body.pitch == null || body.yaw == null) return jsonError('pitch and yaw are required');
  if (!body.toSceneId) return jsonError('toSceneId is required');

  const [fromScene, toScene] = await Promise.all([
    prisma.scene.findUnique({ where: { id }, select: { id: true, tourId: true } }),
    prisma.scene.findUnique({ where: { id: body.toSceneId }, select: { id: true, tourId: true } }),
  ]);
  if (!fromScene) return jsonError('from-scene not found', 404);
  if (!toScene) return jsonError('to-scene not found', 404);
  if (fromScene.tourId !== toScene.tourId) {
    return jsonError('hotspot must link scenes within the same tour', 422);
  }

  const hotspot = await prisma.hotspot.create({
    data: {
      fromSceneId: id,
      toSceneId: body.toSceneId,
      pitch: body.pitch,
      yaw: body.yaw,
    },
  });
  return Response.json(hotspot, { status: 201 });
}
