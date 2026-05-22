import { prisma } from '@/lib/db.js';
import { jsonError, readJson } from '@/lib/http.js';

// Apply a full set of hotspot edits for one scene in a single transaction.
//
// Request:
//   {
//     create: [{ toSceneId, pitch, yaw }],
//     update: [{ id, toSceneId?, pitch?, yaw? }],
//     delete: [hotspotId]
//   }
//
// Response: 200 with the scene's resulting hotspot list, in DB order.
//
// Invariants enforced server-side (don't trust the admin):
//   - Every update/delete id must already belong to this scene.
//   - Every toSceneId (create or update) must live in the same tour.
// One transaction so a partial failure doesn't leave the scene in a torn state.

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return jsonError('invalid JSON');

  const create = Array.isArray(body.create) ? body.create : [];
  const update = Array.isArray(body.update) ? body.update : [];
  const del = Array.isArray(body.delete) ? body.delete : [];
  if (!create.length && !update.length && !del.length) {
    return Response.json([]); // no-op; caller can short-circuit too
  }

  // Light shape validation up-front. Numeric checks here keep the transaction
  // body simple and let us return precise error messages.
  for (const c of create) {
    if (!c.toSceneId) return jsonError('create: toSceneId required');
    if (typeof c.pitch !== 'number' || typeof c.yaw !== 'number') {
      return jsonError('create: pitch/yaw must be numbers');
    }
  }
  for (const u of update) {
    if (!u.id) return jsonError('update: id required');
    if (u.pitch != null && typeof u.pitch !== 'number') return jsonError('update: pitch must be number');
    if (u.yaw != null && typeof u.yaw !== 'number') return jsonError('update: yaw must be number');
  }

  const scene = await prisma.scene.findUnique({
    where: { id },
    select: { id: true, tourId: true },
  });
  if (!scene) return jsonError('scene not found', 404);

  // Verify every referenced toSceneId belongs to the same tour. Doing it in
  // one IN-query is much faster than N findUniques.
  const targetIds = [
    ...new Set([
      ...create.map((c) => c.toSceneId),
      ...update.map((u) => u.toSceneId).filter(Boolean),
    ]),
  ];
  if (targetIds.length) {
    const targets = await prisma.scene.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, tourId: true },
    });
    const valid = new Set(targets.filter((t) => t.tourId === scene.tourId).map((t) => t.id));
    const bad = targetIds.find((tid) => !valid.has(tid));
    if (bad) return jsonError(`target scene ${bad} not in same tour`, 422);
  }

  // Verify update/delete ids actually belong to this scene.
  const refIds = [...update.map((u) => u.id), ...del];
  if (refIds.length) {
    const owned = await prisma.hotspot.findMany({
      where: { id: { in: refIds }, fromSceneId: id },
      select: { id: true },
    });
    const ok = new Set(owned.map((h) => h.id));
    const stray = refIds.find((r) => !ok.has(r));
    if (stray) return jsonError(`hotspot ${stray} not on this scene`, 422);
  }

  // Apply. Order: deletes first (free up the ids), then updates, then creates.
  await prisma.$transaction([
    ...(del.length
      ? [prisma.hotspot.deleteMany({ where: { id: { in: del } } })]
      : []),
    ...update.map((u) => {
      const data = {};
      if (u.pitch != null) data.pitch = u.pitch;
      if (u.yaw != null) data.yaw = u.yaw;
      if (u.toSceneId) data.toSceneId = u.toSceneId;
      return prisma.hotspot.update({ where: { id: u.id }, data });
    }),
    ...create.map((c) =>
      prisma.hotspot.create({
        data: {
          fromSceneId: id,
          toSceneId: c.toSceneId,
          pitch: c.pitch,
          yaw: c.yaw,
        },
      })
    ),
  ]);

  const fresh = await prisma.hotspot.findMany({
    where: { fromSceneId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, pitch: true, yaw: true, toSceneId: true },
  });
  return Response.json(fresh);
}
