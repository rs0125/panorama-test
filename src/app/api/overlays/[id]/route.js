import { createSubResourceHandlers } from '@/lib/crud.js';

export const { PATCH, DELETE } = createSubResourceHandlers({
  modelName: 'Overlay',
  patchFields: ['pitch', 'yaw', 'title', 'body'],
  notFoundMessage: 'overlay not found',
});
