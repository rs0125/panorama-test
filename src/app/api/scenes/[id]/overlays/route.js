import { prisma } from '@/lib/db.js';
import { jsonError, pickDefined, readJson } from '@/lib/http.js';

// Sequential check-then-create — interactive $transaction can't ride the
// Supabase transaction-mode pooler.
export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');
  if (body.pitch == null || body.yaw == null) return jsonError('pitch and yaw are required');

  const type = body.type === 'line' ? 'line' : 'text';
  if (type === 'line' && (body.pitch2 == null || body.yaw2 == null)) {
    return jsonError('line overlays need pitch2 and yaw2');
  }

  const scene = await prisma.scene.findUnique({ where: { id }, select: { id: true } });
  if (!scene) return jsonError('scene not found', 404);

  const overlay = await prisma.overlay.create({
    data: {
      sceneId: id,
      type,
      pitch: body.pitch,
      yaw: body.yaw,
      ...pickDefined(body, ['pitch2', 'yaw2', 'label', 'title', 'body']),
    },
  });
  return Response.json(overlay, { status: 201 });
}
