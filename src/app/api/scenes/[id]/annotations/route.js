import { prisma } from '@/lib/db.js';
import { jsonError, pickDefined, readJson } from '@/lib/http.js';

// Adds an annotation card to a scene. orderIndex defaults to "end of list"
// so the admin's "+ Add caption" button never reshuffles existing rows.
//
// Sequential queries (no interactive $transaction) — those don't work over
// Supabase's transaction-mode pooler and yield P2028. The narrow race window
// between the max read and the create can at worst give two new annotations
// the same orderIndex, which the UI sorts harmlessly.

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const scene = await prisma.scene.findUnique({ where: { id }, select: { id: true } });
  if (!scene) return jsonError('scene not found', 404);

  const max = await prisma.annotation.aggregate({
    where: { sceneId: id },
    _max: { orderIndex: true },
  });
  const orderIndex = body.orderIndex ?? (max._max.orderIndex ?? -1) + 1;

  const annotation = await prisma.annotation.create({
    data: {
      sceneId: id,
      orderIndex,
      ...pickDefined(body, ['title', 'body']),
    },
  });
  return Response.json(annotation, { status: 201 });
}
