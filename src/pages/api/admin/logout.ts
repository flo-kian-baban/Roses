import { route, redirect } from '@/lib/admin/api';
import { cookieHeader } from '@/lib/admin/auth';

export default route({ anonymous: true }, async ({ req, res }) => {
  res.setHeader('Set-Cookie', cookieHeader(null, req));
  redirect(res, '/admin/login', { signedout: '1' });
});
