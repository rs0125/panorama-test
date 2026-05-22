// Auth.js catch-all route — handles /api/auth/signin, /api/auth/callback/...,
// /api/auth/session, /api/auth/signout, etc. The middleware deliberately lets
// /api/auth/* through unauthenticated; everything happens inside these handlers.
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
