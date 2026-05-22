import { abortWith, createSubResourceHandlers } from '@/lib/crud.js';

export const { PATCH, DELETE } = createSubResourceHandlers({
  modelName: 'Hotspot',
  patchFields: ['pitch', 'yaw', 'toSceneId'],
  notFoundMessage: 'hotspot not found',
  // A hotspot must always link two scenes in the same tour. When the target
  // changes, verify before we let the update through.
  onBeforeUpdate: async (db, prev, data) => {
    if (!data.toSceneId || data.toSceneId === prev.toSceneId) return;
    const [fromScene, toScene] = await Promise.all([
      db.scene.findUnique({ where: { id: prev.fromSceneId }, select: { tourId: true } }),
      db.scene.findUnique({ where: { id: data.toSceneId }, select: { tourId: true } }),
    ]);
    if (!toScene) abortWith('to-scene not found', 404);
    if (!fromScene || fromScene.tourId !== toScene.tourId) {
      abortWith('hotspot must link scenes within the same tour');
    }
  },
});
