import { createSubResourceHandlers } from '@/lib/crud.js';

export const { PATCH, DELETE } = createSubResourceHandlers({
  modelName: 'Overlay',
  patchFields: ['type', 'pitch', 'yaw', 'pitch2', 'yaw2', 'label', 'title', 'body', 'scale', 'boxWidth', 'boxHeight'],
  notFoundMessage: 'overlay not found',
});
