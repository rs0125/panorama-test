import { createSubResourceHandlers } from '@/lib/crud.js';

export const { PATCH, DELETE } = createSubResourceHandlers({
  modelName: 'Annotation',
  patchFields: ['title', 'body', 'orderIndex'],
  notFoundMessage: 'annotation not found',
});
