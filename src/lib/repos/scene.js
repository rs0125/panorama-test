// R2 asset fields on a Scene. Centralised so adding a new asset (e.g. a video
// preview) means one edit, not three.
export const SCENE_ASSET_FIELDS = ['imageUrl', 'previewUrl', 'audioUrl'];

export { orphanedKeys, scheduleR2Cleanup } from '../r2cleanup.js';
